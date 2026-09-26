import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Personnel, WorkOrderContent } from "@/lib/work-order";

export interface WorkOrderOfferRow {
  id: string;
  subcontractor_id: string;
  company_name: string | null;
  status: string;
  fixed_price: number;
  expires_at: string;
  responded_at: string | null;
  decline_reason: string | null;
}

export interface WorkOrderRow {
  id: string;
  lead_id: string;
  job_id: string | null;
  status: string;
  ue_price: number | null;
  start_date: string | null;
  end_date: string | null;
  order_number: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  accepted_pdf_path: string | null;
  content: WorkOrderContent;
  created_at: string;
  lead_name: string | null;
  offers: WorkOrderOfferRow[];
}

async function requireAdmin(userId: string) {
  const { isAdminUser } = await import("./signing.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!(await isAdminUser(supabaseAdmin, userId))) throw new Error("Bara admin");
  return supabaseAdmin as any;
}

/** Alla arbetsordrar med erbjudanden (admin). */
export const listWorkOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkOrderRow[]> => {
    const sb = await requireAdmin(context.userId);
    const { data: wos } = await sb.from("work_orders").select("*").order("created_at", { ascending: false }).limit(100);
    const ids = (wos ?? []).map((w: any) => w.id);
    const { data: offers } = ids.length
      ? await sb.from("work_order_offers").select("*, sub:subcontractors(company_name)").in("work_order_id", ids).order("created_at")
      : { data: [] };
    const leadIds = [...new Set((wos ?? []).map((w: any) => w.lead_id))];
    const { data: leads } = leadIds.length ? await sb.from("leads").select("id, name").in("id", leadIds) : { data: [] };
    const leadName = new Map<string, string>((leads ?? []).map((l: any) => [l.id, l.name]));
    return (wos ?? []).map((w: any) => ({
      ...w,
      lead_name: leadName.get(w.lead_id) ?? null,
      offers: (offers ?? [])
        .filter((o: any) => o.work_order_id === w.id)
        .map((o: any) => ({ ...o, company_name: o.sub?.company_name ?? null })),
    }));
  });

export interface WorkOrderDetailsInput {
  id: string;
  price: number;
  startDate?: string | null;
  endDate?: string | null;
  /** Egna instruktioner till UE (leadens interna anteckningar kopieras aldrig). */
  notes?: string | null;
  storeys?: number | null;
  pitch?: string | null;
  materialDeliveryDate?: string | null;
  skipSupplier?: string | null;
  skipDelivery?: string | null;
  skipPickup?: string | null;
  basP?: string | null;
  basU?: string | null;
}

/** Sätter pris, datum och villkorsfält och skickar arbetsordern vidare när allt krävt finns. */
export const setWorkOrderDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WorkOrderDetailsInput) => {
    if (!input?.id) throw new Error("id saknas");
    if (!(Number(input.price) > 0)) throw new Error("Ange ett pris över 0");
    if (input.startDate && input.endDate && input.endDate < input.startDate) throw new Error("Slutdatum kan inte vara före startdatum");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ result: string }> => {
    const sb = await requireAdmin(context.userId);
    const { data: wo } = await sb.from("work_orders").select("content, status").eq("id", data.id).maybeSingle();
    if (!wo) throw new Error("Arbetsordern hittades inte");
    const c = (wo.content ?? {}) as Record<string, any>;
    const clean = (v?: string | null) => (v && v.trim() ? v.trim().slice(0, 300) : null);
    const content = {
      ...c,
      notes: clean(data.notes),
      storeys: data.storeys && data.storeys > 0 ? Math.round(data.storeys) : null,
      pitch: clean(data.pitch),
      material_delivery_date: data.materialDeliveryDate || null,
      skip_scaffold:
        clean(data.skipSupplier) || clean(data.skipDelivery) || clean(data.skipPickup)
          ? { supplier: clean(data.skipSupplier), delivery: clean(data.skipDelivery), pickup: clean(data.skipPickup) }
          : null,
      bas_p: clean(data.basP),
      bas_u: clean(data.basU),
    };
    const { error } = await sb
      .from("work_orders")
      .update({ ue_price: data.price, start_date: data.startDate || null, end_date: data.endDate || null, content })
      .eq("id", data.id)
      .in("status", ["draft", "unassigned", "offered"]);
    if (error) throw new Error(error.message);
    const { dispatchWorkOrder } = await import("./work-order.server");
    return { result: await dispatchWorkOrder(sb, data.id) };
  });

export const dispatchWorkOrderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ result: string }> => {
    const sb = await requireAdmin(context.userId);
    const { dispatchWorkOrder } = await import("./work-order.server");
    return { result: await dispatchWorkOrder(sb, data.id) };
  });

export const cancelWorkOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = await requireAdmin(context.userId);
    await sb.from("work_order_offers").update({ status: "cancelled" }).eq("work_order_id", data.id).eq("status", "pending");
    const { error } = await sb.from("work_orders").update({ status: "cancelled" }).eq("id", data.id).neq("status", "accepted");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface UeOfferView {
  offerId: string;
  workOrderId: string;
  status: string;
  fixedPrice: number;
  expiresAt: string;
  content: WorkOrderContent;
  startDate: string | null;
  endDate: string | null;
  orderNumber: string | null;
  subcontractorName: string | null;
  terms: { sv: string[]; en: string[] };
  frameworkUrl: string | null;
  attachments: { name: string; url: string }[];
}

/** Inloggad UE: erbjudanden (och accepterade uppdrag) för den egna firman. */
export const listMyOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UeOfferView[]> => {
    const { supabase } = context;
    const { data: offers } = await supabase
      .from("work_order_offers" as any)
      .select("id, work_order_id, status, fixed_price, expires_at")
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false });
    const rows = (offers ?? []) as any[];
    if (!rows.length) return [];
    const { data: wos } = await supabase
      .from("work_orders" as any)
      .select("id, content, start_date, end_date, order_number")
      .in("id", rows.map((o) => o.work_order_id));
    const wo = new Map<string, any>(((wos ?? []) as any[]).map((w) => [w.id, w]));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { workOrderPdfInput } = await import("./work-order.server");
    const { termsLines } = await import("./work-order");
    const out: UeOfferView[] = [];
    for (const o of rows) {
      const w = wo.get(o.work_order_id);
      if (!w) continue;
      const content = w.content as WorkOrderContent;
      const attachments: { name: string; url: string }[] = [];
      for (const a of content.attachments ?? []) {
        const { data: s } = await supabaseAdmin.storage.from("lead-documents").createSignedUrl(a.path, 60 * 60);
        if (s?.signedUrl) attachments.push({ name: a.name, url: s.signedUrl });
      }
      const pdfInput = await workOrderPdfInput(supabaseAdmin as any, w, o);
      const ctx = { subcontractorName: pdfInput.subcontractor?.name ?? null, frameworkDate: pdfInput.frameworkDate, content: pdfInput.content as any };
      out.push({
        endDate: w.end_date ?? null,
        orderNumber: w.order_number ?? null,
        subcontractorName: pdfInput.subcontractor?.name ?? null,
        terms: { sv: termsLines("sv", ctx), en: termsLines("en", ctx) },
        frameworkUrl: pdfInput.frameworkUrl,
        offerId: o.id,
        workOrderId: o.work_order_id,
        status: o.status,
        fixedPrice: Number(o.fixed_price),
        expiresAt: o.expires_at,
        content,
        startDate: w.start_date ?? null,
        attachments,
      });
    }
    return out;
  });

/** Inloggad UE accepterar eller avböjer ett erbjudande på den egna firman. */
export const respondToMyOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string; action: "accept" | "decline"; reason?: string; termsAccepted?: boolean; acceptedBy?: string; personnel?: Personnel[] }) => {
    if (!input?.offerId) throw new Error("offerId saknas");
    if (input.action !== "accept" && input.action !== "decline") throw new Error("Ogiltig åtgärd");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; status?: string; error?: string }> => {
    // RLS på work_order_offers gör att bara UE:ns eget erbjudande syns.
    const { data: own } = await context.supabase.from("work_order_offers" as any).select("id").eq("id", data.offerId).maybeSingle();
    if (!own) throw new Error("Erbjudandet hittades inte");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { respondToOffer } = await import("./work-order.server");
    return await respondToOffer(supabaseAdmin as any, data.offerId, data.action, data.reason, {
      termsAccepted: data.termsAccepted === true,
      acceptedBy: data.acceptedBy,
      personnel: data.personnel ?? [],
    });
  });

/**
 * Arbetsordern som PDF (sv + en), per erbjudande med UE:s namn och org.nr. Accepterade arbetsordrar
 * ger den sparade accepterade versionen. Behörighet styrs av RLS på work_orders och work_order_offers
 * (admin, UE med erbjudande, säljare).
 */
export const getWorkOrderPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; offerId?: string }) => {
    if (!input?.workOrderId) throw new Error("workOrderId saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ base64: string; fileName: string }> => {
    const { data: wo } = await context.supabase.from("work_orders" as any).select("*").eq("id", data.workOrderId).maybeSingle();
    if (!wo) throw new Error("Arbetsordern hittades inte");
    const w = wo as any;
    const { bytesToBase64 } = await import("./signing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fileName = `arbetsorder-${w.order_number ?? w.id.slice(0, 8)}.pdf`;

    // Redan accepterad: leverera den sparade, accepterade PDF:en.
    if (w.accepted_pdf_path) {
      const { data: file } = await supabaseAdmin.storage.from("offers").download(w.accepted_pdf_path);
      if (file) return { base64: bytesToBase64(new Uint8Array(await file.arrayBuffer())), fileName };
    }

    // Annars per erbjudande. RLS avgör vilka erbjudanden användaren får se.
    let q = context.supabase.from("work_order_offers" as any).select("*").eq("work_order_id", data.workOrderId);
    if (data.offerId) q = q.eq("id", data.offerId);
    const { data: offers } = await q.order("created_at", { ascending: false }).limit(1);
    const offer = ((offers ?? []) as any[])[0] ?? null;

    const { buildWorkOrderPdf } = await import("./work-order-pdf.server");
    const { workOrderPdfInput } = await import("./work-order.server");
    const input = await workOrderPdfInput(supabaseAdmin as any, w, offer);
    const deadline = offer && offer.status === "pending" ? new Date(offer.expires_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short" }) : undefined;
    const bytes = await buildWorkOrderPdf({ ...input, deadline });
    return { base64: bytesToBase64(bytes), fileName };
  });
