// Arbetsorder: skapas när en offert signeras, skickas till godkänd UE, accepteras digitalt och
// blir ett jobb. Utan svar i tid går den vidare till nästa UE, annars larm till admin.
// All skrivning sker här med service role (RLS ger UE/säljare bara läsning).

import { sendAndLogEmail } from "@/lib/email-send-log.server";
import { loadConfig, sendAlert } from "@/lib/lead-intake.server";
import {
  buildWorkOrderContent,
  offerExpiry,
  pickNextSubcontractor,
  REQUIREMENT_LABELS,
  upcomingExpiries,
  validateAcceptance,
  type Personnel,
  type WorkOrderContent,
} from "@/lib/work-order";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://admin-vt6.tejnevidar.workers.dev").replace(/\/$/, "");
const CONFIG_KEY = "ue_dispatch_config";

const kr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
const stockholm = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(d);

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadDispatchConfig(sb: any): Promise<{ acceptHours: number }> {
  const { data } = await sb.from("app_settings").select("value").eq("key", CONFIG_KEY).maybeSingle();
  const h = Number((data?.value as any)?.accept_hours);
  return { acceptHours: Number.isFinite(h) && h > 0 ? h : 24 };
}

export interface WorkOrderDefaults {
  liquidated_damages: { per_day: number | null; cap_pct: number | null } | null;
  payment: { days: number | null; retention_pct: number | null; retention_days: number | null } | null;
  client_org_number: string | null;
  framework_url: string | null;
  bas_p: string | null;
  bas_u: string | null;
}

export async function loadWorkOrderDefaults(sb: any): Promise<WorkOrderDefaults> {
  const { data } = await sb.from("app_settings").select("value").eq("key", "ue_work_order_defaults").maybeSingle();
  const v = (data?.value ?? {}) as Partial<WorkOrderDefaults>;
  return {
    liquidated_damages: v.liquidated_damages ?? null,
    payment: v.payment ?? null,
    client_org_number: v.client_org_number ?? null,
    framework_url: v.framework_url ?? null,
    bas_p: v.bas_p ?? null,
    bas_u: v.bas_u ?? null,
  };
}

/** Allt PDF:en och acceptsidan behöver för ett visst erbjudande (UE:s namn, org.nr, ramavtalsdatum). */
export async function workOrderPdfInput(sb: any, wo: any, offer: any | null) {
  const defaults = await loadWorkOrderDefaults(sb);
  let sub: any = null;
  const subId = offer?.subcontractor_id ?? wo.accepted_subcontractor_id ?? null;
  if (subId) {
    const { data } = await sb.from("subcontractors").select("company_name, org_number, agreement_signed_at").eq("id", subId).maybeSingle();
    sub = data;
  }
  // Villkorsfält som inte satts på arbetsordern faller tillbaka på standardvärdena.
  const content = {
    ...wo.content,
    liquidated_damages: wo.content?.liquidated_damages ?? defaults.liquidated_damages,
    payment: wo.content?.payment ?? defaults.payment,
    bas_p: wo.content?.bas_p ?? defaults.bas_p,
    bas_u: wo.content?.bas_u ?? defaults.bas_u,
  } as WorkOrderContent;
  return {
    content,
    uePrice: offer ? Number(offer.fixed_price) : wo.ue_price != null ? Number(wo.ue_price) : null,
    startDate: wo.start_date ?? null,
    endDate: wo.end_date ?? null,
    orderNumber: wo.order_number ?? null,
    subcontractor: sub ? { name: sub.company_name as string, orgNumber: (sub.org_number as string | null) ?? null } : null,
    frameworkDate: sub?.agreement_signed_at ?? null,
    clientOrgNumber: defaults.client_org_number,
    frameworkUrl: defaults.framework_url,
  };
}

async function notifyAdmin(sb: any, a: { type: string; title: string; body: string; leadId?: string | null; suffix: string }) {
  const cfg = await loadConfig(sb);
  await sendAlert(sb, cfg, {
    type: a.type,
    leadId: a.leadId ?? null,
    title: a.title,
    body: a.body,
    link: "/arbetsorder",
    idempotencySuffix: a.suffix,
  });
}

/** Skapar arbetsordern för en lead vars offert signerats. Idempotent. Får inte kasta. */
export async function createWorkOrderForLead(sb: any, leadId: string): Promise<{ id: string; status: string } | null> {
  try {
    const { data: existing } = await sb
      .from("work_orders")
      .select("id, status")
      .eq("lead_id", leadId)
      .neq("status", "cancelled")
      .maybeSingle();
    if (existing) return existing;

    const { data: lead } = await sb.from("leads").select("*, property:properties(*)").eq("id", leadId).maybeSingle();
    if (!lead) return null;

    const [{ data: calc }, { data: prices }, { data: docs }, { data: sig }] = await Promise.all([
      sb.from("calculations").select("*").eq("lead_id", leadId).maybeSingle(),
      sb.from("price_list").select("key, label, unit"),
      sb.from("lead_documents").select("file_path, file_name, mime_type").eq("lead_id", leadId),
      sb.from("signature_requests").select("offer_number").eq("lead_id", leadId).eq("status", "signed").order("customer_signed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const sellerId = lead.seller_id ?? lead.created_by;
    let seller = { name: "VT6 Invest", phone: null as string | null, email: null as string | null };
    if (sellerId) {
      const { data: prof } = await sb.from("profiles").select("display_name, email").eq("id", sellerId).maybeSingle();
      let phone: string | null = null;
      if (prof?.email) {
        const { data: emp } = await sb.from("employees").select("phone").eq("email", prof.email).maybeSingle();
        phone = emp?.phone ?? null;
      }
      seller = { name: prof?.display_name || prof?.email || "VT6 Invest", phone, email: prof?.email ?? null };
    }

    const property = lead.property ?? {};
    const content = buildWorkOrderContent({
      offerNumber: sig?.offer_number ?? null,
      address: [property.address ?? lead.address, property.municipality].filter(Boolean).join(", ") || "Adress saknas",
      municipality: property.municipality ?? null,
      jobType: lead.job_type ?? null,
      calc: calc ?? null,
      prices: prices ?? [],
      seller,
      documents: docs ?? [],
      // Leadens interna anteckningar (kunduppgifter, priser, kommentarer) ska aldrig till UE.
      // Admin skriver egna instruktioner till UE på /arbetsorder.
      notes: null,
    });

    const uePrice = Number(lead.subcontractor_price) > 0 ? Number(lead.subcontractor_price) : null;
    const { data: wo, error } = await sb
      .from("work_orders")
      .insert({ lead_id: leadId, content, ue_price: uePrice, status: "draft" })
      .select("id, status")
      .single();
    if (error) {
      console.error("createWorkOrderForLead insert failed:", error.message);
      return null;
    }

    // Start- och slutdatum är okända vid skapandet, så admin måste alltid komplettera innan utskick.
    await notifyAdmin(sb, {
      type: "work_order_needs_details",
      title: `Arbetsorder skapad: ange pris och datum`,
      body: `Offerten för ${content.address} är signerad. Ange UE:s fasta pris, startdatum och slutdatum på Arbetsorder, så skickas den automatiskt till nästa lediga UE.`,
      leadId,
      suffix: wo.id,
    });
    return wo;
  } catch (err) {
    console.error("createWorkOrderForLead failed:", err);
    return null;
  }
}

/** Skickar arbetsordern till nästa godkända UE. Ingen UE kvar -> status 'unassigned' + larm. */
export async function dispatchWorkOrder(sb: any, workOrderId: string): Promise<"offered" | "unassigned" | "skipped"> {
  const { data: wo } = await sb.from("work_orders").select("*").eq("id", workOrderId).maybeSingle();
  if (!wo || !["draft", "offered", "unassigned"].includes(wo.status)) return "skipped";
  // Pris, startdatum och slutdatum krävs före utskick. Saknas något larmas admin.
  const missing = [
    !(Number(wo.ue_price) > 0) ? "UE-pris" : "",
    !wo.start_date ? "startdatum" : "",
    !wo.end_date ? "slutdatum" : "",
  ].filter(Boolean);
  if (missing.length) {
    await notifyAdmin(sb, {
      type: "work_order_needs_details",
      title: "Arbetsordern kan inte skickas än",
      body: `Saknas för ${(wo.content as WorkOrderContent).address}: ${missing.join(", ")}. Komplettera på Arbetsorder så skickas den.`,
      leadId: wo.lead_id,
      suffix: `${wo.id}:${missing.join("+")}`,
    });
    return "skipped";
  }

  const { data: offers } = await sb.from("work_order_offers").select("subcontractor_id, status").eq("work_order_id", wo.id);
  if ((offers ?? []).some((o: any) => o.status === "pending")) return "skipped";
  const tried = new Set<string>((offers ?? []).map((o: any) => o.subcontractor_id));

  const { data: subs } = await sb.from("subcontractors").select("id, priority, created_at, company_name, email, user_id").eq("active", true);
  const cands = [];
  for (const s of subs ?? []) {
    const { data: missing } = await sb.rpc("ue_missing_requirements", { _sub: s.id });
    cands.push({ id: s.id, priority: s.priority ?? 100, created_at: s.created_at, missing: (missing ?? []) as string[] });
  }
  const nextId = pickNextSubcontractor(cands, tried);
  const content = wo.content as WorkOrderContent;

  if (!nextId) {
    await sb.from("work_orders").update({ status: "unassigned" }).eq("id", wo.id);
    await notifyAdmin(sb, {
      type: "work_order_unassigned",
      title: "Ingen UE tillgänglig för arbetsordern",
      body: `Ingen godkänd UE finns kvar att fråga för ${content.address}. Tilldela manuellt eller åtgärda en UE:s krav.`,
      leadId: wo.lead_id,
      suffix: `${wo.id}:${tried.size}`,
    });
    return "unassigned";
  }

  const sub = (subs ?? []).find((s: any) => s.id === nextId);
  const { acceptHours } = await loadDispatchConfig(sb);
  const now = new Date();
  const expires = offerExpiry(now, acceptHours);
  const token = randomToken();
  const { error } = await sb.from("work_order_offers").insert({
    work_order_id: wo.id,
    subcontractor_id: nextId,
    token,
    fixed_price: wo.ue_price,
    expires_at: expires.toISOString(),
  });
  if (error) {
    console.error("dispatchWorkOrder offer insert failed:", error.message);
    return "skipped";
  }
  await sb.from("work_orders").update({ status: "offered" }).eq("id", wo.id);

  const url = `${SITE_URL}/arbetsorder/${token}`;
  if (sub.user_id) {
    await sb.from("notifications").insert({
      user_id: sub.user_id,
      type: "work_order_offer",
      title: "Nytt uppdrag",
      body: `${wo.order_number ? `${wo.order_number}: ` : ""}${content.address} - fast pris ${kr(Number(wo.ue_price))}. Svara senast ${stockholm(expires)}.`,
      link: "/ue",
    });
  }
  if (sub.email) {
    await sendAndLogEmail(sb, {
      templateName: "work-order-offer",
      recipientEmail: sub.email,
      idempotencyKey: `wo-offer:${token}`,
      templateData: {
        orderNumber: wo.order_number ?? undefined,
        address: content.address,
        price: kr(Number(wo.ue_price)),
        deadline: stockholm(expires),
        url,
        contact: [content.contact.name, content.contact.phone].filter(Boolean).join(", "),
      },
    });
  }
  return "offered";
}

export type RespondResult = { ok: true; status: "accepted" | "declined" } | { ok: false; error: string };

/** UE svarar på ett erbjudande (via mailtoken eller inloggad). Accept binder priset och skapar jobbet. */
export async function respondToOffer(
  sb: any,
  offerId: string,
  action: "accept" | "decline",
  reason?: string | null,
  acceptance?: { termsAccepted?: boolean; acceptedBy?: string; personnel?: Personnel[] },
): Promise<RespondResult> {
  const { data: offer } = await sb.from("work_order_offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) return { ok: false, error: "not_found" };
  if (offer.status !== "pending") return { ok: false, error: "already_answered" };
  if (new Date(offer.expires_at).getTime() < Date.now()) return { ok: false, error: "expired" };
  const { data: wo } = await sb.from("work_orders").select("*").eq("id", offer.work_order_id).maybeSingle();
  if (!wo || wo.status !== "offered") return { ok: false, error: "closed" };
  const content = wo.content as WorkOrderContent;
  const now = new Date().toISOString();

  if (action === "decline") {
    await sb
      .from("work_order_offers")
      .update({ status: "declined", responded_at: now, decline_reason: reason?.slice(0, 500) ?? null })
      .eq("id", offer.id);
    await notifyAdmin(sb, {
      type: "work_order_declined",
      title: "UE avböjde arbetsordern",
      body: `En UE avböjde ${content.address}${reason ? `: ${reason}` : ""}. Den går automatiskt vidare till nästa UE.`,
      leadId: wo.lead_id,
      suffix: offer.id,
    });
    await dispatchWorkOrder(sb, wo.id);
    return { ok: true, status: "declined" };
  }

  // Accept: kryssruta, namn och minst en person på plats krävs, annars binder inte accepten.
  const bad = validateAcceptance(acceptance ?? {});
  if (bad) return { ok: false, error: bad };
  const personnel = (acceptance!.personnel ?? []).filter((p) => p.name?.trim()).map((p) => ({ name: p.name.trim().slice(0, 120), status: p.status }));
  const acceptedBy = acceptance!.acceptedBy!.trim().slice(0, 120);

  // Kontrollera kraven igen, det kan ha gått ut sedan utskicket.
  const { data: missing } = await sb.rpc("ue_missing_requirements", { _sub: offer.subcontractor_id });
  if (Array.isArray(missing) && missing.length) return { ok: false, error: "requirements:" + missing.join(",") };
  const { data: sub } = await sb.from("subcontractors").select("id, company_name, user_id").eq("id", offer.subcontractor_id).maybeSingle();
  if (!sub?.user_id) return { ok: false, error: "requirements:inloggning" };

  const { data: lead } = await sb.from("leads").select("id, name, job_type, seller_id, created_by").eq("id", wo.lead_id).maybeSingle();
  const { data: job, error: jobErr } = await sb
    .from("jobs")
    .upsert(
      {
        lead_id: wo.lead_id,
        assigned_to: sub.user_id,
        assignment_type: "underentreprenor",
        subcontractor_id: sub.id,
        fixed_price: offer.fixed_price,
        address: content.address,
        job_type: lead?.job_type ?? null,
        customer_name: lead?.name ?? null,
      },
      { onConflict: "lead_id" },
    )
    .select("id")
    .single();
  if (jobErr) return { ok: false, error: "job_failed:" + jobErr.message };

  await sb
    .from("leads")
    .update({
      assigned_to: sub.user_id,
      assignment_type: "underentreprenor",
      subcontractor_name: sub.company_name,
      subcontractor_price: offer.fixed_price,
    })
    .eq("id", wo.lead_id);

  await sb
    .from("work_order_offers")
    .update({ status: "accepted", responded_at: now, accepted_by: acceptedBy, terms_accepted_at: now, personnel })
    .eq("id", offer.id);
  await sb
    .from("work_order_offers")
    .update({ status: "cancelled" })
    .eq("work_order_id", wo.id)
    .eq("status", "pending")
    .neq("id", offer.id);
  await sb
    .from("work_orders")
    .update({
      status: "accepted",
      job_id: job.id,
      accepted_subcontractor_id: sub.id,
      accepted_by: acceptedBy,
      accepted_at: now,
      terms_accepted_at: now,
      personnel,
    })
    .eq("id", wo.id);

  // Accepterad version av PDF:en (med "Accepterad av ... datum") sparas i dokumenten. Icke-kritiskt.
  try {
    const { buildWorkOrderPdf } = await import("@/lib/work-order-pdf.server");
    const input = await workOrderPdfInput(sb, { ...wo, accepted_subcontractor_id: sub.id }, offer);
    const bytes = await buildWorkOrderPdf({ ...input, accepted: { by: acceptedBy, at: stockholm(new Date(now)), personnel } });
    const path = `arbetsorder/${wo.id}/accepterad-${wo.order_number ?? wo.id.slice(0, 8)}.pdf`;
    const { error: upErr } = await sb.storage.from("offers").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) console.error("accepted pdf upload failed:", upErr.message);
    else await sb.from("work_orders").update({ accepted_pdf_path: path }).eq("id", wo.id);
  } catch (err) {
    console.error("accepted pdf failed:", err);
  }

  const cfg = await loadConfig(sb);
  await sendAlert(sb, cfg, {
    type: "work_order_accepted",
    leadId: wo.lead_id,
    title: `Arbetsorder accepterad: ${content.address}`,
    body: `${sub.company_name} har accepterat ${content.address} till fast pris ${kr(Number(offer.fixed_price))}. Jobbet är skapat.`,
    sellerBody: `${sub.company_name} utför jobbet på ${content.address}. Du är kundens kontaktperson.`,
    sellerId: lead?.seller_id ?? lead?.created_by ?? null,
    idempotencySuffix: offer.id,
  });
  return { ok: true, status: "accepted" };
}

/** Cron: utgångna erbjudanden går vidare till nästa UE (eller larm till admin). */
export async function processWorkOrderTimeouts(sb: any): Promise<{ expired: number; redispatched: number }> {
  const { data: due } = await sb
    .from("work_order_offers")
    .select("id, work_order_id")
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  let redispatched = 0;
  for (const o of due ?? []) {
    await sb.from("work_order_offers").update({ status: "expired", responded_at: new Date().toISOString() }).eq("id", o.id).eq("status", "pending");
    const r = await dispatchWorkOrder(sb, o.work_order_id);
    if (r === "offered") redispatched++;
  }
  return { expired: (due ?? []).length, redispatched };
}

/** Cron (dagligen): larm när försäkring, ID06, A1 eller UE-dokument går ut. */
export async function processUeCompliance(sb: any, today = new Date()): Promise<{ alerts: number }> {
  const { data: subs } = await sb
    .from("subcontractors")
    .select("id, company_name, active, insurance_expires_at, id06_valid_until, a1_valid_until, is_posted_worker");
  const { data: docs } = await sb.from("subcontractor_documents").select("doc_type, valid_until, subcontractor_id");
  const names = new Map<string, string>((subs ?? []).map((s: any) => [s.id, s.company_name]));
  const flat = (docs ?? []).map((d: any) => ({ company_name: names.get(d.subcontractor_id) ?? "UE", doc_type: d.doc_type, valid_until: d.valid_until }));
  const items = upcomingExpiries(subs ?? [], flat, today, 30);
  // Larma vid fasta tidpunkter så att samma sak inte larmar varje dag.
  const marks = new Set([30, 14, 7, 3, 1, 0, -1, -7]);
  const due = items.filter((i) => marks.has(i.daysLeft));
  if (!due.length) return { alerts: 0 };
  const lines = due.map((i) => `${i.subcontractor}: ${i.what} ${i.daysLeft < 0 ? "gick ut" : "går ut"} ${i.date} (${i.daysLeft} dagar)`);
  await notifyAdmin(sb, {
    type: "ue_expiry",
    title: `UE-krav som går ut (${due.length})`,
    body: lines.join("\n"),
    suffix: today.toISOString().slice(0, 10),
  });
  return { alerts: due.length };
}

export const explainMissing = (missing: string[]) => missing.map((m) => REQUIREMENT_LABELS[m] ?? m);
