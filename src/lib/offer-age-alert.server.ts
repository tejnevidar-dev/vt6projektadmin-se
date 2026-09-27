// Daily cron equivalent of processStaleLeadReminders (same pattern). Flags offers stuck in
// 'skickad' for too long and drops an in-app notification for the assigned seller -- no
// email/SMS to the seller, and nothing at all to the customer.

import { DEFAULT_OFFER_AGE_ALERT_DAYS, findStaleOffers, type OfferLeadInfo } from "@/lib/offer-age-alert";

export interface OfferAgeAlertResult {
  checked: number;
  notified: number;
}

export async function processOfferAgeAlerts(supabase: any): Promise<OfferAgeAlertResult> {
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "offer_age_alert_days")
    .maybeSingle();
  const alertDays = typeof setting?.value === "number" ? setting.value : DEFAULT_OFFER_AGE_ALERT_DAYS;

  const { data: offers, error } = await supabase
    .from("offers")
    .select("id, lead_id, status, sent_at")
    .eq("status", "skickad");
  if (error) throw new Error(error.message);
  if (!offers?.length) return { checked: 0, notified: 0 };

  const leadIds = [...new Set((offers as { lead_id: string }[]).map((o) => o.lead_id))];
  const { data: leads } = await supabase.from("leads").select("id, seller_id, name").in("id", leadIds);
  const leadInfo = new Map<string, OfferLeadInfo>(
    ((leads ?? []) as { id: string; seller_id: string | null; name: string }[]).map((l) => [
      l.id,
      { seller_id: l.seller_id, name: l.name },
    ]),
  );

  const now = new Date();
  const stale = findStaleOffers(offers, leadInfo, alertDays, now);

  let notified = 0;
  for (const s of stale) {
    // Avoid re-notifying every single day once already flagged today.
    const { count: alreadyToday } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", s.sellerId)
      .eq("type", "offer_stale")
      .eq("link", `/leads?lead=${s.leadId}`)
      .gte("created_at", new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString());
    if (alreadyToday && alreadyToday > 0) continue;

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: s.sellerId,
      type: "offer_stale",
      title: "Offert utan svar",
      body: `Offert till ${s.leadName} har väntat på svar i ${s.daysWaiting}+ dagar.`,
      link: `/leads?lead=${s.leadId}`,
    });
    if (!insertError) notified++;
  }

  return { checked: stale.length, notified };
}
