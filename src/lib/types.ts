import type { Database } from "@/integrations/supabase/types";

// Database row types
export type DbLead = Database["public"]["Tables"]["leads"]["Row"];
export type DbProperty = Database["public"]["Tables"]["properties"]["Row"];
export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LeadSource = Database["public"]["Enums"]["lead_source"];
export type JobType = Database["public"]["Enums"]["job_type"];
export type PipelineStage = Database["public"]["Enums"]["pipeline_stage"];

export const PIPELINE_STAGES: PipelineStage[] = ["inkommande_webb", "saljpanel", "bokad", "pagaende", "slutford"];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  inkommande_webb: "Inkommande webb",
  saljpanel: "Säljpanel leads",
  bokad: "Bokade",
  pagaende: "Pågående",
  slutford: "Slutförda",
};

// Next stage in the pipeline (null = end)
export const NEXT_PIPELINE_STAGE: Record<PipelineStage, PipelineStage | null> = {
  inkommande_webb: "saljpanel",
  saljpanel: "bokad",
  bokad: "pagaende",
  pagaende: "slutford",
  slutford: null,
};

export const PIPELINE_ACTION_LABELS: Record<PipelineStage, string> = {
  inkommande_webb: "Flytta till Säljpanel",
  saljpanel: "Flytta till Bokade",
  bokad: "Flytta till Pågående",
  pagaende: "Markera som Slutförd",
  slutford: "Slutförd",
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  roof_replacement: "Takbyte",
  roof_cleaning: "Taktvätt",
  light_roof_work: "Lättare takarbeten",
};

export const JOB_TYPES: JobType[] = ["roof_replacement", "roof_cleaning", "light_roof_work"];

// Joined lead + property for UI display
export interface LeadWithProperty extends DbLead {
  property: DbProperty | null;
}

// Flattened lead for components (backward-compatible shape)
export interface Lead {
  id: string;
  name: string;
  phone: string;
  address: string;
  municipality: string;
  region: string;
  buildYear: number;
  roofType: string;
  roofAge: number;
  status: LeadStatus;
  source: LeadSource;
  jobType: JobType;
  pipelineStage: PipelineStage;
  age: number;
  notes: string;
  hasRoofPermit: boolean;
  lastContact: string | null;
  createdAt: string;
  propertyId: string | null;
}

// Convert DB join result to flat Lead
export function toFlatLead(lp: LeadWithProperty): Lead {
  const currentYear = new Date().getFullYear();
  const buildYear = lp.property?.build_year ?? 0;
  return {
    id: lp.id,
    name: lp.name,
    phone: lp.phone ?? "",
    address: lp.property?.address ?? "",
    municipality: lp.property?.municipality ?? "",
    region: lp.property?.region ?? "",
    buildYear,
    roofType: lp.property?.roof_type ?? "",
    roofAge: buildYear ? currentYear - buildYear : 0,
    status: lp.status,
    source: lp.source,
    jobType: lp.job_type,
    pipelineStage: lp.pipeline_stage,
    age: lp.age ?? 0,
    notes: lp.notes ?? "",
    hasRoofPermit: lp.property?.has_roof_permit ?? false,
    lastContact: lp.last_contact,
    createdAt: lp.created_at,
    propertyId: lp.property_id,
  };
}

export const REGIONS = [
  "Stockholm",
  "Uppsala",
  "Västmanland",
  "Södermanland",
  "Östergötland",
  "Jönköping",
  "Västra Götaland",
  "Skåne",
];

export const MUNICIPALITIES: Record<string, string[]> = {
  Stockholm: ["Norrtälje", "Vallentuna", "Österåker", "Värmdö", "Nacka", "Haninge", "Tyresö", "Huddinge", "Täby", "Danderyd", "Sollentuna", "Sundbyberg"],
  Uppsala: ["Uppsala", "Enköping", "Tierp", "Östhammar", "Knivsta"],
  "Västra Götaland": ["Göteborg", "Mölndal", "Kungälv", "Borås", "Trollhättan"],
  Skåne: ["Malmö", "Lund", "Helsingborg", "Kristianstad", "Ystad"],
};
