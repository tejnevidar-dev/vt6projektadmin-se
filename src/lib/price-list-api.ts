import { supabase } from "@/integrations/supabase/client";
import type { PriceRow, PriceCategory, PriceUnit } from "./calc-engine";

export async function fetchPriceList(): Promise<PriceRow[]> {
  const { data, error } = await supabase
    .from("price_list")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PriceRow[];
}

export async function fetchActivePriceList(): Promise<PriceRow[]> {
  const rows = await fetchPriceList();
  return rows.filter((r) => r.is_active);
}

export interface PriceRowInput {
  category: PriceCategory;
  key: string;
  label: string;
  unit: PriceUnit;
  unit_price: number;
  is_active?: boolean;
  sort_order?: number;
}

export async function createPriceRow(input: PriceRowInput): Promise<PriceRow> {
  const { data, error } = await supabase
    .from("price_list")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as PriceRow;
}

export async function updatePriceRow(id: string, patch: Partial<PriceRowInput>): Promise<void> {
  const { error } = await supabase.from("price_list").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePriceRow(id: string): Promise<void> {
  const { error } = await supabase.from("price_list").delete().eq("id", id);
  if (error) throw error;
}
