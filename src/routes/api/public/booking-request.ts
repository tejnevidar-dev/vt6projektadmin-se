// Bokning av kostnadsfri takkontroll från sajten. Samma skydd/loggning som
// roslagstak-webhook.ts (delad secret, webhook_logs), ingen ny hemlighet behövs.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processBookingRequest } from "@/lib/booking-requests.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
} as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

async function logWebhook(args: { status_code: number; status: string; error_message?: string | null; payload?: unknown; lead_id?: string | null }) {
  try {
    await (supabaseAdmin.from("webhook_logs") as any).insert({
      source: "roslagstak-booking",
      status_code: args.status_code,
      status: args.status,
      error_message: args.error_message ?? null,
      payload: (args.payload as object) ?? null,
      lead_id: args.lead_id ?? null,
    });
  } catch (e) {
    console.error("Failed to write webhook_logs:", e);
  }
}

const UtmSchema = z
  .object({
    source: z.string().max(200).optional().nullable(),
    medium: z.string().max(200).optional().nullable(),
    campaign: z.string().max(200).optional().nullable(),
    term: z.string().max(200).optional().nullable(),
    content: z.string().max(200).optional().nullable(),
  })
  .optional()
  .nullable();

const PayloadSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(255),
    phone: z.string().min(1).max(64),
    email: z.union([z.literal(""), z.string().trim().email().max(255)]).optional().nullable(),
    municipality: z.string().max(255).optional().nullable(),
    slot: z.enum(["formiddag", "eftermiddag", "ring_mig"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    message: z.string().max(2000).optional().nullable(),
    utm: UtmSchema,
  })
  .refine((p) => p.slot === "ring_mig" || !!p.date, { message: "date krävs om slot inte är ring_mig", path: ["date"] });

export const Route = createFileRoute("/api/public/booking-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          await logWebhook({ status_code: 400, status: "invalid_json" });
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const expected = process.env.ROSLAGSTAK_WEBHOOK_SECRET;
        if (!expected) {
          await logWebhook({ status_code: 500, status: "misconfigured", payload: body });
          return jsonResponse({ error: "Server misconfigured" }, 500);
        }
        const provided = request.headers.get("x-webhook-secret");
        if (!provided || provided !== expected) {
          await logWebhook({ status_code: 401, status: "unauthorized", payload: body });
          return jsonResponse({ error: "Unauthorized" }, 401);
        }

        const parsed = PayloadSchema.safeParse(body);
        if (!parsed.success) {
          await logWebhook({ status_code: 400, status: "invalid_payload", error_message: JSON.stringify(parsed.error.flatten()), payload: body });
          return jsonResponse({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
        }
        const p = parsed.data;

        const result = await processBookingRequest(supabaseAdmin, {
          externalId: p.id,
          name: p.name,
          phone: p.phone,
          email: p.email,
          municipality: p.municipality,
          slot: p.slot,
          date: p.date,
          message: p.message,
          utm: p.utm ?? undefined,
        });
        if (result.status === "error") {
          await logWebhook({ status_code: 500, status: "error", error_message: result.message, payload: body });
          return jsonResponse({ error: "Failed to create booking" }, 500);
        }
        const code = result.status === "created" ? 201 : 200;
        await logWebhook({ status_code: code, status: result.status, payload: body, lead_id: result.leadId });
        return jsonResponse({ ok: true, status: result.status, lead_id: result.leadId, sla_promised_at: result.slaPromisedAt }, code);
      },
    },
  },
});
