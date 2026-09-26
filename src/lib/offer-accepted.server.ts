import { isOfferDocument, stageAfterSignature } from "@/lib/offer-accepted";

/**
 * Kundens signering -> leadens offer_accepted_at + rätt pipeline-steg (bokad), offertens status
 * och notis till säljare + admin. Får aldrig kasta: signeringen är redan genomförd.
 */
export async function markOfferAccepted(sb: any, row: any, signedAt: Date): Promise<void> {
  try {
    if (!row.lead_id || !isOfferDocument(row.document_type)) return;
    const iso = signedAt.toISOString();

    const { data: lead } = await sb
      .from("leads")
      .select("id, name, pipeline_stage, offer_accepted_at, seller_id, created_by")
      .eq("id", row.lead_id)
      .maybeSingle();
    if (!lead) return;

    const patch: Record<string, unknown> = {};
    if (!lead.offer_accepted_at) patch.offer_accepted_at = iso;
    const next = stageAfterSignature(lead.pipeline_stage);
    if (next) patch.pipeline_stage = next;
    if (Object.keys(patch).length) {
      const { error } = await sb.from("leads").update(patch).eq("id", lead.id);
      if (error) console.error("markOfferAccepted: lead update failed:", error.message);
    }

    const { data: offer } = await sb
      .from("offers")
      .select("id")
      .eq("lead_id", lead.id)
      .in("status", ["draft", "skickad"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (offer) await sb.from("offers").update({ status: "accepterad", accepted_at: iso }).eq("id", offer.id);

    await sb.from("lead_activities").insert({
      lead_id: lead.id,
      user_id: null,
      type: "updated",
      description: `Kunden signerade offert ${row.offer_number}${next ? " – leaden flyttad till Vunnen" : ""}`,
      metadata: { offer_accepted_at: iso, signature_request_id: row.id, source: "signering" },
    });

    const { sendAlert, loadConfig } = await import("@/lib/lead-intake.server");
    const cfg = await loadConfig(sb);
    await sendAlert(sb, cfg, {
      type: "offer_signed",
      leadId: lead.id,
      title: `Offert signerad: ${row.customer_name}`,
      body: `${row.customer_name} har signerat offert ${row.offer_number}. Leaden är flyttad till Vunnen.`,
      sellerId: lead.seller_id ?? lead.created_by ?? row.created_by,
      idempotencySuffix: row.id,
    });
  } catch (err) {
    console.error("markOfferAccepted failed:", err);
  }
}
