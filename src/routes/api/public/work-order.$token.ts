import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { respondToOffer } from "@/lib/work-order.server";
import type { WorkOrderContent } from "@/lib/work-order";

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
          const bytes = await buildWorkOrderPdf({ content, uePrice: Number(offer.fixed_price), startDate: wo.start_date, deadline });
          return new Response(bytes as unknown as BodyInit, {
            headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="arbetsorder.pdf"', "Cache-Control": "no-store" },
          });
        }

        const attachments: { name: string; url: string }[] = [];
        for (const a of content.attachments ?? []) {
          const { data: s } = await sb.storage.from("lead-documents").createSignedUrl(a.path, 60 * 60);
          if (s?.signedUrl) attachments.push({ name: a.name, url: s.signedUrl });
        }
        return Response.json({
          status: expired ? "expired" : offer.status,
          workOrderStatus: wo.status,
          fixedPrice: Number(offer.fixed_price),
          expiresAt: offer.expires_at,
          startDate: wo.start_date,
          content,
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
        const res = await respondToOffer(sb, found.offer.id, body.action, typeof body.reason === "string" ? body.reason : null);
        if (!res.ok) return bad(res.error, res.error === "not_found" ? 404 : 409);
        return Response.json(res);
      },
    },
  },
});
