import { supabase } from "@/integrations/supabase/client";
import type { CalcInput, CalcResult, PlatItem, TillaggRow } from "./calc-engine";

export interface CalculationRow {
  id: string;
  lead_id: string;
  created_by: string;
  roof_area_kvm: number;
  material_key: string | null;
  ranndalar_meter: number;
  plat_items: PlatItem[];
  tillagg: TillaggRow[];
  arbete_timmar: number;
  arbete_timpris: number;
  marginal_procent: number;
  rot_avdrag: boolean;
  subtotal: number;
  moms: number;
  total: number;
  rot_belopp: number;
  att_betala: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchCalculationForLead(leadId: string): Promise<CalculationRow | null> {
  const { data, error } = await supabase
    .from("calculations")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw error;
  return (data as CalculationRow | null) ?? null;
}

export async function upsertCalculation(input: {
  leadId: string;
  calc: CalcInput;
  result: CalcResult;
  notes?: string | null;
}): Promise<CalculationRow> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Ej inloggad");

  const payload = {
    lead_id: input.leadId,
    created_by: userId,
    roof_area_kvm: input.calc.roofAreaKvm,
    material_key: input.calc.materialKey,
    ranndalar_meter: input.calc.ranndalarMeter,
    plat_items: input.calc.platItems as unknown as any,
    tillagg: input.calc.tillagg as unknown as any,
    arbete_timmar: input.calc.arbeteTimmar,
    arbete_timpris: input.calc.arbeteTimpris,
    marginal_procent: input.calc.marginalProcent,
    rot_avdrag: input.calc.rotAvdrag,
    subtotal: input.result.subtotal,
    moms: input.result.moms,
    total: input.result.total,
    rot_belopp: input.result.rotBelopp,
    att_betala: input.result.attBetala,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("calculations")
    .upsert(payload, { onConflict: "lead_id" })
    .select()
    .single();
  if (error) throw error;
  return data as CalculationRow;
}

export interface OfferRow {
  id: string;
  lead_id: string;
  calculation_id: string | null;
  version: number;
  pdf_path: string;
  status: "draft" | "skickad" | "accepterad" | "avvisad";
  total_amount: number;
  sent_at: string | null;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchOffersForLead(leadId: string): Promise<OfferRow[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("lead_id", leadId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OfferRow[];
}

export async function updateOfferStatus(
  offerId: string,
  status: OfferRow["status"],
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "skickad") patch.sent_at = new Date().toISOString();
  if (status === "accepterad") patch.accepted_at = new Date().toISOString();
  const { error } = await supabase.from("offers").update(patch).eq("id", offerId);
  if (error) throw error;
}
