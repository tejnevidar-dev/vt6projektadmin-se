import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
} as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const PayloadSchema = z.object({
  id: z.string().min(1).max(128),
  mode: z.enum(["configure", "consultation"]),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(64),
  email: z.string().email().max(255),
  address: z.string().max(500).optional().nullable(),
  current_roof: z.string().max(255).optional().nullable(),
  new_roof: z.string().max(255).optional().nullable(),
  raspont: z.string().max(255).optional().nullable(),
  gangbrygga: z.boolean().optional().nullable(),
  takstege: z.boolean().optional().nullable(),
  avvattning: z.string().max(255).optional().nullable(),
  floors: z.string().max(64).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
  created_at: z.string().optional().nullable(),
});

function buildNotes(p: z.infer<typeof PayloadSchema>): string {
  const lines: string[] = [];
  lines.push(`📥 Inkommande från RoslagsTak.se (${p.mode === "configure" ? "Offertkonfigurator" : "Rådgivning"})`);
  lines.push(`E-post: ${p.email}`);
  if (p.message) lines.push(`Meddelande: ${p.message}`);
  if (p.mode === "configure") {
    if (p.current_roof) lines.push(`Nuvarande tak: ${p.current_roof}`);
    if (p.new_roof) lines.push(`Önskat tak: ${p.new_roof}`);
    if (p.raspont) lines.push(`Råspont: ${p.raspont}`);
    if (p.avvattning) lines.push(`Avvattning: ${p.avvattning}`);
    if (p.floors) lines.push(`Våningar: ${p.floors}`);
    if (p.gangbrygga) lines.push(`✅ Gångbrygga`);
    if (p.takstege) lines.push(`✅ Takstege`);
  }
  return lines.join("\n");
}

export const Route = createFileRoute("/api/public/roslagstak-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        const expected = process.env.ROSLAGSTAK_WEBHOOK_SECRET;
        if (!expected) {
          console.error("ROSLAGSTAK_WEBHOOK_SECRET is not configured");
          return jsonResponse({ error: "Server misconfigured" }, 500);
        }

        const provided = request.headers.get("x-webhook-secret");
        if (!provided || provided !== expected) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const parsed = PayloadSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
        }
        const p = parsed.data;
        const externalId = `roslagstak:${p.id}`;

        // Idempotency check
        const { data: existing } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("external_id", externalId)
          .maybeSingle();
        if (existing) {
          return jsonResponse({ ok: true, status: "duplicate", lead_id: existing.id });
        }

        // Create property
        const { data: property, error: propErr } = await supabaseAdmin
          .from("properties")
          .insert({
            address: p.address || "Adress saknas (webbförfrågan)",
            municipality: "",
            region: "Stockholm",
            roof_type: p.current_roof ?? null,
          })
          .select("id")
          .single();
        if (propErr) {
          console.error("Property insert failed:", propErr);
          return jsonResponse({ error: "Failed to create property" }, 500);
        }

        // Create lead
        const { data: lead, error: leadErr } = await supabaseAdmin
          .from("leads")
          .insert({
            property_id: property.id,
            name: p.name,
            phone: p.phone,
            email: p.email,
            status: "hot",
            source: "roslagstak",
            job_type: "roof_replacement",
            pipeline_stage: "inkommande_webb",
            notes: buildNotes(p),
            external_id: externalId,
          })
          .select("id")
          .single();
        if (leadErr) {
          console.error("Lead insert failed:", leadErr);
          return jsonResponse({ error: "Failed to create lead" }, 500);
        }

        return jsonResponse({ ok: true, status: "created", lead_id: lead.id }, 201);
      },
    },
  },
});
