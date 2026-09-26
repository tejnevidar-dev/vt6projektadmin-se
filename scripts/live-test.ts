// Live-test efter deploy/migration: kör alla publika kontroller i ett svep och städar testdatan.
//
//   cd crm && bun run scripts/live-test.ts
//   WEBHOOK_SECRET=... bun run scripts/live-test.ts        # testar även webbformulär-webhooken (med och utan e-post)
//
// Läser LEAD_INBOX_SECRET, REPORT_SECRET, SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY ur crm/.env (bun läser den automatiskt).
// Skapar bara leads med namnet "ZZ Live-test" och raderar dem (och deras fastigheter och notiser) i slutet.
// Manuella steg som INTE kan köras härifrån: inbound-email (skicka testmail till info@), signering och UE-kedjan (se docs/deploy-checklist-del1-ue.md),
// samt cron (bunx wrangler tail admin-vt6 och vänta på "*/10 * * * * - Ok").

const BASE = (process.env.CRM_URL || "https://admin-vt6.tejnevidar.workers.dev").replace(/\/$/, "");
const SU = process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const results: { name: string; ok: boolean; detail: string }[] = [];
const record = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FEL "} ${name}${detail ? `: ${detail}` : ""}`);
};

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  let body: any = null;
  try {
    body = await res.clone().json();
  } catch {
    /* inte JSON */
  }
  return { status: res.status, body };
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SU}/rest/v1/${path}`, { ...init, headers: { apikey: SK!, Authorization: `Bearer ${SK}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) } });

const createdLeadIds: string[] = [];

async function main() {
  const since = new Date(Date.now() - 60_000).toISOString();

  // 1. morning-stats
  const report = process.env.REPORT_SECRET;
  const noKey = await call("/api/public/morning-stats");
  record("morning-stats utan nyckel ger 401", noKey.status === 401, String(noKey.status));
  if (report) {
    const ok = await call("/api/public/morning-stats", { headers: { "X-Report-Secret": report } });
    record("morning-stats med nyckel ger 200 och paid-block", ok.status === 200 && !!ok.body?.paid, `${ok.status}, paid=${!!ok.body?.paid}`);
  }

  // 2. Publika token-routes ska ge 404 (inte 500) för ogiltig token
  for (const p of ["/api/public/sign/abcdefghijklmnopqrstuvwxyz", "/api/public/work-order/abc", "/api/public/photos/abc"]) {
    const r = await call(p);
    record(`${p} ger 404`, r.status === 404, String(r.status));
  }

  // 3. lead-inbox: skapa, dubblett, utan nyckel
  const inbox = process.env.LEAD_INBOX_SECRET;
  if (inbox) {
    const id = `ZZLIVE-${Date.now()}`;
    const payload = { name: "ZZ Live-test", phone: "070 000 00 97", address: "Testgatan 1", message: "Live-test, raderas", channel: "test", external_id: id };
    const headers = { "Content-Type": "application/json", "x-inbox-secret": inbox };
    const a = await call("/api/public/lead-inbox", { method: "POST", headers, body: JSON.stringify(payload) });
    record("lead-inbox skapar lead (201)", a.status === 201 && a.body?.status === "created", `${a.status} ${a.body?.status ?? a.body?.error ?? ""}`);
    if (a.body?.lead_id) createdLeadIds.push(a.body.lead_id);
    const b = await call("/api/public/lead-inbox", { method: "POST", headers, body: JSON.stringify(payload) });
    record("samma external_id igen ger duplicate (200)", b.status === 200 && b.body?.status === "duplicate", `${b.status} ${b.body?.status ?? ""}`);
    const c = await call("/api/public/lead-inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    record("lead-inbox utan nyckel ger 401", c.status === 401, String(c.status));
  } else record("lead-inbox", false, "LEAD_INBOX_SECRET saknas i miljön");

  // 4. webbformulär-webhook
  const wh = process.env.WEBHOOK_SECRET;
  const bad = await call("/api/public/roslagstak-webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Webhook-Secret": "fel" }, body: JSON.stringify({ id: "x", mode: "consultation", name: "a", phone: "1" }) });
  record("webhook med fel secret ger 401 (500 = ROSLAGSTAK_WEBHOOK_SECRET saknas som Worker-secret)", bad.status === 401, `${bad.status} ${bad.body?.error ?? ""}`);
  if (wh && bad.status === 401) {
    const headers = { "Content-Type": "application/json", "X-Webhook-Secret": wh };
    for (const [label, email] of [["med e-post", "zz-live@example.com"], ["med tom e-post", ""]] as const) {
      const id = `ZZLIVE-WH-${label.length}-${Date.now()}`;
      const r = await call("/api/public/roslagstak-webhook", { method: "POST", headers, body: JSON.stringify({ id, mode: "consultation", name: "ZZ Live-test", phone: label === "med e-post" ? "070 000 00 96" : "070 000 00 95", email }) });
      record(`webhook ${label} skapar lead (201)`, r.status === 201, `${r.status} ${r.body?.status ?? r.body?.error ?? ""}`);
      if (r.body?.lead_id) createdLeadIds.push(r.body.lead_id);
    }
  }

  // 5. Städa (bara leads som skapats av det här skriptet, plus fastigheter och notiser från samma minut)
  if (SU && SK) {
    if (createdLeadIds.length) {
      const props = await (await rest(`leads?select=property_id&id=in.(${createdLeadIds.join(",")})`)).json();
      const del = await rest(`leads?id=in.(${createdLeadIds.join(",")})`, { method: "DELETE" });
      const propIds = (props as { property_id: string | null }[]).map((p) => p.property_id).filter(Boolean);
      if (propIds.length) await rest(`properties?id=in.(${propIds.join(",")})`, { method: "DELETE" });
      const notes = await (await rest(`notifications?select=id,type&created_at=gte.${since}&type=in.(lead_new,lead_repeat)`)).json();
      const noteIds = (notes as { id: string }[]).map((n) => n.id);
      if (noteIds.length) await rest(`notifications?id=in.(${noteIds.join(",")})`, { method: "DELETE" });
      const left = await (await rest(`leads?select=id&name=eq.ZZ%20Live-test`)).json();
      record("testdata städad (0 testleads kvar)", del.ok && Array.isArray(left) && left.length === 0, `${(left as any[]).length} kvar`);
    }
  } else record("städning", false, "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY saknas");

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} gröna${failed.length ? `, ${failed.length} FEL` : ""}.`);
  console.log("Manuellt kvar: inbound-email (testmail till info@), signering, UE-kedjan och cron (wrangler tail). Se docs/deploy-checklist-del1-ue.md.");
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(2);
});
