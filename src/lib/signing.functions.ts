import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CreateSigningInput {
  pdfBase64: string;
  offerNumber: string;
  customerName: string;
  customerEmail: string;
  leadId?: string | null;
  totalAmount?: number | null;
  companySignerName: string;
  companySignaturePng: string;
  companyPlace: string;
  companyDate: string;
  sendEmail: boolean;
}

export interface SigningRequestRow {
  id: string;
  offer_number: string;
  customer_name: string;
  customer_email: string;
  token: string;
  status: string;
  total_amount: number | null;
  company_signer_name: string;
  customer_signed_at: string | null;
  signed_pdf_path: string | null;
  base_pdf_path: string;
  sent_at: string | null;
  expires_at: string;
  created_at: string;
}

export const createSigningRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateSigningInput) => {
    if (!input?.pdfBase64) throw new Error("PDF saknas");
    if (!input.customerName?.trim()) throw new Error("Kundnamn saknas");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.customerEmail ?? ""))
      throw new Error("Ogiltig e-postadress till kund");
    if (!input.companySignerName?.trim()) throw new Error("Ange vem som signerar för företaget");
    if (!input.companySignaturePng) throw new Error("Signatur saknas");
    if (!input.companyPlace?.trim()) throw new Error("Ange ort");
    if (!input.companyDate) throw new Error("Ange datum");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ id: string; token: string; url: string; emailed: boolean }> => {
    const { supabase, userId } = context;
    const { randomToken, base64ToBytes, signingUrl, queueEmail } = await import("./signing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const id = crypto.randomUUID();
    const token = randomToken();
    const basePath = `signering/${id}/original.pdf`;

    const bytes = base64ToBytes(data.pdfBase64);
    const { error: upErr } = await supabaseAdmin.storage
      .from("offers")
      .upload(basePath, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error("Kunde inte spara PDF: " + upErr.message);

    const { error: insErr } = await supabase.from("signature_requests" as any).insert({
      id,
      created_by: userId,
      lead_id: data.leadId ?? null,
      offer_number: data.offerNumber,
      customer_name: data.customerName.trim(),
      customer_email: data.customerEmail.trim().toLowerCase(),
      token,
      base_pdf_path: basePath,
      total_amount: data.totalAmount ?? null,
      company_signer_name: data.companySignerName.trim(),
      company_signature_png: data.companySignaturePng,
      company_place: data.companyPlace.trim(),
      company_date: data.companyDate,
    });
    if (insErr) throw new Error(insErr.message);

    const url = signingUrl(token);
    let emailed = false;
    if (data.sendEmail) {
      const res = await queueEmail(supabaseAdmin, {
        templateName: "signature-request",
        recipientEmail: data.customerEmail.trim().toLowerCase(),
        idempotencyKey: `sign-req-${id}`,
        templateData: {
          customerName: data.customerName,
          offerNumber: data.offerNumber,
          signUrl: url,
          companySigner: data.companySignerName,
          amount:
            data.totalAmount != null
              ? `${Math.round(data.totalAmount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`
              : undefined,
        },
      });
      emailed = res.ok;
      if (res.ok) {
        await supabase
          .from("signature_requests" as any)
          .update({ sent_at: new Date().toISOString() })
          .eq("id", id);
      }
    }

    return { id, token, url, emailed };
  });

export const listSigningRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SigningRequestRow[]> => {
    const { data, error } = await context.supabase
      .from("signature_requests" as any)
      .select(
        "id, offer_number, customer_name, customer_email, token, status, total_amount, company_signer_name, customer_signed_at, signed_pdf_path, base_pdf_path, sent_at, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as SigningRequestRow[];
  });

export const resendSigningEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { signingUrl, queueEmail } = await import("./signing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await context.supabase
      .from("signature_requests" as any)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Signeringsförfrågan hittades inte");
    const r = row as any;
    if (r.status === "signed") throw new Error("Offerten är redan signerad");

    const res = await queueEmail(supabaseAdmin, {
      templateName: "signature-request",
      recipientEmail: r.customer_email,
      idempotencyKey: `sign-req-${r.id}-${Date.now()}`,
      templateData: {
        customerName: r.customer_name,
        offerNumber: r.offer_number,
        signUrl: signingUrl(r.token),
        companySigner: r.company_signer_name,
      },
    });
    if (!res.ok) throw new Error("Kunde inte skicka e-post: " + (res.error ?? ""));
    await context.supabase
      .from("signature_requests" as any)
      .update({ sent_at: new Date().toISOString() })
      .eq("id", r.id);
    return { ok: true };
  });

export const getSigningPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; signed?: boolean }) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { data: row, error } = await context.supabase
      .from("signature_requests" as any)
      .select("base_pdf_path, signed_pdf_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Hittades inte");
    const r = row as any;
    const path = data.signed ? (r.signed_pdf_path ?? r.base_pdf_path) : r.base_pdf_path;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("offers")
      .createSignedUrl(path, 60 * 30);
    if (sErr || !signed?.signedUrl) throw new Error("Kunde inte skapa länk");
    return { url: signed.signedUrl };
  });

export const cancelSigningRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { error } = await context.supabase
      .from("signature_requests" as any)
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
