import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ParseArbeteInput {
  text: string;
}

export interface ParseArbeteResult {
  punkter: string[];
}

export const parseArbeteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ParseArbeteInput) => {
    if (!input?.text?.trim()) throw new Error("Text saknas");
    return input;
  })
  .handler(async ({ data }): Promise<ParseArbeteResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY saknas");

    const systemPrompt = `Du är en assistent som strukturerar arbetsbeskrivningar för takoffertar (RoslagsTak).
Läs den löpande texten från användaren och bryt ut den till tydliga, konkreta arbetspunkter som kan listas i en offert.

Regler:
- Skriv punkterna på svenska, i imperativ/substantivform (t.ex. "Rivning av befintligt tak", "Montering av ny underlagspapp inkl. läkt").
- En punkt = ett konkret arbetsmoment eller leverans. Slå inte ihop flera moment i en punkt.
- Ta bort artighetsfraser, prisdiskussion, hälsningar och allt som inte är själva arbetet.
- Behåll tekniska detaljer (material, dimensioner, kulör, antal) om de finns i texten.
- Inga numreringar, inga bullets, ingen extra formattering i texterna – bara ren mening per punkt.
- Returnera ENBART giltig JSON enligt schemat, ingen förklaring.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: data.text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_punkter",
              description: "Returnera de utbrutna arbetspunkterna",
              parameters: {
                type: "object",
                properties: {
                  punkter: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["punkter"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_punkter" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI: rate limit, försök igen om en stund");
      if (res.status === 402) throw new Error("AI-krediter slut. Fyll på i Settings.");
      throw new Error(`AI-fel (${res.status}): ${body.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) throw new Error("AI returnerade inga punkter");
    let parsed: any;
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      throw new Error("Kunde inte tolka AI-svaret");
    }
    const punkter: string[] = Array.isArray(parsed?.punkter)
      ? parsed.punkter.map((p: any) => String(p).trim()).filter(Boolean)
      : [];
    if (punkter.length === 0) throw new Error("AI hittade inga arbetspunkter i texten");
    return { punkter };
  });
