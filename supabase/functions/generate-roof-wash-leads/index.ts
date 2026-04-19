import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PropertyCandidate {
  id: string;
  address: string;
  municipality: string;
  region: string;
  build_year: number | null;
  roof_type: string | null;
  roof_age: number | null;
}

interface AiScored {
  property_id: string;
  score: number;
  reason: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user is authenticated
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(
      token
    );
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { limit?: number };
    const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

    // Fetch properties that don't already have a roof_cleaning lead
    const { data: existingLeads, error: leadsError } = await supabase
      .from("leads")
      .select("property_id")
      .eq("job_type", "roof_cleaning");

    if (leadsError) throw leadsError;

    const excludeIds = (existingLeads ?? [])
      .map((l) => l.property_id)
      .filter((id): id is string => id !== null);

    let propertiesQuery = supabase
      .from("properties")
      .select("id, address, municipality, region, build_year, roof_type, roof_age")
      .limit(100);

    if (excludeIds.length > 0) {
      propertiesQuery = propertiesQuery.not(
        "id",
        "in",
        `(${excludeIds.join(",")})`
      );
    }

    const { data: properties, error: propError } = await propertiesQuery;
    if (propError) throw propError;

    if (!properties || properties.length === 0) {
      return new Response(
        JSON.stringify({ candidates: [], message: "Inga nya fastigheter att analysera" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const candidates = properties as PropertyCandidate[];

    const systemPrompt = `Du är en expert på att identifiera fastigheter som behöver taktvätt i Sverige.

Kriterier för en bra taktvätt-lead (kombinerad poäng 0-100):

1. **Takålder (vikt 40%)**: Sweet spot är 5-20 år. Tak under 5 år är för nya. Tak över 25 år behöver oftare bytas än tvättas.
   - 5-15 år: 80-100 poäng
   - 15-20 år: 60-80 poäng
   - 20-25 år: 30-60 poäng
   - <5 eller >25 år: 0-30 poäng

2. **Takmaterial (vikt 35%)**: Betongpannor och tegelpannor drar åt sig mossa/lav. Plåttak behöver sällan tvättas.
   - betong/tegel/pannor: 80-100 poäng
   - eternit/skiffer: 50-70 poäng
   - plåt/metall: 0-20 poäng
   - okänt: 40 poäng (medel)

3. **Geografi (vikt 25%)**: Fuktiga regioner och kustnära områden får mer mossa.
   - Västra Götaland, Skåne, Halland, Blekinge: 80-100 poäng
   - Stockholm, Uppsala, Södermanland (kustnära): 60-80 poäng
   - Inlandet (Jönköping, Västmanland): 40-60 poäng

Returnera de ${limit} bästa kandidaterna rangordnade efter poäng. Motiveringen ska vara på svenska, max 2 meningar, och förklara varför just denna fastighet är en bra taktvätt-lead.`;

    const userPrompt = `Analysera dessa ${candidates.length} fastigheter och välj de ${limit} bästa taktvätt-kandidaterna:

${candidates
  .map(
    (p) =>
      `ID: ${p.id}
Adress: ${p.address}, ${p.municipality}, ${p.region}
Byggår: ${p.build_year ?? "okänt"}
Takmaterial: ${p.roof_type ?? "okänt"}
Takålder: ${p.roof_age ?? "okänd"} år`
  )
  .join("\n\n")}`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "rank_roof_wash_candidates",
                description:
                  "Returnerar de bästa taktvätt-kandidaterna med poäng och motivering.",
                parameters: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          property_id: { type: "string" },
                          score: {
                            type: "integer",
                            minimum: 0,
                            maximum: 100,
                          },
                          reason: { type: "string" },
                        },
                        required: ["property_id", "score", "reason"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["candidates"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "rank_roof_wash_candidates" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "För många förfrågningar – vänta en stund och försök igen.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Krediter slut – lägg till mer i Settings → Workspace → Usage.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI returned no tool call");
    }

    const args = JSON.parse(toolCall.function.arguments) as {
      candidates: AiScored[];
    };

    // Enrich AI results with full property data and sort by score
    const propertyMap = new Map(candidates.map((p) => [p.id, p]));
    const enriched = args.candidates
      .filter((c) => propertyMap.has(c.property_id))
      .map((c) => ({
        ...c,
        property: propertyMap.get(c.property_id)!,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return new Response(JSON.stringify({ candidates: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-roof-wash-leads error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Okänt fel",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
