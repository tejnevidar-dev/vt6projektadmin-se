import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ImageInput = z.object({
  dataUrl: z.string().min(20),
});

const AnalyzeInput = z.object({
  materialKey: z.string().min(1),
  images: z.array(ImageInput).min(1).max(10),
});

export interface RoofAnalysisResult {
  roofAreaKvm: number;
  ranndalarMeter: number;
  platItems: { key: string; quantity: number }[];
  arbeteTimmar: number;
  notes: string;
}

export const analyzeRoofImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data, context }): Promise<RoofAnalysisResult> => {
    // Läs aktiv prislista för att veta vilka plåtnycklar AI:n får använda
    const { data: rows, error } = await context.supabase
      .from("price_list")
      .select("key,label,unit,category,is_active")
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    const platKeys = (rows ?? [])
      .filter((r) => r.category === "plat" && r.key !== "ranndalar_meter")
      .map((r) => ({ key: r.key, label: r.label, unit: r.unit }));
    const materialRow = (rows ?? []).find((r) => r.key === data.materialKey);
    const materialLabel = materialRow?.label ?? data.materialKey;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Saknar LOVABLE_API_KEY på servern");

    const platList = platKeys
      .map((p) => `- key="${p.key}" (${p.label}, enhet: ${p.unit})`)
      .join("\n");

    const systemPrompt =
      "Du är en erfaren takläggare som analyserar bilder av tak med inritade mått " +
      "(t.ex. skisser, ritningar eller foton med måttangivelser i meter). Din uppgift är att " +
      "läsa av måtten och uppskatta materialåtgång. Svara ENDAST med giltig JSON – ingen förklaring, ingen markdown.";

    const userText = `Taktyp: ${materialLabel} (key: ${data.materialKey}).

Tillgängliga plåtdetaljer du får rekommendera (använd exakt dessa keys):
${platList}

Uppgift:
1. Läs av total takyta i kvadratmeter (roofAreaKvm) från måtten i bilderna. Om flera takfall syns, summera dem.
2. Uppskatta total längd ränndalar i meter (ranndalarMeter). 0 om inga ränndalar syns.
3. Rekommendera rimliga plåtdetaljer (nockplåt, fotplåt, vindskivor osv) baserat på taktyp och storlek. Uppskatta antal/meter för varje.
4. Uppskatta antal arbetstimmar (arbeteTimmar) för hela jobbet (rivning + läggning + plåt).
5. En kort intern anteckning (notes, max 200 tecken) med antaganden och osäkerheter.

Returnera EXAKT denna JSON-form:
{
  "roofAreaKvm": <number>,
  "ranndalarMeter": <number>,
  "platItems": [{"key": "<key-från-listan>", "quantity": <number>}],
  "arbeteTimmar": <number>,
  "notes": "<sträng>"
}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              ...data.images.map((img) => ({
                type: "image_url",
                image_url: { url: img.dataUrl },
              })),
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("För många förfrågningar just nu, försök igen om en stund.");
      if (resp.status === 402) throw new Error("AI-krediter slut – ladda på i arbetsyteinställningar.");
      throw new Error(`AI-analys misslyckades (${resp.status}): ${bodyText.slice(0, 200)}`);
    }

    const j = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = j.choices?.[0]?.message?.content;
    if (!content) throw new Error("Tomt svar från AI");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returnerade ogiltig JSON");
    }
    const p = parsed as Record<string, unknown>;
    const rawItems = Array.isArray(p.platItems) ? (p.platItems as unknown[]) : [];
    const validKeys = new Set(platKeys.map((k) => k.key));

    return {
      roofAreaKvm: Math.max(0, Number(p.roofAreaKvm) || 0),
      ranndalarMeter: Math.max(0, Number(p.ranndalarMeter) || 0),
      platItems: rawItems
        .map((it) => {
          const o = it as Record<string, unknown>;
          const key = String(o.key ?? "");
          const qty = Number(o.quantity) || 0;
          return { key, quantity: qty };
        })
        .filter((it) => validKeys.has(it.key) && it.quantity > 0),
      arbeteTimmar: Math.max(0, Number(p.arbeteTimmar) || 0),
      notes: String(p.notes ?? "").slice(0, 500),
    };
  });
