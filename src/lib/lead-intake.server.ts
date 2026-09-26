// Gemensam intag för alla kanaler (hemsidan, mail, generell ingång): dubblettskydd,
// säljarrouting, notis (klockan + mail) och larm. Ren logik ligger i lead-intake.ts.

import { sendAndLogEmail } from "@/lib/email-send-log.server";
import {
  findDuplicate,
  isBusinessHour,
  parseConfig,
  pickSeller,
  type LeadIntakeConfig,
  normalizeEmail,
} from "@/lib/lead-intake";

const CONFIG_KEY = "lead_intake_config";
const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://admin-vt6.tejnevidar.workers.dev").replace(/\/$/, "");
const DUPLICATE_WINDOW_DAYS = 60;
const CLOSED_STAGES = ["slutford", "forlorad"];

export type IntakeSource = "roslagstak" | "email" | "inbox";

export async function loadConfig(supabase: any): Promise<LeadIntakeConfig> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", CONFIG_KEY).maybeSingle();
  return parseConfig(data?.value);
}

async function adminUserIds(supabase: any, cfg: LeadIntakeConfig): Promise<string[]> {
  if (cfg.adminUserIds) return cfg.adminUserIds;
  const { data } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

async function profileEmail(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

const leadLink = (leadId: string) => `/leads?lead=${leadId}`;

export interface AlertInput {
  /** Unik typ per händelse, används för notisens type och för dedupe. */
  type: string;
  leadId?: string | null;
  title: string;
  body: string;
  /** Texten säljaren ser (t.ex. uppmaning att kontakta kunden). Standard: samma som body. */
  sellerBody?: string;
  sellerId?: string | null;
  /** Skicka även till admin (klockan + mail). */
  toAdmin?: boolean;
  intro?: string;
  details?: string[];
  idempotencySuffix?: string;
  /** Egen länk (relativ sökväg) istället för leadens sida. */
  link?: string;
}

/** Skickar notis i klockan och mail till admin och/eller ansvarig säljare. Får aldrig kasta. */
export async function sendAlert(supabase: any, cfg: LeadIntakeConfig, a: AlertInput): Promise<void> {
  try {
    const link = a.link ?? (a.leadId ? leadLink(a.leadId) : "/webhook-logs");
    const admins = a.toAdmin === false ? [] : await adminUserIds(supabase, cfg);
    const recipients: { userId: string; body: string; isSeller: boolean }[] = admins.map((userId) => ({
      userId,
      body: a.body,
      isSeller: false,
    }));
    if (a.sellerId && !admins.includes(a.sellerId)) {
      recipients.push({ userId: a.sellerId, body: a.sellerBody ?? a.body, isSeller: true });
    }
    if (recipients.length) {
      const { error } = await supabase.from("notifications").insert(
        recipients.map((r) => ({ user_id: r.userId, type: a.type, title: a.title, body: r.body, link })),
      );
      if (error) console.error("notifications insert failed:", error.message);
    }

    const emails: { to: string; body: string }[] = [];
    if (a.toAdmin !== false) emails.push({ to: cfg.adminEmail, body: a.body });
    if (a.sellerId) {
      const sellerMail = await profileEmail(supabase, a.sellerId);
      if (sellerMail && !emails.some((e) => e.to.toLowerCase() === sellerMail.toLowerCase())) {
        emails.push({ to: sellerMail, body: a.sellerBody ?? a.body });
      }
    }
    for (const e of emails) {
      await sendAndLogEmail(supabase, {
        templateName: "lead-alert",
        recipientEmail: e.to,
        templateData: {
          heading: a.title,
          intro: e.body,
          details: a.details ?? [],
          link: `${SITE_URL}${link}`,
        },
        idempotencyKey: `${a.type}:${a.leadId ?? "sys"}:${a.idempotencySuffix ?? ""}:${e.to}`,
      });
    }
  } catch (err) {
    console.error("sendAlert failed:", err);
  }
}

export interface IngestInput {
  source: IntakeSource;
  /** Läsbar kanal i notiser, t.ex. "Hemsidan", "Mail (info@)", "Meta". */
  sourceLabel: string;
  externalId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  roofType?: string | null;
  status?: "hot" | "warm";
  jobType?: "roof_replacement" | "roof_cleaning" | "light_roof_work";
  notes: string;
  /** Kort text för notiser (ämne eller början av meddelandet). */
  summary: string;
  /** Text som läggs som anteckning om kunden redan har en öppen lead. */
  mergeNote: string;
  /** Spårningsdata (kanal, kampanj, utm ...) som sparas på leadens första aktivitet. */
  meta?: Record<string, unknown>;
}

export type IngestResult =
  | { status: "created" | "merged" | "duplicate"; leadId: string }
  | { status: "error"; stage: string; message: string };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function ingestLead(supabase: any, cfg: LeadIntakeConfig, input: IngestInput): Promise<IngestResult> {
  // 1. Samma inkommande händelse en gång till (retry): gör inget.
  const { data: same } = await supabase.from("leads").select("id").eq("external_id", input.externalId).maybeSingle();
  if (same) return { status: "duplicate", leadId: same.id };
  const { data: sameAct } = await supabase
    .from("lead_activities")
    .select("lead_id")
    .filter("metadata->>external_id", "eq", input.externalId)
    .limit(1)
    .maybeSingle();
  if (sameAct) return { status: "duplicate", leadId: sameAct.lead_id };

  // 2. Samma person finns redan som öppen lead: lägg förfrågan som anteckning.
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86400000).toISOString();
  const { data: candidates } = await supabase
    .from("leads")
    .select("id, name, email, phone, seller_id, pipeline_stage")
    .gte("created_at", since)
    .not("pipeline_stage", "in", `(${CLOSED_STAGES.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(1500);
  const dup = findDuplicate((candidates ?? []) as any[], { email: input.email, phone: input.phone });
  if (dup) {
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: dup.id,
      type: "note",
      description: input.mergeNote,
      metadata: { ...input.meta, source: input.source, external_id: input.externalId, merged: true },
      user_id: null,
    });
    if (error) return { status: "error", stage: "activity_insert_failed", message: error.message };
    await sendAlert(supabase, cfg, {
      type: "lead_repeat",
      leadId: dup.id,
      title: `Ny förfrågan från befintlig lead: ${dup.name}`,
      body: `${dup.name} hörde av sig igen via ${input.sourceLabel}: ${clip(input.summary, 160)}`,
      sellerId: dup.seller_id,
      details: [`Kanal: ${input.sourceLabel}`, `Steg: ${dup.pipeline_stage}`],
      idempotencySuffix: input.externalId,
    });
    return { status: "merged", leadId: dup.id };
  }

  // 3. Ny lead. Säljare väljs efter område (adress), annars standardsäljaren.
  const sellerId = pickSeller(cfg, [input.address, input.notes].filter(Boolean).join(" "));
  const { data: property, error: propErr } = await supabase
    .from("properties")
    .insert({
      address: input.address || `Adress saknas (${input.sourceLabel.toLowerCase()})`,
      municipality: "",
      region: "Stockholm",
      roof_type: input.roofType ?? null,
    })
    .select("id")
    .single();
  if (propErr) return { status: "error", stage: "property_insert_failed", message: propErr.message };

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      property_id: property.id,
      name: input.name,
      phone: input.phone ?? null,
      email: normalizeEmail(input.email),
      status: input.status ?? "hot",
      source: input.source,
      job_type: input.jobType ?? "roof_replacement",
      pipeline_stage: "inkommande_webb",
      notes: input.notes,
      external_id: input.externalId,
      seller_id: sellerId,
    })
    .select("id")
    .single();
  if (leadErr) return { status: "error", stage: "lead_insert_failed", message: leadErr.message };

  await supabase.from("lead_activities").insert({
    lead_id: lead.id,
    type: "created",
    description: `📥 Lead skapad via ${input.sourceLabel}`,
    metadata: { ...input.meta, source: input.source, external_id: input.externalId },
    user_id: null,
  });

  const details = [
    `Kanal: ${input.sourceLabel}`,
    input.phone ? `Telefon: ${input.phone}` : "",
    normalizeEmail(input.email) ? `E-post: ${normalizeEmail(input.email)}` : "",
    input.address ? `Adress: ${input.address}` : "",
    input.summary ? `Meddelande: ${clip(input.summary, 300)}` : "",
  ].filter(Boolean);
  await sendAlert(supabase, cfg, {
    type: "lead_new",
    leadId: lead.id,
    title: `Ny lead: ${input.name}`,
    body: `Ny förfrågan via ${input.sourceLabel}. Kontakta kunden så snabbt som möjligt.`,
    sellerId,
    details,
    idempotencySuffix: input.externalId,
  });
  return { status: "created", leadId: lead.id };
}

// ---------------------------------------------------------------------------
// Larm-jobb (körs var 10:e minut): SLA-påminnelse, tystnadslarm, intagsfel.
// ---------------------------------------------------------------------------

const INTAKE_SOURCES = ["roslagstak", "email", "inbox"];
const SLA_LOOKBACK_HOURS = 72;

export interface LeadAlertResult {
  slaAlerts: number;
  silenceAlert: boolean;
  errorAlert: boolean;
}

async function alreadySent(supabase: any, type: string, opts: { link?: string; sinceHours?: number }): Promise<boolean> {
  let q = supabase.from("notifications").select("id", { count: "exact", head: true }).eq("type", type);
  if (opts.link) q = q.eq("link", opts.link);
  if (opts.sinceHours) q = q.gte("created_at", new Date(Date.now() - opts.sinceHours * 3600000).toISOString());
  const { count } = await q;
  return (count ?? 0) > 0;
}

export async function processLeadAlerts(supabase: any): Promise<LeadAlertResult> {
  const cfg = await loadConfig(supabase);
  const now = Date.now();
  const result: LeadAlertResult = { slaAlerts: 0, silenceAlert: false, errorAlert: false };

  // 1. SLA: nya leads som ingen ur personalen rört inom slaHours.
  const olderThan = new Date(now - cfg.slaHours * 3600000).toISOString();
  const newerThan = new Date(now - SLA_LOOKBACK_HOURS * 3600000).toISOString();
  const { data: open } = await supabase
    .from("leads")
    .select("id, name, seller_id, created_at, last_contact, source")
    .eq("pipeline_stage", "inkommande_webb")
    .in("source", INTAKE_SOURCES)
    .is("last_contact", null)
    .lte("created_at", olderThan)
    .gte("created_at", newerThan);
  for (const lead of (open ?? []) as any[]) {
    if (await alreadySent(supabase, "lead_sla", { link: leadLink(lead.id) })) continue;
    const { count: staffActs } = await supabase
      .from("lead_activities")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .not("user_id", "is", null)
      .gte("created_at", lead.created_at);
    if ((staffActs ?? 0) > 0) continue; // någon har redan hanterat leaden
    const hours = Math.round((now - new Date(lead.created_at).getTime()) / 3600000);
    await sendAlert(supabase, cfg, {
      type: "lead_sla",
      leadId: lead.id,
      title: `Ingen har kontaktat ${lead.name}`,
      body: `Leaden har legat obesvarad i ${hours} tim. Ring kunden nu.`,
      sellerBody: `Kontakta ${lead.name} nu. Förfrågan har väntat i ${hours} tim.`,
      sellerId: lead.seller_id,
      details: lead.seller_id ? [] : ["Ingen säljare är tilldelad leaden."],
    });
    result.slaAlerts++;
  }

  // 2. Tystnad: inga nya leads på länge (endast dagtid).
  if (isBusinessHour(new Date(now))) {
    const { data: latest } = await supabase
      .from("leads")
      .select("created_at")
      .in("source", INTAKE_SOURCES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastAt = latest?.created_at ? new Date(latest.created_at).getTime() : 0;
    const silentHours = (now - lastAt) / 3600000;
    if (silentHours >= cfg.silenceHours && !(await alreadySent(supabase, "lead_silence", { sinceHours: cfg.silenceHours }))) {
      await sendAlert(supabase, cfg, {
        type: "lead_silence",
        title: "Inga nya leads på länge",
        body: `Det har inte kommit någon ny förfrågan på ${Math.round(silentHours)} tim. Kontrollera hemsidans formulär, annonserna och mailkopplingen.`,
        idempotencySuffix: String(Math.floor(now / (cfg.silenceHours * 3600000))),
      });
      result.silenceAlert = true;
    }
  }

  // 3. Intagsfel: misslyckade webhook-anrop senaste timmen.
  const { count: failures } = await supabase
    .from("webhook_logs")
    .select("id", { count: "exact", head: true })
    .gte("status_code", 500)
    .gte("created_at", new Date(now - 3600000).toISOString());
  if ((failures ?? 0) > 0 && !(await alreadySent(supabase, "lead_intake_error", { sinceHours: 1 }))) {
    await sendAlert(supabase, cfg, {
      type: "lead_intake_error",
      title: "Fel vid mottagning av leads",
      body: `${failures} förfrågan(ar) kunde inte tas emot senaste timmen. Se Webhook-loggar i CRM:et.`,
      idempotencySuffix: String(Math.floor(now / 3600000)),
    });
    result.errorAlert = true;
  }

  return result;
}
