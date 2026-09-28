// Manuell knapp: skickar omdömesförfrågan (mall + Google-recensionslänk) till en kund vars
// lead är "redo". Vägrar tills Vidar godkänt en mall (isReviewRequestReady) - se
// review-requests.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isReviewRequestReady, loadReviewRequestConfig } from "@/lib/review-requests.server";

export const sendReviewRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => {
    if (!input?.leadId) throw new Error("leadId saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const cfg = await loadReviewRequestConfig(sb);
    if (!isReviewRequestReady(cfg)) {
      throw new Error("Omdömesmallen eller Google-länken är inte ifylld ännu - fråga Vidar/Driftchefen.");
    }

    const { data: lead, error } = await sb
      .from("leads")
      .select("id, name, email, phone, review_status, review_opt_out")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error || !lead) throw new Error("Leaden hittades inte");
    if (lead.review_opt_out) throw new Error("Kunden har tackat nej till att bli kontaktad om omdöme");
    if (lead.review_status !== "redo") throw new Error("Leaden är inte redo för omdömesförfrågan än");
    if (!lead.email) throw new Error("Kunden saknar e-post");

    const { queueEmail } = await import("@/lib/signing.server");
    const res = await queueEmail(sb, {
      templateName: "review-request",
      recipientEmail: lead.email,
      idempotencyKey: `review-req-${lead.id}`,
      templateData: { customerName: lead.name, reviewUrl: cfg.googleReviewUrl, bodyText: cfg.template },
    });
    if (!res.ok) throw new Error("Kunde inte skicka: " + (res.error ?? ""));

    await sb
      .from("leads")
      .update({ review_status: "skickad", review_sent_at: new Date().toISOString() })
      .eq("id", lead.id)
      .eq("review_status", "redo");

    return { ok: true };
  });

export const markReviewReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => {
    if (!input?.leadId) throw new Error("leadId saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("leads")
      .update({ review_status: "mottagen", review_received_at: new Date().toISOString() })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setReviewOptOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; optOut: boolean }) => {
    if (!input?.leadId) throw new Error("leadId saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { review_opt_out: data.optOut };
    if (data.optOut) patch.review_status = "avbojd";
    const { error } = await (supabaseAdmin as any).from("leads").update(patch).eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
