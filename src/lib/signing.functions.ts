import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CreateSigningInput {
  pdfBase64: string;
  offerNumber: string;
  customerName: string;
  customerEmail: string;
  leadId?: string | null;
  totalAmount?: number | null;
  /** Krävs bara för admin. Övriga säljare skickas via godkännande, där bolagets signatur läggs på. */
  companySignerName?: string;
  companySignaturePng?: string;
  companyPlace?: string;
  companyDate?: string;
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
  company_signer_name: string | null;
  customer_signed_at: string | null;
  signed_pdf_path: string | null;
  base_pdf_path: string;
  sent_at: string | null;
  expires_at: string;
  created_at: string;
  created_by: string;
  created_by_name: string | null;
  lead_id: string | null;
}

const money = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

export const createSigningRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateSigningInput) => {
    if (!input?.pdfBase64) throw new Error("PDF saknas");
    if (!input.customerName?.trim()) throw new Error("Kundnamn saknas");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.customerEmail ?? ""))
      throw new Error("Ogiltig e-postadress till kund");
    return input;
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ id: string; token: string; url: string | null; emailed: boolean; awaitingApproval: boolean }> => {
      const { supabase, userId } = context;
      const { randomToken, base64ToBytes, signingUrl, queueEmail, isAdminUser } = await import("./signing.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const admin = await isAdminUser(supabaseAdmin, userId);
      if (admin) {
        if (!data.companySignerName?.trim()) throw new Error("Ange vem som signerar för företaget");
        if (!data.companySignaturePng) throw new Error("Signatur saknas");
        if (!data.companyPlace?.trim()) throw new Error("Ange ort");
        if (!data.companyDate) throw new Error("Ange datum");
      }

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
        document_type: "offert",
        status: admin ? "pending" : "awaiting_approval",
        offer_number: data.offerNumber,
        customer_name: data.customerName.trim(),
        customer_email: data.customerEmail.trim().toLowerCase(),
        token,
        base_pdf_path: basePath,
        total_amount: data.totalAmount ?? null,
        company_signer_name: admin ? data.companySignerName!.trim() : null,
        company_signature_png: admin ? data.companySignaturePng! : null,
        company_place: admin ? data.companyPlace!.trim() : null,
        company_date: admin ? data.companyDate! : null,
        company_signed_at: admin ? new Date().toISOString() : null,
      });
      if (insErr) throw new Error(insErr.message);

      if (!admin) {
        // Går till godkännande hos admin: klockan + mail. Kunden får ingenting än.
        const { sendAlert, loadConfig } = await import("./lead-intake.server");
        const cfg = await loadConfig(supabaseAdmin);
        const { data: prof } = await (supabaseAdmin as any)
          .from("profiles")
          .select("display_name")
          .eq("id", userId)
          .maybeSingle();
        const seller = prof?.display_name || "En säljare";
        await sendAlert(supabaseAdmin, cfg, {
          type: "offer_approval",
          leadId: data.leadId ?? null,
          title: `Offert ${data.offerNumber} väntar på ditt godkännande`,
          body: `${seller} har skapat en offert till ${data.customerName.trim()}${
            data.totalAmount != null ? ` på ${money(data.totalAmount)}` : ""
          }. Godkänn med ett klick, så signeras den för bolaget och skickas till kunden.`,
          details: [`Kund: ${data.customerName.trim()}`, `Offert: ${data.offerNumber}`],
          link: "/offert/ny",
          idempotencySuffix: id,
        });
        return { id, token, url: null, emailed: false, awaitingApproval: true };
      }

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
            amount: data.totalAmount != null ? money(data.totalAmount) : undefined,
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

      return { id, token, url, emailed, awaitingApproval: false };
    },
  );

export const listSigningRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SigningRequestRow[]> => {
    const { data, error } = await context.supabase
      .from("signature_requests" as any)
      .select(
        "id, offer_number, customer_name, customer_email, token, status, total_amount, company_signer_name, customer_signed_at, signed_pdf_path, base_pdf_path, sent_at, expires_at, created_at, created_by, lead_id",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as SigningRequestRow[];

    const ids = [...new Set(rows.map((r) => r.created_by))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await (supabaseAdmin as any).from("profiles").select("id, display_name").in("id", ids);
      for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
        if (p.display_name) names.set(p.id, p.display_name);
      }
    }
    return rows.map((r) => ({ ...r, created_by_name: names.get(r.created_by) ?? null }));
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
    if (r.status === "awaiting_approval") throw new Error("Offerten väntar på godkännande och kan inte skickas än");
    if (r.status === "cancelled") throw new Error("Offerten är avbruten");

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

// ---------- Godkännande (bara admin) ----------

export const getCompanySignatureStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ isAdmin: boolean; exists: boolean; signerName: string | null; place: string | null }> => {
      const { isAdminUser } = await import("./signing.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (!(await isAdminUser(supabaseAdmin, context.userId))) {
        return { isAdmin: false, exists: false, signerName: null, place: null };
      }
      const { data } = await (supabaseAdmin as any).from("company_signature").select("signer_name, place").maybeSingle();
      return { isAdmin: true, exists: !!data, signerName: data?.signer_name ?? null, place: data?.place ?? null };
    },
  );

export interface ApproveInput {
  id: string;
  /** Anges första gången (eller vid byte); annars används den sparade bolagssignaturen. */
  signerName?: string;
  place?: string;
  signaturePng?: string;
}

export const approveSigningRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ApproveInput) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true; url: string; emailed: boolean }> => {
    const { isAdminUser, signingUrl, queueEmail } = await import("./signing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    if (!(await isAdminUser(supabaseAdmin, context.userId))) throw new Error("Bara admin kan godkänna offerter");

    const { data: row } = await sb.from("signature_requests").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Offerten hittades inte");
    if (row.status !== "awaiting_approval") throw new Error("Offerten väntar inte på godkännande");

    if (data.signaturePng) {
      if (!data.signerName?.trim() || !data.place?.trim()) throw new Error("Ange namn och ort för signaturen");
      const { error } = await sb.from("company_signature").upsert({
        id: true,
        signer_name: data.signerName.trim(),
        place: data.place.trim(),
        signature_png: data.signaturePng,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error("Kunde inte spara signaturen: " + error.message);
    }
    const { data: sig } = await sb.from("company_signature").select("*").maybeSingle();
    if (!sig) throw new Error("NO_COMPANY_SIGNATURE");

    const now = new Date();
    const { error: updErr } = await sb
      .from("signature_requests")
      .update({
        status: "pending",
        company_signer_name: sig.signer_name,
        company_signature_png: sig.signature_png,
        company_place: sig.place,
        company_date: now.toISOString().slice(0, 10),
        company_signed_at: now.toISOString(),
        approved_by: context.userId,
        approved_at: now.toISOString(),
        // Länken gäller 30 dagar från det att kunden faktiskt får den.
        expires_at: new Date(now.getTime() + 30 * 86400000).toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "awaiting_approval");
    if (updErr) throw new Error(updErr.message);

    const url = signingUrl(row.token);
    const res = await queueEmail(supabaseAdmin, {
      templateName: "signature-request",
      recipientEmail: row.customer_email,
      idempotencyKey: `sign-req-${row.id}`,
      templateData: {
        customerName: row.customer_name,
        offerNumber: row.offer_number,
        signUrl: url,
        companySigner: sig.signer_name,
        amount: row.total_amount != null ? money(Number(row.total_amount)) : undefined,
      },
    });
    if (res.ok) await sb.from("signature_requests").update({ sent_at: now.toISOString() }).eq("id", row.id);

    const { sendAlert, loadConfig } = await import("./lead-intake.server");
    const cfg = await loadConfig(sb);
    await sendAlert(sb, cfg, {
      type: "offer_approved",
      leadId: row.lead_id,
      title: `Offert ${row.offer_number} godkänd och skickad`,
      body: `Din offert ${row.offer_number} till ${row.customer_name} är godkänd och skickad till kunden för signering.`,
      toAdmin: false,
      sellerId: row.created_by,
      idempotencySuffix: row.id,
    });

    return { ok: true, url, emailed: res.ok };
  });

export const rejectSigningRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { isAdminUser } = await import("./signing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    if (!(await isAdminUser(supabaseAdmin, context.userId))) throw new Error("Bara admin kan avslå offerter");
    const { data: row } = await sb.from("signature_requests").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Offerten hittades inte");
    if (row.status !== "awaiting_approval") throw new Error("Offerten väntar inte på godkännande");
    const { error } = await sb.from("signature_requests").update({ status: "cancelled" }).eq("id", row.id);
    if (error) throw new Error(error.message);

    const { sendAlert, loadConfig } = await import("./lead-intake.server");
    const cfg = await loadConfig(sb);
    const why = data.reason?.trim();
    await sendAlert(sb, cfg, {
      type: "offer_rejected",
      leadId: row.lead_id,
      title: `Offert ${row.offer_number} skickades inte`,
      body: `Din offert ${row.offer_number} till ${row.customer_name} godkändes inte${
        why ? `: ${why}` : ". Ta kontakt med Vidar för att gå igenom den."
      }`,
      toAdmin: false,
      sellerId: row.created_by,
      idempotencySuffix: row.id,
    });
    return { ok: true };
  });
