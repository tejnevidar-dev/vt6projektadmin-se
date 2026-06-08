import { supabase } from "@/integrations/supabase/client";
import type { LeadWithProperty, Lead } from "./types";
import { toFlatLead } from "./types";
import type { LeadStatus, LeadSource, JobType, PipelineStage } from "./types";
import { calculateLeadScore } from "./lead-scoring";
import { logActivity } from "./activities-api";
import { PIPELINE_STAGE_LABELS } from "./types";

const statusLabel: Record<LeadStatus, string> = {
  cold: "Kall",
  warm: "Varm",
  hot: "Het",
  customer: "Kund",
  lost: "Förlorad",
};

export interface BookingPatch {
  bookingDate?: string | null;
  price?: number | null;
  rotAmount?: number | null;
  assignmentType?: string | null;
  subcontractorName?: string | null;
  subcontractorPrice?: number | null;
  foremanName?: string | null;
  foremanUserId?: string | null;
}

export interface RoleUser {
  id: string;
  display_name: string | null;
  email: string;
}

/** Listar användare med en specifik roll (t.ex. arbetsledare). */
export async function listUsersWithRole(role: "admin" | "arbetsledare" | "saljare" | "hantverkare" | "underentreprenor" | "viewer"): Promise<RoleUser[]> {
  const { data, error } = await (supabase.rpc as any)("list_users_with_role", { _role: role });
  if (error) throw error;
  return (data ?? []) as RoleUser[];
}

export async function updateLeadPipelineStage(
  id: string,
  stage: PipelineStage,
  fromStage?: PipelineStage,
  booking?: BookingPatch,
): Promise<void> {
  const patch: Record<string, unknown> = { pipeline_stage: stage };
  if (booking) {
    if (booking.bookingDate !== undefined) patch.booking_date = booking.bookingDate;
    if (booking.price !== undefined) patch.price = booking.price;
    if (booking.rotAmount !== undefined) patch.rot_amount = booking.rotAmount;
    if (booking.assignmentType !== undefined) patch.assignment_type = booking.assignmentType;
    if (booking.subcontractorName !== undefined) patch.subcontractor_name = booking.subcontractorName;
    if (booking.subcontractorPrice !== undefined) patch.subcontractor_price = booking.subcontractorPrice;
    if (booking.foremanName !== undefined) patch.foreman_name = booking.foremanName;
  }
  const { error } = await (supabase.from("leads") as any)
    .update(patch)
    .eq("id", id);
  if (error) throw error;
  const parts: string[] = [];
  if (booking?.bookingDate) {
    parts.push(`bokat ${new Date(booking.bookingDate).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}`);
  }
  if (booking?.price != null) parts.push(`pris ${booking.price} kr`);
  if (booking?.rotAmount != null) parts.push(`ROT ${booking.rotAmount} kr`);
  if (booking?.assignmentType === "subcontractor" && booking.subcontractorName) {
    parts.push(`UE: ${booking.subcontractorName}${booking.subcontractorPrice != null ? ` (${booking.subcontractorPrice} kr)` : ""}`);
  }
  if (booking?.assignmentType === "foreman" && booking.foremanName) {
    parts.push(`Arbetsledare: ${booking.foremanName}`);
  }
  const bookingNote = parts.length ? ` (${parts.join(", ")})` : "";
  await logActivity(
    id,
    "stage_change",
    fromStage
      ? `Flyttade från ${PIPELINE_STAGE_LABELS[fromStage]} till ${PIPELINE_STAGE_LABELS[stage]}${bookingNote}`
      : `Flyttade till ${PIPELINE_STAGE_LABELS[stage]}${bookingNote}`,
    { from: fromStage ?? null, to: stage, ...(booking ?? {}) }
  );
}

export async function updateLeadBooking(id: string, booking: BookingPatch): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (booking.bookingDate !== undefined) patch.booking_date = booking.bookingDate;
  if (booking.price !== undefined) patch.price = booking.price;
  if (booking.rotAmount !== undefined) patch.rot_amount = booking.rotAmount;
  if (booking.assignmentType !== undefined) patch.assignment_type = booking.assignmentType;
  if (booking.subcontractorName !== undefined) patch.subcontractor_name = booking.subcontractorName;
  if (booking.subcontractorPrice !== undefined) patch.subcontractor_price = booking.subcontractorPrice;
  if (booking.foremanName !== undefined) patch.foreman_name = booking.foremanName;
  if (Object.keys(patch).length === 0) return;
  const { error } = await (supabase.from("leads") as any).update(patch).eq("id", id);
  if (error) throw error;
  const parts: string[] = [];
  if (booking.bookingDate !== undefined) {
    parts.push(booking.bookingDate
      ? `arbetsstart ${new Date(booking.bookingDate).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}`
      : "arbetsstart rensad");
  }
  if (booking.price !== undefined) parts.push(booking.price != null ? `pris ${booking.price} kr` : "pris rensat");
  if (booking.rotAmount !== undefined) parts.push(booking.rotAmount != null ? `ROT ${booking.rotAmount} kr` : "ROT rensat");
  if (booking.subcontractorName !== undefined) {
    parts.push(booking.subcontractorName ? `UE: ${booking.subcontractorName}` : "UE rensad");
  }
  await logActivity(id, "updated", `Bokning uppdaterad (${parts.join(", ")})`, booking as Record<string, unknown>);
}

export async function setLeadNeedsOffer(id: string, needsOffer: boolean): Promise<void> {
  const { error } = await (supabase.from("leads") as any)
    .update({ needs_offer: needsOffer })
    .eq("id", id);
  if (error) throw error;
  await logActivity(
    id,
    "updated",
    needsOffer ? "Markerad som Att offertera" : "Borttagen från Att offertera",
    { needs_offer: needsOffer }
  );
}

export async function setLeadRotPaid(id: string, rotPaid: boolean): Promise<void> {
  const { error } = await (supabase.from("leads") as any)
    .update({ rot_paid: rotPaid })
    .eq("id", id);
  if (error) throw error;
  await logActivity(
    id,
    "updated",
    rotPaid ? "ROT markerad som begärd" : "ROT avmarkerad som begärd",
    { rot_paid: rotPaid }
  );
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

const OFFERS_BUCKET = "offers";

export async function uploadOfferPdf(leadId: string, file: File): Promise<string> {
  if (file.type !== "application/pdf") {
    throw new Error("Endast PDF-filer kan laddas upp som offert.");
  }
  const path = `${leadId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from(OFFERS_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw upErr;

  // Try to remove previous offer
  const { data: existing } = await supabase.from("leads").select("offer_pdf_path").eq("id", leadId).single();
  const oldPath = (existing as { offer_pdf_path?: string | null } | null)?.offer_pdf_path;

  const { error: updErr } = await (supabase.from("leads") as any)
    .update({ offer_pdf_path: path })
    .eq("id", leadId);
  if (updErr) throw updErr;

  if (oldPath && oldPath !== path) {
    await supabase.storage.from(OFFERS_BUCKET).remove([oldPath]);
  }

  await logActivity(leadId, "updated", `Offert-PDF uppladdad (${file.name})`, { offer_pdf_path: path });
  return path;
}

export async function removeOfferPdf(leadId: string, path: string): Promise<void> {
  await supabase.storage.from(OFFERS_BUCKET).remove([path]);
  const { error } = await (supabase.from("leads") as any)
    .update({ offer_pdf_path: null })
    .eq("id", leadId);
  if (error) throw error;
  await logActivity(leadId, "updated", "Offert-PDF borttagen");
}

export async function getOfferPdfSignedUrl(path: string, expiresIn = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage.from(OFFERS_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, property:properties(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as LeadWithProperty[]).map(toFlatLead);
}

/** Returnerar id på existerande lead om telefon redan finns. */
export async function findLeadByPhone(phone: string): Promise<{ id: string; name: string } | null> {
  const normalized = phone.replace(/[\s-]/g, "");
  if (!normalized) return null;
  const { data } = await supabase
    .from("leads")
    .select("id, name, phone")
    .ilike("phone", `%${normalized.slice(-7)}%`)
    .limit(5);
  const match = (data ?? []).find((l) => (l.phone ?? "").replace(/[\s-]/g, "") === normalized);
  return match ? { id: match.id, name: match.name } : null;
}

export async function assignLead(id: string, assignedTo: string | null, assigneeName?: string): Promise<void> {
  const { error } = await (supabase.from("leads") as any)
    .update({ assigned_to: assignedTo })
    .eq("id", id);
  if (error) throw error;
  await logActivity(
    id,
    "assignment",
    assignedTo ? `Tilldelad till ${assigneeName ?? "säljare"}` : "Tilldelning borttagen",
    { assigned_to: assignedTo }
  );
}

function computeAndPersistScore(leadId: string, score: number) {
  return (supabase.from("leads") as any).update({ score }).eq("id", leadId);
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
  jobType: JobType;
  notes: string;
}): Promise<Lead> {
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

  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id ?? null;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      property_id: prop.id,
      name: input.name,
      phone: input.phone,
      age: input.age || null,
      status: input.status,
      source: input.source,
      job_type: input.jobType,
      notes: input.notes,
      created_by: currentUserId,
    })
    .select("*, property:properties(*)")
    .single();

  if (leadError) throw leadError;

  const flat = toFlatLead(lead as LeadWithProperty);
  const score = calculateLeadScore(flat);
  await computeAndPersistScore(flat.id, score);
  await logActivity(flat.id, "created", `Lead skapat (${input.source})`, { source: input.source });

  return { ...flat, /* score not in flat type */ };
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

export async function importCsv(rows: CsvRow[], jobType: JobType = "roof_replacement"): Promise<number> {
  let imported = 0;
  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id ?? null;

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

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        property_id: prop.id,
        name: row.name || "Okänd",
        phone: row.phone || null,
        age: parseInt(row.age) || null,
        status: "cold",
        source: "csv_import",
        job_type: jobType,
        created_by: currentUserId,
      })
      .select("*, property:properties(*)")
      .single();

    if (!leadError && lead) {
      imported++;
      const flat = toFlatLead(lead as LeadWithProperty);
      const score = calculateLeadScore(flat);
      await computeAndPersistScore(flat.id, score);
    }
  }

  return imported;
}

export async function updateLead(input: {
  id: string;
  name: string;
  phone: string;
  address: string;
  municipality: string;
  region: string;
  buildYear: number;
  roofType: string;
  age: number;
  status: LeadStatus;
  jobType: JobType;
  notes: string;
  propertyId: string | null;
}): Promise<Lead> {
  if (input.propertyId) {
    const { error: propError } = await supabase
      .from("properties")
      .update({
        address: input.address,
        municipality: input.municipality,
        region: input.region,
        build_year: input.buildYear || null,
        roof_type: input.roofType,
        roof_age: input.buildYear ? new Date().getFullYear() - input.buildYear : null,
      })
      .eq("id", input.propertyId);

    if (propError) throw propError;
  }

  // Hämta gammalt status för att kunna logga
  const { data: prev } = await supabase.from("leads").select("status").eq("id", input.id).single();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .update({
      name: input.name,
      phone: input.phone,
      age: input.age || null,
      status: input.status,
      job_type: input.jobType,
      notes: input.notes,
    })
    .eq("id", input.id)
    .select("*, property:properties(*)")
    .single();

  if (leadError) throw leadError;
  const flat = toFlatLead(lead as LeadWithProperty);
  const score = calculateLeadScore(flat);
  await computeAndPersistScore(flat.id, score);

  if (prev && prev.status !== input.status) {
    await logActivity(
      flat.id,
      "status_change",
      `Status: ${statusLabel[prev.status as LeadStatus]} → ${statusLabel[input.status]}`,
      { from: prev.status, to: input.status }
    );
  } else {
    await logActivity(flat.id, "updated", "Lead uppdaterades");
  }

  return flat;
}

/** Räkna om score för alla leads (manuell trigger). */
export async function recomputeAllScores(): Promise<number> {
  const leads = await fetchLeads();
  let updated = 0;
  for (const lead of leads) {
    const score = calculateLeadScore(lead);
    const { error } = await (supabase.from("leads") as any)
      .update({ score })
      .eq("id", lead.id);
    if (!error) updated++;
  }
  return updated;
}

export async function bulkUpdateStage(leadIds: string[], stage: PipelineStage): Promise<void> {
  const { error } = await supabase.from("leads").update({ pipeline_stage: stage }).in("id", leadIds);
  if (error) throw error;
  for (const id of leadIds) {
    await logActivity(id, "stage_change", `Bulk-flytt till ${PIPELINE_STAGE_LABELS[stage]}`, { to: stage });
  }
}

export async function bulkAssign(leadIds: string[], assignedTo: string | null, assigneeName?: string): Promise<void> {
  const { error } = await (supabase.from("leads") as any)
    .update({ assigned_to: assignedTo })
    .in("id", leadIds);
  if (error) throw error;
  for (const id of leadIds) {
    await logActivity(
      id,
      "assignment",
      assignedTo ? `Bulk-tilldelad till ${assigneeName ?? "säljare"}` : "Bulk-borttagen tilldelning",
      { assigned_to: assignedTo }
    );
  }
}

export async function bulkDelete(leadIds: string[]): Promise<void> {
  const { error } = await supabase.from("leads").delete().in("id", leadIds);
  if (error) throw error;
}
