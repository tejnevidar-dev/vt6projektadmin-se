import { supabase } from "@/integrations/supabase/client";
import type { Lead, LeadWithProperty } from "./types";
import { toFlatLead } from "./types";

export interface RoofWashCandidate {
  property_id: string;
  score: number;
  reason: string;
  property: {
    id: string;
    address: string;
    municipality: string;
    region: string;
    build_year: number | null;
    roof_type: string | null;
    roof_age: number | null;
  };
}

export interface GenerateLeadsResponse {
  candidates: RoofWashCandidate[];
  message?: string;
}

export async function generateRoofWashCandidates(limit: number): Promise<GenerateLeadsResponse> {
  const { data, error } = await supabase.functions.invoke<GenerateLeadsResponse>(
    "generate-roof-wash-leads",
    { body: { limit } }
  );

  if (error) {
    // Try to read the response body for our custom error message
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const payload = await ctx.json();
        if (payload?.error) throw new Error(payload.error);
      } catch {
        /* fall through */
      }
    }
    throw error;
  }
  if (!data) throw new Error("Tomt svar från servern");
  return data;
}

export async function createLeadsFromCandidates(
  candidates: RoofWashCandidate[]
): Promise<Lead[]> {
  const created: Lead[] = [];

  for (const c of candidates) {
    // Update property with score + reason
    await supabase
      .from("properties")
      .update({
        roof_wash_score: c.score,
        roof_wash_reason: c.reason,
      })
      .eq("id", c.property_id);

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        property_id: c.property_id,
        name: c.property.address || "Okänd",
        job_type: "roof_cleaning",
        source: "scan",
        status: "cold",
        notes: `AI-genererad lead (poäng ${c.score}/100): ${c.reason}`,
      })
      .select("*, property:properties(*)")
      .single();

    if (!error && lead) {
      created.push(toFlatLead(lead as LeadWithProperty));
    }
  }

  return created;
}
