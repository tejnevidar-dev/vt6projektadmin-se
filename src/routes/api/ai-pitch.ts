import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIChat } from "@/lib/openai.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const PitchSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional().nullable(),
  buildYear: z.number().int().min(1800).max(2100).optional().nullable(),
  roofType: z.string().max(255).optional().nullable(),
  roofAge: z.number().int().min(0).max(200).optional().nullable(),
  hasRoofPermit: z.boolean().optional().nullable(),
  jobType: z.enum(["roof_replacement", "roof_cleaning", "light_roof_work"]),
  notes: z.string().max(2000).optional().nullable(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const jobTypeLabel: Record<string, string> = {
  roof_replacement: "takbyte",
  roof_cleaning: "taktvätt",
  light_roof_work: "lättare takarbeten",
};

export const Route = createFileRoute("/api/ai-pitch")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // Verifiera att användaren är inloggad
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const token = authHeader.replace("Bearer ", "");

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
          return jsonResponse({ error: "Server misconfigured" }, 500);
        }

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData.user) {
          return jsonResponse({ error: "Invalid token" }, 401);
        }

        const body = await request.json().catch(() => null);
        const parsed = PitchSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ error: "Invalid input", details: parsed.error.flatten() }, 400);
        }
        const lead = parsed.data;

        const systemPrompt = `Du är en erfaren säljcoach för en svensk takfirma. Skriv en kort, vass säljpitch (max 5 meningar, max 90 ord, på svenska) för en specifik kund baserat på fastighetsdata. Var konkret, peka på orsaker (t.ex. takets ålder, materialrisk, bygglov) och avsluta med en tydlig nästa-steg-uppmaning. Inga floskler, inga emojis.`;

        const userPrompt = `Kund: ${lead.name}
Jobbtyp: ${jobTypeLabel[lead.jobType]}
Adress: ${lead.address ?? "okänd"}
Byggnadsår: ${lead.buildYear ?? "okänt"}
Taktyp: ${lead.roofType ?? "okänd"}
Takålder: ${lead.roofAge ?? "okänd"} år
Bygglov ansökt: ${lead.hasRoofPermit ? "ja" : "nej"}
Anteckningar: ${lead.notes ?? "inga"}

Skriv pitchen nu.`;

        try {
          const data = await callOpenAIChat({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          const pitch = data.choices?.[0]?.message?.content?.trim() ?? "";
          return jsonResponse({ pitch });
        } catch (e) {
          console.error("ai-pitch error:", e);
          return jsonResponse({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
        }
      },
    },
  },
});
