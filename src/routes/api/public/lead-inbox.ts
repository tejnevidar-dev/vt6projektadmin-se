import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestLead, loadConfig } from "@/lib/lead-intake.server";
import { safeEqual } from "@/lib/lead-intake";

// Gemensam ingång för nya leadkällor: Meta/Google leadformulär (via Zapier/Make),
// leadplattformar, partners m.fl. Skickas som JSON med headern X-Inbox-Secret.
//
//   POST /api/public/lead-inbox
//   { "name": "...", "phone": "...", "email": "...", "address": "...", "message": "...",
//     "channel": "meta" | "google" | "mittanbud" | "partner" | ...,
//     "campaign": "...", "utm_source": "...", "utm_medium": "...", "utm_campaign": "...",
//     "gclid": "...", "fbclid": "...", "landing_page": "...", "external_id": "unik id från källan" }
//
// Minst telefon eller e-post krävs. external_id gör att samma lead aldrig skapas två gånger.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Inbox-Secret",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

const opt = (max: number) => z.string().max(max).optional().nullable();

const Payload = z
  .object({
    name: opt(255),
    phone: opt(64),
    email: z.string().email().max(255).optional().nullable(),
    address: opt(500),
    message: opt(5000),
    channel: opt(64),
    /** true: leaden räknas som webbformulärlead (source roslagstak, "Hemsidan"), t.ex. vid räddning av missade förfrågningar. */
    as_website: z.boolean().optional().nullable(),
    campaign: opt(255),
    utm_source: opt(255),
    utm_medium: opt(255),
    utm_campaign: opt(255),
    utm_term: opt(255),
    utm_content: opt(255),
    gclid: opt(255),
    fbclid: opt(255),
    landing_page: opt(500),
    external_id: opt(200),
    job_type: z.enum(["roof_replacement", "roof_cleaning", "light_roof_work"]).optional().nullable(),
  })
  .refine((p) => (p.phone && p.phone.trim()) || (p.email && p.email.trim()), {
    message: "phone or email is required",
  });

async function logInbox(args: {
  status_code: number;
  status: string;
  error_message?: string | null;
  payload?: unknown;
  lead_id?: string | null;
}) {
  try {
    await (supabaseAdmin as any).from("webhook_logs").insert({
      source: "inbox",
      status_code: args.status_code,
      status: args.status,
      error_message: args.error_message ?? null,
      payload: (args.payload as object) ?? null,
      headers: null,
      lead_id: args.lead_id ?? null,
    });
  } catch (e) {
    console.error("Failed to write webhook_logs:", e);
  }
}

export const Route = createFileRoute("/api/public/lead-inbox")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        const expected = process.env.LEAD_INBOX_SECRET;
        if (!expected) {
          await logInbox({ status_code: 500, status: "misconfigured", error_message: "LEAD_INBOX_SECRET is not configured" });
          return json({ error: "Server misconfigured" }, 500);
        }
        const provided = request.headers.get("x-inbox-secret") ?? "";
        if (!provided || !safeEqual(provided, expected)) {
          await logInbox({ status_code: 401, status: "unauthorized", error_message: provided ? "Wrong secret" : "Missing X-Inbox-Secret header" });
          return json({ error: "Unauthorized" }, 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          await logInbox({ status_code: 400, status: "invalid_json", error_message: "Body is not valid JSON" });
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = Payload.safeParse(body);
        if (!parsed.success) {
          await logInbox({ status_code: 400, status: "invalid_payload", error_message: JSON.stringify(parsed.error.flatten()), payload: body });
          return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
        }
        const p = parsed.data;

        const channel = p.channel?.trim() || "okänd kanal";
        const email = p.email?.trim().toLowerCase() || null;
        const name = p.name?.trim() || (email ? email.split("@")[0].replace(/[._-]+/g, " ") : "Okänt namn");
        const message = p.message?.trim() || "";
        const rawId = p.external_id?.trim();
        // Webbformulärleads använder webhookens id-format, så samma förfrågan aldrig dubbleras mellan kanalerna.
        const externalId = p.as_website && rawId
          ? rawId.startsWith("roslagstak:") ? rawId : `roslagstak:${rawId}`
          : `inbox:${rawId || crypto.randomUUID()}`;

        const tracking = Object.fromEntries(
          Object.entries({
            channel,
            campaign: p.campaign,
            utm_source: p.utm_source,
            utm_medium: p.utm_medium,
            utm_campaign: p.utm_campaign,
            utm_term: p.utm_term,
            utm_content: p.utm_content,
            gclid: p.gclid,
            fbclid: p.fbclid,
            landing_page: p.landing_page,
          }).filter(([, v]) => v != null && String(v).trim() !== ""),
        );
        const notes = [
          `📥 Inkommande via ${channel}`,
          email ? `E-post: ${email}` : "",
          p.campaign ? `Kampanj: ${p.campaign}` : "",
          message ? `Meddelande: ${message}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        const cfg = await loadConfig(supabaseAdmin);
        const result = await ingestLead(supabaseAdmin, cfg, {
          source: p.as_website ? "roslagstak" : "inbox",
          sourceLabel: p.as_website ? "Hemsidan" : channel,
          externalId,
          name,
          phone: p.phone?.trim() || null,
          email,
          address: p.address?.trim() || null,
          jobType: p.job_type ?? undefined,
          status: "hot",
          notes,
          summary: message || `Förfrågan via ${channel}`,
          mergeNote: `📥 Ny förfrågan via ${channel}${message ? `: ${message.replace(/\s+/g, " ").slice(0, 300)}` : ""}`,
          meta: tracking,
        });
        if (result.status === "error") {
          await logInbox({ status_code: 500, status: result.stage, error_message: result.message, payload: body });
          return json({ error: "Failed to create lead" }, 500);
        }
        const code = result.status === "created" ? 201 : 200;
        await logInbox({ status_code: code, status: result.status, payload: body, lead_id: result.leadId });
        return json({ ok: true, status: result.status, lead_id: result.leadId }, code);
      },
    },
  },
});
