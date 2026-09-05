import { supabase } from "@/integrations/supabase/client";

const BUCKET = "subcontractor-docs";

export type SubcontractorDocType = "avtal" | "forsakring" | "f_skatt" | "id" | "ovrigt";
export type InvoiceStatus = "mottagen" | "godkand" | "avvisad" | "betald";

export const DOC_TYPE_LABEL: Record<SubcontractorDocType, string> = {
  avtal: "Avtal",
  forsakring: "Försäkringsbevis",
  f_skatt: "F-skattebevis",
  id: "ID/legitimation",
  ovrigt: "Övrigt",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  mottagen: "Mottagen",
  godkand: "Godkänd",
  avvisad: "Avvisad",
  betald: "Betald",
};

export interface Subcontractor {
  id: string;
  user_id: string | null;
  company_name: string;
  org_number: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  f_skatt: boolean;
  insurance_company: string | null;
  insurance_expires_at: string | null;
  agreement_signed_at: string | null;
  hourly_rate: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SubcontractorInput = Partial<Omit<Subcontractor, "id" | "created_at" | "updated_at">> & {
  company_name: string;
};

export interface SubcontractorDocument {
  id: string;
  subcontractor_id: string;
  doc_type: SubcontractorDocType;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  valid_until: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface SubcontractorInvoice {
  id: string;
  job_id: string;
  subcontractor_id: string | null;
  submitted_by: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number;
  vat_amount: number | null;
  file_path: string | null;
  file_name: string | null;
  status: InvoiceStatus;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ===== Register ===== */

export async function listSubcontractors(): Promise<Subcontractor[]> {
  const { data, error } = await supabase
    .from("subcontractors")
    .select("*")
    .order("active", { ascending: false })
    .order("company_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Subcontractor[];
}

/** UE-posten som hör till inloggad användare (om någon). */
export async function getMySubcontractor(userId: string): Promise<Subcontractor | null> {
  const { data, error } = await supabase
    .from("subcontractors")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Subcontractor) ?? null;
}

export async function createSubcontractor(input: SubcontractorInput): Promise<Subcontractor> {
  const { data, error } = await supabase
    .from("subcontractors")
    .insert(input as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as Subcontractor;
}

export async function updateSubcontractor(
  id: string,
  patch: Partial<SubcontractorInput>,
): Promise<void> {
  const { error } = await supabase
    .from("subcontractors")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSubcontractor(id: string): Promise<void> {
  const { error } = await supabase.from("subcontractors").delete().eq("id", id);
  if (error) throw error;
}

/* ===== Dokument ===== */

export async function listSubcontractorDocuments(
  subcontractorId: string,
): Promise<SubcontractorDocument[]> {
  const { data, error } = await supabase
    .from("subcontractor_documents")
    .select("*")
    .eq("subcontractor_id", subcontractorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubcontractorDocument[];
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadSubcontractorDocument(params: {
  subcontractorId: string;
  file: File;
  docType: SubcontractorDocType;
  validUntil?: string | null;
  userId: string;
}): Promise<void> {
  const path = `${params.subcontractorId}/${Date.now()}-${safeName(params.file.name)}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, params.file, {
      contentType: params.file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw upErr;

  const { error } = await supabase.from("subcontractor_documents").insert({
    subcontractor_id: params.subcontractorId,
    doc_type: params.docType,
    file_path: path,
    file_name: params.file.name,
    mime_type: params.file.type || null,
    file_size: params.file.size,
    valid_until: params.validUntil || null,
    uploaded_by: params.userId,
  } as never);
  if (error) throw error;
}

export async function deleteSubcontractorDocument(doc: SubcontractorDocument): Promise<void> {
  await supabase.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await supabase.from("subcontractor_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/* ===== Fakturor ===== */

export async function listJobInvoices(jobId: string): Promise<SubcontractorInvoice[]> {
  const { data, error } = await supabase
    .from("subcontractor_invoices")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubcontractorInvoice[];
}

export async function listAllInvoices(): Promise<SubcontractorInvoice[]> {
  const { data, error } = await supabase
    .from("subcontractor_invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubcontractorInvoice[];
}

export async function submitInvoice(params: {
  jobId: string;
  subcontractorId?: string | null;
  userId: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amount: number;
  vatAmount?: number | null;
  notes?: string | null;
  file?: File | null;
}): Promise<void> {
  let filePath: string | null = null;
  let fileName: string | null = null;
  if (params.file) {
    filePath = `fakturor/${params.jobId}/${Date.now()}-${safeName(params.file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, params.file, {
        contentType: params.file.type || "application/pdf",
        upsert: false,
      });
    if (upErr) throw upErr;
    fileName = params.file.name;
  }

  const { error } = await supabase.from("subcontractor_invoices").insert({
    job_id: params.jobId,
    subcontractor_id: params.subcontractorId ?? null,
    submitted_by: params.userId,
    invoice_number: params.invoiceNumber || null,
    invoice_date: params.invoiceDate || null,
    due_date: params.dueDate || null,
    amount: params.amount,
    vat_amount: params.vatAmount ?? null,
    file_path: filePath,
    file_name: fileName,
    notes: params.notes || null,
  } as never);
  if (error) throw error;
}

export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  approvedBy: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "godkand") {
    patch.approved_by = approvedBy;
    patch.approved_at = new Date().toISOString();
  }
  if (status === "betald") patch.paid_at = new Date().toISOString();
  const { error } = await supabase
    .from("subcontractor_invoices")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteInvoice(inv: SubcontractorInvoice): Promise<void> {
  if (inv.file_path) await supabase.storage.from(BUCKET).remove([inv.file_path]);
  const { error } = await supabase.from("subcontractor_invoices").delete().eq("id", inv.id);
  if (error) throw error;
}

/** Sammanställning för ett projekt: avtalat pris kontra fakturerat. */
export function invoiceSummary(agreedPrice: number | null, invoices: SubcontractorInvoice[]) {
  const counted = invoices.filter((i) => i.status !== "avvisad");
  const invoiced = counted.reduce((s, i) => s + (i.amount ?? 0), 0);
  const paid = invoices
    .filter((i) => i.status === "betald")
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const agreed = agreedPrice ?? 0;
  return {
    agreed,
    invoiced,
    paid,
    remaining: agreed - invoiced,
    overInvoiced: agreed > 0 && invoiced > agreed,
    pendingCount: invoices.filter((i) => i.status === "mottagen").length,
  };
}

/** Varningar för saknade uppgifter (F-skatt, avtal). */
export function expiryWarnings(sc: Subcontractor): string[] {
  const out: string[] = [];
  if (!sc.f_skatt) out.push("F-skatt saknas");
  if (!sc.agreement_signed_at) out.push("Avtal saknas");
  return out;
}
