import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LeadBrief = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.string(),
  source: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  value: z.number(),
  daysSinceContact: z.number(),
  score: z.number().nullable().optional(),
  jobType: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
});

const OfferBrief = z.object({
  id: z.string(),
  leadName: z.string().nullable().optional(),
  status: z.string(),
  amount: z.number(),
  daysSinceSent: z.number().nullable().optional(),
  version: z.number().nullable().optional(),
});

const InputSchema = z.object({
  leads: z.array(LeadBrief).max(120),
  offers: z.array(OfferBrief).max(120).default([]),
  summary: z.string().max(4000).default(""),
});

export interface AiRecommendation {
  rank: number;
  type: "lead" | "offert";
  title: string;
  why: string;
  action: string;
  value: number;
  urgency: "hog" | "medel" | "lag";
}

export interface AiInsightsResult {
  headline: string;
  recommendations: AiRecommendation[];
  risks: string[];
}

const SYSTEM = `Du är en svensk säljchef för en takfirma. Du får sammanfattad pipelinedata (leads och offerter).
Analysera och returnera ENDAST JSON enligt formatet:
{"headline": "en mening om läget", "recommendations": [{"rank":1,"type":"lead"|"offert","title":"Kundnamn – kort åtgärd","why":"varför just denna, med siffror","action":"exakt nästa steg","value":123000,"urgency":"hog"|"medel"|"lag"}], "risks": ["kort risk"]}
Max 8 rekommendationer, sorterade efter förväntat värde × sannolikhet × brådska. Konkret, inga floskler, svenska.`;

export const generateAiInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AiInsightsResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerad.");

    const userPrompt = `Nyckeltal:\n${data.summary}\n\nLeads (JSON):\n${JSON.stringify(data.leads)}\n\nOfferter (JSON):\n${JSON.stringify(data.offers)}\n\nGe rekommendationerna nu som ren JSON.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI är överbelastad just nu – försök igen om en stund.");
    if (res.status === 402) throw new Error("AI-krediterna är slut. Fyll på krediter i Lovable.");
    if (!res.ok) {
      const text = await res.text();
      console.error("ai-insights gateway error", res.status, text);
      throw new Error("AI-tjänsten svarade inte.");
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";
    let parsed: Partial<AiInsightsResult> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = {};
        }
      }
    }

    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    return {
      headline: typeof parsed.headline === "string" ? parsed.headline : "AI-analys av pipeline",
      recommendations: recs.slice(0, 8).map((r, i) => ({
        rank: Number(r?.rank) || i + 1,
        type: r?.type === "offert" ? "offert" : "lead",
        title: String(r?.title ?? "Okänd"),
        why: String(r?.why ?? ""),
        action: String(r?.action ?? ""),
        value: Number(r?.value) || 0,
        urgency: r?.urgency === "hog" || r?.urgency === "lag" ? r.urgency : "medel",
      })),
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5).map(String) : [],
    };
  });
