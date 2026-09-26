import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { respondToOffer, workOrderPdfInput } from "@/lib/work-order.server";
import { termsLines, type WorkOrderContent } from "@/lib/work-order";

// Publik åtkomst för UE via mailtoken (ingen inloggning): visa arbetsordern, ladda ner PDF,
// acceptera eller avböja. Token är 48 hex-tecken och gäller ett erbjudande.
//   GET  /api/public/work-order/<token>          -> JSON
//   GET  /api/public/work-order/<token>?pdf=1    -> PDF
//   POST /api/public/work-order/<token>          {action: "accept"|"decline", reason?}

function admin() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("server_misconfigured");
  return createClient(url, key, { auth: { persistSession: false } });
}

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

async function load(sb: any, token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const { data: offer } = await sb.from("work_order_offers").select("*").eq("token", token).maybeSingle();
  if (!offer) return null;
  const { data: wo } = await sb.from("work_orders").select("*").eq("id", offer.work_order_id).maybeSingle();
  if (!wo) return null;
  return { offer, wo };
}

export const Route = createFileRoute("/api/public/work-order/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const sb = admin();
        const found = await load(sb, params.token);
        if (!found) return bad("not_found", 404);
        const { offer, wo } = found;
        const content = wo.content as WorkOrderContent;
        const expired = offer.status === "pending" && new Date(offer.expires_at).getTime() < Date.now();

        if (new URL(request.url).searchParams.get("pdf") === "1") {
          const { buildWorkOrderPdf } = await import("@/lib/work-order-pdf.server");
          const deadline = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(offer.expires_at));
          const input = await workOrderPdfInput(sb, wo, offer);
          const bytes = await buildWorkOrderPdf({ ...input, deadline });
          return new Response(bytes as unknown as BodyInit, {
            headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="arbetsorder.pdf"', "Cache-Control": "no-store" },
          });
        }

        const attachments: { name: string; url: string }[] = [];
        for (const a of content.attachments ?? []) {
          const { data: s } = await sb.storage.from("lead-documents").createSignedUrl(a.path, 60 * 60);
          if (s?.signedUrl) attachments.push({ name: a.name, url: s.signedUrl });
        }
        const input = await workOrderPdfInput(sb, wo, offer);
        const ctx = { subcontractorName: input.subcontractor?.name ?? null, frameworkDate: input.frameworkDate, content: input.content as any };
        return Response.json({
          status: expired ? "expired" : offer.status,
          workOrderStatus: wo.status,
          orderNumber: wo.order_number,
          fixedPrice: Number(offer.fixed_price),
          expiresAt: offer.expires_at,
          startDate: wo.start_date,
          endDate: wo.end_date,
          subcontractor: input.subcontractor,
          frameworkUrl: input.frameworkUrl,
          terms: { sv: termsLines("sv", ctx), en: termsLines("en", ctx) },
          content: input.content,
          attachments,
        });
      },

      POST: async ({ params, request }) => {
        const sb = admin();
        let body: any;
        try {
          body = await request.json();
        } catch {
          return bad("invalid_json");
        }
        if (body?.action !== "accept" && body?.action !== "decline") return bad("invalid_action");
        const found = await load(sb, params.token);
        if (!found) return bad("not_found", 404);
        const res = await respondToOffer(sb, found.offer.id, body.action, typeof body.reason === "string" ? body.reason : null, {
          termsAccepted: body.termsAccepted === true,
          acceptedBy: typeof body.acceptedBy === "string" ? body.acceptedBy : undefined,
          personnel: Array.isArray(body.personnel) ? body.personnel : [],
        });
        if (!res.ok) {
          const validation = ["terms_required", "name_required", "personnel_required", "personnel_status_invalid"].includes(res.error);
          return bad(res.error, res.error === "not_found" ? 404 : validation ? 400 : 409);
        }
        return Response.json(res);
      },
    },
  },
});
