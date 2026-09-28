// Omdömesflöde (Marknadschefens spec 2026-09-28): flaggar leads "redo" för en omdömesförfrågan
// N dagar efter customer_paid_at, men skickar ALDRIG något till kunden själv - det är en
// separat, manuell knapp (sendReviewRequest i review-requests.functions.ts), avstängd tills
// Vidar godkänt mall-texten i app_settings.review_request_config.template.

export interface ReviewRequestConfig {
  delayDays: number;
  template: string | null;
  googleReviewUrl: string | null;
}

export async function loadReviewRequestConfig(supabase: any): Promise<ReviewRequestConfig> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "review_request_config").maybeSingle();
  const v = data?.value ?? {};
  return {
    delayDays: typeof v.delay_days === "number" ? v.delay_days : 3,
    template: typeof v.template === "string" && v.template.trim() ? v.template : null,
    googleReviewUrl: typeof v.google_review_url === "string" && v.google_review_url.trim() ? v.google_review_url : null,
  };
}

/** Sant bara när Vidar godkänt en mall och en riktig Google-recensionslänk finns. */
export function isReviewRequestReady(cfg: ReviewRequestConfig): boolean {
  return !!cfg.template && !!cfg.googleReviewUrl;
}

export interface ReviewReadyResult {
  checked: number;
  flagged: number;
}

/** Daglig cron: flaggar betalda jobb "redo" för omdöme. Skickar INGET till kunden. */
export async function processReviewReady(supabase: any): Promise<ReviewReadyResult> {
  const cfg = await loadReviewRequestConfig(supabase);
  const cutoff = new Date(Date.now() - cfg.delayDays * 86400000).toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, seller_id, customer_paid_at")
    .eq("review_status", "ej_aktuellt")
    .eq("review_opt_out", false)
    .not("customer_paid_at", "is", null)
    .lte("customer_paid_at", cutoff);
  if (error) throw new Error(error.message);

  let flagged = 0;
  for (const lead of (leads ?? []) as { id: string; name: string; seller_id: string | null }[]) {
    const { error: updErr } = await supabase
      .from("leads")
      .update({ review_status: "redo", review_requested_at: new Date().toISOString() })
      .eq("id", lead.id)
      .eq("review_status", "ej_aktuellt");
    if (updErr) continue;
    if (lead.seller_id) {
      await supabase.from("notifications").insert({
        user_id: lead.seller_id,
        type: "review_ready",
        title: "Redo att be om omdöme",
        body: `${lead.name} betalade för ${cfg.delayDays}+ dagar sedan. Be om ett Google-omdöme.`,
        link: `/leads?lead=${lead.id}`,
      });
    }
    flagged++;
  }
  return { checked: (leads ?? []).length, flagged };
}
