// Räddar förfrågningar som sajten tagit emot men som aldrig nådde CRM:et (webhooken trasig 2026-09-04..09-27).
// Läser en JSON-fil med rader från sajtens tabell quote_requests och skickar dem en och en till
// CRM-webhooken, med samma id-format som sajten själv använder: external_id = "roslagstak:<quote_requests.id>".
// Det gör körningen idempotent (samma rad två gånger blir aldrig två leads), och dessutom slår
// telefon/e-post-dubblettskyddet ihop återkommande kunder. Källa blir "roslagstak" och notiser går
// som vanligt till Vidar och ansvarig säljare.
//
// KÖR INGET FÖRRÄN PROJEKTLEDAREN SÄGER TILL. Standard är torrkörning (skickar ingenting).
//
//   bun run scripts/rescue-missed-quotes.ts <rader.json>            # torrkörning, visar vad som skulle skickas
//   WEBHOOK_SECRET=... bun run scripts/rescue-missed-quotes.ts <rader.json> --send
//
// Valfria miljövariabler: CRM_URL (standard https://admin-vt6.tejnevidar.workers.dev), DELAY_MS (standard 1500).
// Persondata skrivs aldrig ut: loggen visar bara id, status och antal.

import { readFileSync } from "node:fs";

interface QuoteRow {
  id: string;
  mode?: "configure" | "consultation" | string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  current_roof?: string | null;
  new_roof?: string | null;
  raspont?: string | null;
  gangbrygga?: boolean | null;
  takstege?: boolean | null;
  avvattning?: string | null;
  floors?: string | null;
  message?: string | null;
  created_at?: string | null;
}

const NOTE = "Missad förfrågan från sajten (webhook trasig 09-04–09-27)";

/** Testrader hoppas över: TEST-namn, example.com och telefon med bara nollor. */
export function isTestRow(r: QuoteRow): boolean {
  const name = (r.name ?? "").trim();
  const email = (r.email ?? "").trim().toLowerCase();
  const digits = (r.phone ?? "").replace(/\D/g, "");
  return /^test\b/i.test(name) || /(^|@)example\.com$/.test(email) || (digits.length > 0 && /^0+$/.test(digits));
}

/** Bygger webhook-payloaden. Anteckningen om att förfrågan var missad läggs först i meddelandet. */
export function toPayload(r: QuoteRow) {
  const original = (r.message ?? "").trim();
  return {
    id: r.id,
    mode: r.mode === "configure" ? "configure" : "consultation",
    name: (r.name ?? "").trim(),
    phone: (r.phone ?? "").trim(),
    email: (r.email ?? "").trim(),
    address: r.address ?? null,
    current_roof: r.current_roof ?? null,
    new_roof: r.new_roof ?? null,
    raspont: r.raspont ?? null,
    gangbrygga: r.gangbrygga ?? null,
    takstege: r.takstege ?? null,
    avvattning: r.avvattning ?? null,
    floors: r.floors ?? null,
    message: `${NOTE}${r.created_at ? ` – mottagen ${r.created_at.slice(0, 16).replace("T", " ")} UTC` : ""}${original ? `\n${original}` : ""}`.slice(0, 5000),
    created_at: r.created_at ?? null,
  };
}

async function main() {
  const file = process.argv[2];
  const send = process.argv.includes("--send");
  if (!file) throw new Error("Ange JSON-fil med quote_requests-rader");
  const rows: QuoteRow[] = JSON.parse(readFileSync(file, "utf8"));
  const base = (process.env.CRM_URL || "https://admin-vt6.tejnevidar.workers.dev").replace(/\/$/, "");
  const delay = Number(process.env.DELAY_MS || 1500);
  const secret = process.env.WEBHOOK_SECRET;
  if (send && !secret) throw new Error("Sätt WEBHOOK_SECRET för --send");

  const todo = rows
    .filter((r) => r.id)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  const skipped = todo.filter(isTestRow);
  const real = todo.filter((r) => !isTestRow(r));
  console.log(`${send ? "SKICKAR" : "TORRKÖRNING"}: ${rows.length} rader, ${skipped.length} testrader hoppas över, ${real.length} att skicka.`);

  const counts: Record<string, number> = {};
  for (const r of real) {
    if (!send) {
      console.log(`  ${r.id}: skulle skickas`);
      continue;
    }
    const res = await fetch(`${base}/api/public/roslagstak-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret! },
      body: JSON.stringify(toPayload(r)),
    });
    let status = String(res.status);
    try {
      const j: any = await res.json();
      status = `${res.status} ${j.status ?? j.error ?? ""}`.trim();
    } catch {
      /* ignorera */
    }
    counts[status] = (counts[status] ?? 0) + 1;
    console.log(`  ${r.id}: ${status}`);
    if (res.status >= 500 || res.status === 401) throw new Error(`Avbryter: ${status}`);
    await new Promise((ok) => setTimeout(ok, delay));
  }
  if (send) console.log("Sammanfattning:", JSON.stringify(counts));
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  });
}
