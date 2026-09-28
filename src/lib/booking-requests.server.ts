// Bokning av kostnadsfri takkontroll (Marknadschefens spec 2026-09-28, avstämt med Hemsida &
// SEO). Återanvänder ingestLead() för själva leaden (dedup, säljarrouting via
// lead_intake_config.default_seller_id/rules - redan byggt, ingen ny routinglogik här) och
// lägger till en booking_requests-rad ovanpå.
import { ingestLead, loadConfig, sendAlert } from "@/lib/lead-intake.server";
import { normalizeEmail } from "@/lib/lead-intake";
import { isWithinOpeningHours, nextOpeningTime, slaDeadline } from "@/lib/opening-hours";

export interface BookingInput {
  externalId: string;
  name: string;
  phone: string;
  email?: string | null;
  municipality?: string | null;
  slot: "formiddag" | "eftermiddag" | "ring_mig";
  date?: string | null;
  message?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; term?: string | null; content?: string | null };
}

export type BookingResult =
  | { status: "error"; message: string }
  | { status: "created" | "duplicate" | "merged"; leadId: string; slaPromisedAt: string };

async function loadBookingSlaConfig(supabase: any): Promise<{ callbackHours: number; confirmHours: number }> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "booking_sla_config").maybeSingle();
  const v = data?.value ?? {};
  return {
    callbackHours: typeof v.callback_hours === "number" ? v.callback_hours : 1,
    confirmHours: typeof v.confirm_hours === "number" ? v.confirm_hours : 2,
  };
}

const SLOT_LABEL: Record<BookingInput["slot"], string> = {
  formiddag: "förmiddag",
  eftermiddag: "eftermiddag",
  ring_mig: "ring mig",
};

export async function processBookingRequest(supabase: any, input: BookingInput): Promise<BookingResult> {
  const cfg = await loadConfig(supabase);
  const now = new Date();

  const summary =
    input.slot === "ring_mig"
      ? `Vill bli uppringd${input.message ? `: ${input.message}` : ""}`
      : `Bokad takkontroll ${input.date ?? ""} (${SLOT_LABEL[input.slot]})${input.message ? ` - ${input.message}` : ""}`;

  const result = await ingestLead(supabase, cfg, {
    source: "roslagstak",
    sourceLabel: "Hemsidan (bokning)",
    externalId: `booking:${input.externalId}`,
    name: input.name,
    phone: input.phone,
    email: normalizeEmail(input.email ?? null),
    address: input.municipality ?? null,
    status: "hot",
    notes: `📅 ${summary}`,
    summary,
    mergeNote: `📅 Ny bokningsförfrågan: ${summary}`,
    meta: { channel: "bokning", slot: input.slot, date: input.date ?? null, utm: input.utm ?? null },
  });
  if (result.status === "error") return result;

  const { callbackHours, confirmHours } = await loadBookingSlaConfig(supabase);
  const slaHours = input.slot === "ring_mig" ? callbackHours : confirmHours;
  const promisedAt = slaDeadline(now, slaHours);

  const { error: bookErr } = await supabase.from("booking_requests").insert({
    lead_id: result.leadId,
    slot: input.slot,
    requested_date: input.slot === "ring_mig" ? null : input.date ?? null,
    utm_source: input.utm?.source ?? null,
    utm_medium: input.utm?.medium ?? null,
    utm_campaign: input.utm?.campaign ?? null,
    utm_term: input.utm?.term ?? null,
    utm_content: input.utm?.content ?? null,
  });
  // En redan öppen ("ny") bokning för samma lead är inget fel (unik-indexet slår till vid
  // t.ex. dubbla klick) - allt annat är ett riktigt fel som ska synas i webhook_logs hos den
  // anropande routen.
  if (bookErr && bookErr.code !== "23505") return { status: "error", message: bookErr.message };

  // Notis till säljaren med bokningsdetaljerna (utöver ingestLead()s generella "ny lead"/
  // "kund hörde av sig igen"-notis) - annars syns bara att det är en lead, inte vad kunden
  // faktiskt bokat. Utanför öppettid nämns nästa öppning explicit i texten.
  const fmt = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
  const outsideHours = !isWithinOpeningHours(now);
  const { data: leadRow } = await supabase.from("leads").select("seller_id").eq("id", result.leadId).maybeSingle();
  await sendAlert(supabase, cfg, {
    type: "booking_new",
    leadId: result.leadId,
    sellerId: leadRow?.seller_id ?? null,
    title: input.slot === "ring_mig" ? "Ring mig-förfrågan" : `Bokad takkontroll: ${SLOT_LABEL[input.slot]}${input.date ? ` ${input.date}` : ""}`,
    body:
      input.slot === "ring_mig"
        ? `Ring upp senast ${fmt(promisedAt)}.${outsideHours ? ` (Kom in utanför öppettid, nästa öppning ${fmt(nextOpeningTime(now))}.)` : ""}`
        : `Bekräfta bokningen senast ${fmt(promisedAt)}.${outsideHours ? ` (Kom in utanför öppettid.)` : ""}`,
    sellerBody: input.slot === "ring_mig" ? `Ring ${input.name} senast ${fmt(promisedAt)}.` : `Bekräfta bokningen med ${input.name} senast ${fmt(promisedAt)}.`,
    details: [`Kanal: Hemsidan (bokning)`, `Telefon: ${input.phone}`],
    idempotencySuffix: `booking-${input.externalId}`,
  });

  return { status: result.status as "created" | "duplicate" | "merged", leadId: result.leadId, slaPromisedAt: promisedAt.toISOString() };
}
