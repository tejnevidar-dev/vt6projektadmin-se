import type { Database } from "@/integrations/supabase/types";

// Database row types
export type DbLead = Database["public"]["Tables"]["leads"]["Row"];
export type DbProperty = Database["public"]["Tables"]["properties"]["Row"];
export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LeadSource = Database["public"]["Enums"]["lead_source"];
export type JobType = Database["public"]["Enums"]["job_type"];
export type PipelineStage = Database["public"]["Enums"]["pipeline_stage"];
export type LostReason = Database["public"]["Enums"]["lost_reason"];

export const LOST_REASONS: LostReason[] = [
  "for_dyrt",
  "konkurrent",
  "kunden_avvaktar",
  "ingen_finansiering",
  "svarar_inte",
  "projektet_installt",
  "annan_losning",
  "dalig_timing",
  "annat",
];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  for_dyrt: "För dyrt",
  konkurrent: "Konkurrent",
  kunden_avvaktar: "Kunden avvaktar",
  ingen_finansiering: "Ingen finansiering",
  svarar_inte: "Kunden svarar inte",
  projektet_installt: "Projektet inställt",
  annan_losning: "Valde annan lösning",
  dalig_timing: "Dålig timing",
  annat: "Annat",
};

export const PIPELINE_STAGES: PipelineStage[] = [
  "inkommande_webb",
  "saljpanel",
  "kontaktad",
  "mote_bokat",
  "mote_genomfort",
  "offererad",
  "offert_skickad",
  "uppfoljning",
  "forhandling",
  "bokad",
  "pagaende",
  "slutford",
  "forlorad",
];

/** Stegen som visas i säljarnas kanban (hela säljresan). */
export const SALES_PIPELINE_STAGES: PipelineStage[] = [
  "saljpanel",
  "kontaktad",
  "mote_bokat",
  "mote_genomfort",
  "offererad",
  "offert_skickad",
  "uppfoljning",
  "forhandling",
  "bokad",
  "forlorad",
];

/** Steg som räknas som vunnen affär. */
export const WON_STAGES: PipelineStage[] = ["bokad", "pagaende", "slutford"];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  inkommande_webb: "Inkommande webb",
  saljpanel: "Nytt lead",
  kontaktad: "Kontaktad",
  mote_bokat: "Möte bokat",
  mote_genomfort: "Möte genomfört",
  offererad: "Offert skapas",
  offert_skickad: "Offert skickad",
  uppfoljning: "Uppföljning",
  forhandling: "Förhandling",
  bokad: "Vunnen – jobb bokat",
  pagaende: "Pågående",
  slutford: "Slutförda",
  forlorad: "Förlorad",
};

// Next stage in the pipeline (null = end)
export const NEXT_PIPELINE_STAGE: Record<PipelineStage, PipelineStage | null> = {
  inkommande_webb: "saljpanel",
  saljpanel: "kontaktad",
  kontaktad: "mote_bokat",
  mote_bokat: "mote_genomfort",
  mote_genomfort: "offererad",
  offererad: "offert_skickad",
  offert_skickad: "uppfoljning",
  uppfoljning: "forhandling",
  forhandling: "bokad",
  bokad: "pagaende",
  pagaende: "slutford",
  slutford: null,
  forlorad: null,
};

export const PREVIOUS_PIPELINE_STAGE: Record<PipelineStage, PipelineStage | null> = {
  inkommande_webb: null,
  saljpanel: "inkommande_webb",
  kontaktad: "saljpanel",
  mote_bokat: "kontaktad",
  mote_genomfort: "mote_bokat",
  offererad: "mote_genomfort",
  offert_skickad: "offererad",
  uppfoljning: "offert_skickad",
  forhandling: "uppfoljning",
  bokad: "forhandling",
  pagaende: "bokad",
  slutford: "pagaende",
  forlorad: "saljpanel",
};

export const PIPELINE_BACK_LABELS: Record<PipelineStage, string> = {
  inkommande_webb: "Tillbaka",
  saljpanel: "Tillbaka till Inkommande webb",
  kontaktad: "Tillbaka till Nytt lead",
  mote_bokat: "Tillbaka till Kontaktad",
  mote_genomfort: "Tillbaka till Möte bokat",
  offererad: "Tillbaka till Möte genomfört",
  offert_skickad: "Tillbaka till Offert skapas",
  uppfoljning: "Tillbaka till Offert skickad",
  forhandling: "Tillbaka till Uppföljning",
  bokad: "Tillbaka till Förhandling",
  pagaende: "Tillbaka till Bokade",
  slutford: "Tillbaka till Pågående",
  forlorad: "Återöppna lead",
};

export const PIPELINE_ACTION_LABELS: Record<PipelineStage, string> = {
  inkommande_webb: "Flytta till Nytt lead",
  saljpanel: "Markera som Kontaktad",
  kontaktad: "Boka möte",
  mote_bokat: "Möte genomfört",
  mote_genomfort: "Skapa offert",
  offererad: "Markera offert skickad",
  offert_skickad: "Flytta till Uppföljning",
  uppfoljning: "Flytta till Förhandling",
  forhandling: "Markera som Vunnen",
  bokad: "Flytta till Pågående",
  pagaende: "Markera som Slutförd",
  slutford: "Slutförd",
  forlorad: "Förlorad",
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
  assignedTo: string | null;
  createdBy: string | null;
  score: number;
  bookingDate: string | null;
  price: number | null;
  /** Materialkostnad (kr) – fylls i vid "Att offertera". */
  materialCost: number | null;
  rotAmount: number | null;
  assignmentType: string | null;
  subcontractorName: string | null;
  subcontractorPrice: number | null;
  foremanName: string | null;
  offerPdfPath: string | null;
  needsOffer: boolean;
  rotPaid: boolean;
  contactPersonId: string | null;
  propertyDesignation: string | null;
  personalNumber: string | null;
  rotEligible: boolean;
  invoiced: boolean;
  invoicedAt: string | null;
  invoiceDueDate: string | null;
  rotAppliedAt: string | null;
  economyNote: string | null;
  sellerId: string | null;
  commissionRate: number | null;
  completedAt: string | null;
  /** Datum då kunden godkände offerten (styr säljstatistiken). */
  offerAcceptedAt: string | null;
  lostReason: LostReason | null;
  lostCompetitor: string | null;
  lostNote: string | null;
  lostAt: string | null;
}

/** True om en bokad lead saknar pris eller tilldelning (UE / arbetsledare). */
export function hasIncompleteBooking(lead: Pick<Lead, "pipelineStage" | "price" | "assignmentType">): boolean {
  if (lead.pipelineStage !== "bokad") return false;
  const missingPrice = lead.price == null;
  const missingAssignment = !lead.assignmentType || lead.assignmentType === "none";
  return missingPrice || missingAssignment;
}

export interface RotUnderlag {
  rotEligible: boolean;
  personalNumber: string | null;
  propertyDesignation: string | null;
  price: number | null;
  rotAmount: number | null;
  address?: string;
}

/** Normaliserar personnummer till 12 siffror (ÅÅÅÅMMDDXXXX) om möjligt. */
export function normalizePersonalNumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12) return digits;
  if (digits.length === 10) {
    const yy = Number(digits.slice(0, 2));
    const currentYY = new Date().getFullYear() % 100;
    const century = yy > currentYY ? "19" : "20";
    return century + digits;
  }
  return digits;
}

export function isValidPersonalNumber(input: string | null | undefined): boolean {
  if (!input) return false;
  const digits = input.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 12;
}

/** Returnerar lista med saknade fält i ROT-underlaget. Tom lista = komplett. */
export function missingRotUnderlag(u: RotUnderlag): string[] {
  const missing: string[] = [];
  if (u.price == null) missing.push("Pris");
  if (!u.rotEligible) return missing;
  if (!isValidPersonalNumber(u.personalNumber)) missing.push("Personnummer");
  if (!u.propertyDesignation || !u.propertyDesignation.trim()) missing.push("Fastighetsbeteckning");
  if (u.rotAmount == null) missing.push("ROT-belopp");
  if (u.address !== undefined && !u.address.trim()) missing.push("Adress");
  return missing;
}

export function leadMissingRotUnderlag(lead: Lead): string[] {
  return missingRotUnderlag({
    rotEligible: lead.rotEligible,
    personalNumber: lead.personalNumber,
    propertyDesignation: lead.propertyDesignation,
    price: lead.price,
    rotAmount: lead.rotAmount,
    address: lead.address,
  });
}

/** Slutförd men ännu inte fakturerad. */
export function isUninvoiced(lead: Lead): boolean {
  return lead.pipelineStage === "slutford" && !lead.invoiced;
}

/**
 * ROT ska ansökas: fakturerad, ROT-belopp finns, ej redan ansökt och
 * det har gått minst 1 dag sedan fakturans förfallodatum.
 */
export function isRotApplicationDue(lead: Lead, now: Date = new Date()): boolean {
  if (!lead.rotEligible) return false;
  if (lead.rotPaid) return false;
  if ((lead.rotAmount ?? 0) <= 0) return false;
  if (!lead.invoiced || !lead.invoiceDueDate) return false;
  const due = new Date(`${lead.invoiceDueDate}T00:00:00`);
  const threshold = new Date(due.getTime() + 24 * 60 * 60 * 1000);
  return now >= threshold;
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
    assignedTo: (lp as { assigned_to?: string | null }).assigned_to ?? null,
    createdBy: (lp as { created_by?: string | null }).created_by ?? null,
    score: (lp as { score?: number | null }).score ?? 0,
    bookingDate: (lp as { booking_date?: string | null }).booking_date ?? null,
    price: (lp as { price?: number | null }).price ?? null,
    materialCost: (lp as { material_cost?: number | null }).material_cost ?? null,
    rotAmount: (lp as { rot_amount?: number | null }).rot_amount ?? null,
    assignmentType: (lp as { assignment_type?: string | null }).assignment_type ?? null,
    subcontractorName: (lp as { subcontractor_name?: string | null }).subcontractor_name ?? null,
    subcontractorPrice: (lp as { subcontractor_price?: number | null }).subcontractor_price ?? null,
    foremanName: (lp as { foreman_name?: string | null }).foreman_name ?? null,
    offerPdfPath: (lp as { offer_pdf_path?: string | null }).offer_pdf_path ?? null,
    needsOffer: (lp as { needs_offer?: boolean | null }).needs_offer ?? false,
    rotPaid: (lp as { rot_paid?: boolean | null }).rot_paid ?? false,
    contactPersonId: (lp as { contact_person_id?: string | null }).contact_person_id ?? null,
    propertyDesignation: lp.property?.property_designation ?? null,
    personalNumber: (lp as { personal_number?: string | null }).personal_number ?? null,
    rotEligible: (lp as { rot_eligible?: boolean | null }).rot_eligible ?? true,
    invoiced: (lp as { invoiced?: boolean | null }).invoiced ?? false,
    invoicedAt: (lp as { invoiced_at?: string | null }).invoiced_at ?? null,
    invoiceDueDate: (lp as { invoice_due_date?: string | null }).invoice_due_date ?? null,
    rotAppliedAt: (lp as { rot_applied_at?: string | null }).rot_applied_at ?? null,
    economyNote: (lp as { economy_note?: string | null }).economy_note ?? null,
    sellerId: (lp as { seller_id?: string | null }).seller_id ?? null,
    commissionRate: (lp as { commission_rate?: number | null }).commission_rate ?? null,
    completedAt: (lp as { completed_at?: string | null }).completed_at ?? null,
    offerAcceptedAt: (lp as { offer_accepted_at?: string | null }).offer_accepted_at ?? null,
    lostReason: (lp as { lost_reason?: LostReason | null }).lost_reason ?? null,
    lostCompetitor: (lp as { lost_competitor?: string | null }).lost_competitor ?? null,
    lostNote: (lp as { lost_note?: string | null }).lost_note ?? null,
    lostAt: (lp as { lost_at?: string | null }).lost_at ?? null,
  };
}

export const REGIONS = [
  "Stockholm",
  "Uppsala",
  "Södermanland",
  "Östergötland",
  "Jönköping",
  "Kronoberg",
  "Kalmar",
  "Gotland",
  "Blekinge",
  "Skåne",
  "Halland",
  "Västra Götaland",
  "Värmland",
  "Örebro",
  "Västmanland",
  "Dalarna",
  "Gävleborg",
  "Västernorrland",
  "Jämtland",
  "Västerbotten",
  "Norrbotten",
];

export const MUNICIPALITIES: Record<string, string[]> = {
  Stockholm: ["Botkyrka", "Danderyd", "Ekerö", "Haninge", "Huddinge", "Järfälla", "Lidingö", "Nacka", "Norrtälje", "Nykvarn", "Nynäshamn", "Salem", "Sigtuna", "Sollentuna", "Solna", "Stockholm", "Sundbyberg", "Södertälje", "Tyresö", "Täby", "Upplands-Bro", "Upplands Väsby", "Vallentuna", "Vaxholm", "Värmdö", "Österåker"],
  Uppsala: ["Enköping", "Heby", "Håbo", "Knivsta", "Tierp", "Uppsala", "Älvkarleby", "Östhammar"],
  Södermanland: ["Eskilstuna", "Flen", "Gnesta", "Katrineholm", "Nyköping", "Oxelösund", "Strängnäs", "Trosa", "Vingåker"],
  Östergötland: ["Boxholm", "Finspång", "Kinda", "Linköping", "Mjölby", "Motala", "Norrköping", "Söderköping", "Vadstena", "Valdemarsvik", "Ydre", "Åtvidaberg", "Ödeshög"],
  Jönköping: ["Aneby", "Eksjö", "Gislaved", "Gnosjö", "Habo", "Jönköping", "Mullsjö", "Nässjö", "Sävsjö", "Tranås", "Vaggeryd", "Vetlanda", "Värnamo"],
  Kronoberg: ["Alvesta", "Lessebo", "Ljungby", "Markaryd", "Tingsryd", "Uppvidinge", "Växjö", "Älmhult"],
  Kalmar: ["Borgholm", "Emmaboda", "Hultsfred", "Högsby", "Kalmar", "Mönsterås", "Mörbylånga", "Nybro", "Oskarshamn", "Torsås", "Vimmerby", "Västervik"],
  Gotland: ["Gotland"],
  Blekinge: ["Karlshamn", "Karlskrona", "Olofström", "Ronneby", "Sölvesborg"],
  Skåne: ["Bjuv", "Bromölla", "Burlöv", "Båstad", "Eslöv", "Helsingborg", "Hässleholm", "Höganäs", "Hörby", "Höör", "Klippan", "Kristianstad", "Kävlinge", "Landskrona", "Lomma", "Lund", "Malmö", "Osby", "Perstorp", "Simrishamn", "Sjöbo", "Skurup", "Staffanstorp", "Svalöv", "Svedala", "Tomelilla", "Trelleborg", "Vellinge", "Ystad", "Åstorp", "Ängelholm", "Örkelljunga", "Östra Göinge"],
  Halland: ["Falkenberg", "Halmstad", "Hylte", "Kungsbacka", "Laholm", "Varberg"],
  "Västra Götaland": ["Ale", "Alingsås", "Bengtsfors", "Bollebygd", "Borås", "Dals-Ed", "Essunga", "Falköping", "Färgelanda", "Grästorp", "Gullspång", "Göteborg", "Götene", "Herrljunga", "Hjo", "Härryda", "Karlsborg", "Kungälv", "Lerum", "Lidköping", "Lilla Edet", "Lysekil", "Mariestad", "Mark", "Mellerud", "Munkedal", "Mölndal", "Orust", "Partille", "Skara", "Skövde", "Sotenäs", "Stenungsund", "Strömstad", "Svenljunga", "Tanum", "Tibro", "Tidaholm", "Tjörn", "Tranemo", "Trollhättan", "Töreboda", "Uddevalla", "Ulricehamn", "Vara", "Vårgårda", "Vänersborg", "Åmål", "Öckerö"],
  Värmland: ["Arvika", "Eda", "Filipstad", "Forshaga", "Grums", "Hagfors", "Hammarö", "Karlstad", "Kil", "Kristinehamn", "Munkfors", "Storfors", "Sunne", "Säffle", "Torsby", "Årjäng"],
  Örebro: ["Askersund", "Degerfors", "Hallsberg", "Hällefors", "Karlskoga", "Kumla", "Laxå", "Lekeberg", "Lindesberg", "Ljusnarsberg", "Nora", "Örebro"],
  Västmanland: ["Arboga", "Fagersta", "Hallstahammar", "Kungsör", "Köping", "Norberg", "Sala", "Skinnskatteberg", "Surahammar", "Västerås"],
  Dalarna: ["Avesta", "Borlänge", "Falun", "Gagnef", "Hedemora", "Leksand", "Ludvika", "Malung-Sälen", "Mora", "Orsa", "Rättvik", "Smedjebacken", "Säter", "Vansbro", "Älvdalen"],
  Gävleborg: ["Bollnäs", "Gävle", "Hofors", "Hudiksvall", "Ljusdal", "Nordanstig", "Ockelbo", "Ovanåker", "Sandviken", "Söderhamn"],
  Västernorrland: ["Härnösand", "Kramfors", "Sollefteå", "Sundsvall", "Timrå", "Ånge", "Örnsköldsvik"],
  Jämtland: ["Berg", "Bräcke", "Härjedalen", "Krokom", "Ragunda", "Strömsund", "Åre", "Östersund"],
  Västerbotten: ["Bjurholm", "Dorotea", "Lycksele", "Malå", "Nordmaling", "Norsjö", "Robertsfors", "Skellefteå", "Sorsele", "Storuman", "Umeå", "Vilhelmina", "Vindeln", "Vännäs", "Åsele"],
  Norrbotten: ["Arjeplog", "Arvidsjaur", "Boden", "Gällivare", "Haparanda", "Jokkmokk", "Kalix", "Kiruna", "Luleå", "Pajala", "Piteå", "Älvsbyn", "Överkalix", "Övertorneå"],
};
