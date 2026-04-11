import { supabase } from "@/integrations/supabase/client";
import type { LeadWithProperty, Lead } from "./types";
import { toFlatLead } from "./types";
import type { LeadStatus, LeadSource } from "./types";

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, property:properties(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as LeadWithProperty[]).map(toFlatLead);
}

export async function addLead(input: {
  name: string;
  phone: string;
  address: string;
  municipality: string;
  region: string;
  buildYear: number;
  roofType: string;
  age: number;
  status: LeadStatus;
  source: LeadSource;
  notes: string;
}): Promise<Lead> {
  // Create property first
  const { data: prop, error: propError } = await supabase
    .from("properties")
    .insert({
      address: input.address,
      municipality: input.municipality,
      region: input.region,
      build_year: input.buildYear || null,
      roof_type: input.roofType,
      roof_age: input.buildYear ? new Date().getFullYear() - input.buildYear : null,
    })
    .select()
    .single();

  if (propError) throw propError;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      property_id: prop.id,
      name: input.name,
      phone: input.phone,
      age: input.age || null,
      status: input.status,
      source: input.source,
      notes: input.notes,
    })
    .select("*, property:properties(*)")
    .single();

  if (leadError) throw leadError;
  return toFlatLead(lead as LeadWithProperty);
}

export interface CsvRow {
  name: string;
  phone: string;
  address: string;
  municipality: string;
  region: string;
  build_year: string;
  roof_type: string;
  age: string;
}

export async function importCsv(rows: CsvRow[]): Promise<number> {
  let imported = 0;

  for (const row of rows) {
    const buildYear = parseInt(row.build_year) || null;

    const { data: prop, error: propError } = await supabase
      .from("properties")
      .insert({
        address: row.address || "Okänd adress",
        municipality: row.municipality || "",
        region: row.region || "",
        build_year: buildYear,
        roof_type: row.roof_type || null,
        roof_age: buildYear ? new Date().getFullYear() - buildYear : null,
      })
      .select()
      .single();

    if (propError) continue;

    const { error: leadError } = await supabase
      .from("leads")
      .insert({
        property_id: prop.id,
        name: row.name || "Okänd",
        phone: row.phone || null,
        age: parseInt(row.age) || null,
        status: "cold",
        source: "csv_import",
      });

    if (!leadError) imported++;
  }

  return imported;
}
