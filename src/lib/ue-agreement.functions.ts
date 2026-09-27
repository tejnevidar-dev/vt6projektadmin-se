// Digital signering av UE-ramavtalet. Bara admin. Skiljer sig från signing.functions.ts
// (kundoffert) genom att det aldrig går via godkännande-flödet - VT6:s egen signatur (företagets
// sparade company_signature) läggs på direkt, för det är samma admin som skickar UE-avtalet.
// E-post till en riktig UE skickas ALDRIG automatiskt - sendUeAgreementEmail() är ett separat,
// explicit steg (precis som sendEmail-kryssrutan för kundofferter).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fillUeAgreement, hasUnresolvedPlaceholders, UE_AGREEMENT_DATE, UE_AGREEMENT_VERSION } from "@/lib/ue-agreement-text";

async function requireAdmin(userId: string) {
  const { isAdminUser } = await import("./signing.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!(await isAdminUser(supabaseAdmin, userId))) throw new Error("Bara admin");
  return supabaseAdmin as any;
}

export interface UeAgreementRequestRow {
  id: string;
  subcontractor_id: string;
  company_name: string | null;
  status: string;
  token: string;
  sent_at: string | null;
  customer_signed_at: string | null;
  created_at: string;
}

/**
 * Skapar en signeringsbegäran för UE-ramavtalet, men skickar INGET till UE:n. Vägrar (kastar fel)
 * så länge avtalstexten fortfarande har obeslutade "[...]"-punkter (se hasUnresolvedPlaceholders) -
 * ramavtalet är uttryckligen "INTE klart att signera" (ledning/ue/avtal/01-ramavtal-ue-sv.md)
 * tills Vidar beslutat dem. Detta är den enda spärren som krävs: koden kan alltså släppas i
 * produktion utan risk för att avtalet av misstag går till en riktig UE i förtid.
 */
export const createUeAgreementSigningRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subcontractorId: string }) => {
    if (!input?.subcontractorId) throw new Error("subcontractorId saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ id: string; token: string }> => {
    const sb = await requireAdmin(context.userId);

    const { data: s, error: sErr } = await sb
      .from("subcontractors")
      .select("id, company_name, org_number, address, email, contact_name")
      .eq("id", data.subcontractorId)
      .maybeSingle();
    if (sErr || !s) throw new Error("Underentreprenören hittades inte");
    if (!s.email) throw new Error("UE saknar e-postadress - lägg till en innan avtalet skapas");

    const filled = fillUeAgreement({
      companyName: s.company_name,
      orgNumber: s.org_number,
      country: "Sverige",
      address: s.address,
      vatNumber: null,
    });
    if (hasUnresolvedPlaceholders(filled)) {
      throw new Error(
        "Ramavtalet har obeslutade punkter kvar (se ledning/ue/avtal/01-ramavtal-ue-sv.md och jurist-granskning.md avsnitt 2) - kan inte skickas förrän Vidar beslutat dem.",
      );
    }

    const { data: sig } = await sb.from("company_signature").select("*").maybeSingle();
    if (!sig) throw new Error("NO_COMPANY_SIGNATURE");

    const { buildUeAgreementPdf } = await import("./ue-agreement-pdf.server");
    const bytes = await buildUeAgreementPdf(filled);

    const { randomToken } = await import("./signing.server");
    const id = crypto.randomUUID();
    const token = randomToken();
    const basePath = `ue-avtal/${data.subcontractorId}/${id}/original.pdf`;

    const { error: upErr } = await sb.storage
      .from("offers")
      .upload(basePath, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error("Kunde inte spara PDF: " + upErr.message);

    const now = new Date();
    const { error: insErr } = await sb.from("signature_requests").insert({
      id,
      created_by: context.userId,
      lead_id: null,
      subcontractor_id: data.subcontractorId,
      document_type: "avtal",
      status: "pending",
      offer_number: `Ramavtal UE ${UE_AGREEMENT_VERSION} (${UE_AGREEMENT_DATE}) - ${s.company_name}`,
      customer_name: s.contact_name || s.company_name,
      customer_email: String(s.email).trim().toLowerCase(),
      token,
      base_pdf_path: basePath,
      company_signer_name: sig.signer_name,
      company_signature_png: sig.signature_png,
      company_place: sig.place,
      company_date: now.toISOString().slice(0, 10),
      company_signed_at: now.toISOString(),
    });
    if (insErr) throw new Error(insErr.message);

    return { id, token };
  });

/** Skickar den redan skapade signeringsbegäran till UE:ns riktiga e-post. Separat, explicit steg. */
export const sendUeAgreementEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const sb = await requireAdmin(context.userId);
    const { signingUrl, queueEmail } = await import("./signing.server");

    const { data: row, error } = await sb.from("signature_requests").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Signeringsförfrågan hittades inte");
    if (row.document_type !== "avtal" || !row.subcontractor_id) throw new Error("Inte en UE-avtalsbegäran");
    if (row.status === "signed") throw new Error("Avtalet är redan signerat");
    if (row.status === "cancelled") throw new Error("Avtalet är avbrutet");

    const res = await queueEmail(sb, {
      templateName: "signature-request",
      recipientEmail: row.customer_email,
      idempotencyKey: `ue-avtal-${row.id}`,
      templateData: {
        customerName: row.customer_name,
        offerNumber: row.offer_number,
        signUrl: signingUrl(row.token),
        companySigner: row.company_signer_name,
        docLabel: "Ramavtal",
        companyFallback: "VT6 Invest",
      },
    });
    if (!res.ok) throw new Error("Kunde inte skicka e-post: " + (res.error ?? ""));
    await sb.from("signature_requests").update({ sent_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true };
  });

export const listUeAgreementRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UeAgreementRequestRow[]> => {
    const sb = await requireAdmin(context.userId);
    const { data, error } = await sb
      .from("signature_requests")
      .select("id, subcontractor_id, status, token, sent_at, customer_signed_at, created_at, subcontractors(company_name)")
      .eq("document_type", "avtal")
      .not("subcontractor_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      subcontractor_id: r.subcontractor_id,
      company_name: r.subcontractors?.company_name ?? null,
      status: r.status,
      token: r.token,
      sent_at: r.sent_at,
      customer_signed_at: r.customer_signed_at,
      created_at: r.created_at,
    }));
  });
