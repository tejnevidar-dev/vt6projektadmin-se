import { supabase } from "@/integrations/supabase/client";

export type JobStatus = "ej_paborjad" | "pagaende" | "klar";
export type JobAssignmentType = "arbetsledare" | "underentreprenor";
export type TimeEntryStatus = "pending" | "approved" | "rejected";

export interface Job {
  id: string;
  lead_id: string | null;
  assigned_to: string;
  assignment_type: JobAssignmentType;
  status: JobStatus;
  fixed_price: number | null;
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  client_company: string | null;
  work_order_pdf_path: string | null;
  work_order_summary: string | null;
  work_order_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ===== Work orders (PDF + AI summary) ===== */

export async function uploadWorkOrder(jobId: string, file: File): Promise<string> {
  const path = `${jobId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from("work-orders")
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase
    .from("jobs")
    .update({
      work_order_pdf_path: path,
      work_order_summary: null,
      work_order_processed_at: null,
    })
    .eq("id", jobId);
  if (dbErr) throw dbErr;
  return path;
}

export async function getWorkOrderSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("work-orders")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function processWorkOrder(jobId: string): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Inte inloggad");
  const resp = await fetch("/api/process-work-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jobId }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((json as { error?: string }).error ?? "AI-fel");
  return (json as { summary: string }).summary;
}

export async function deleteWorkOrder(jobId: string, path: string) {
  await supabase.storage.from("work-orders").remove([path]);
  const { error } = await supabase
    .from("jobs")
    .update({
      work_order_pdf_path: null,
      work_order_summary: null,
      work_order_processed_at: null,
    })
    .eq("id", jobId);
  if (error) throw error;
}

export interface JobWithLead extends Job {
  lead?: {
    id: string;
    name: string;
    phone: string | null;
    job_type: string;
    property_id: string | null;
  } | null;
  property?: {
    address: string;
    municipality: string;
  } | null;
}

export interface CreateJobInput {
  assigned_to: string;
  assignment_type: JobAssignmentType;
  customer_name: string;
  customer_phone?: string;
  address?: string;
  client_company?: string;
  fixed_price?: number | null;
  notes?: string;
}

export async function createManualJob(input: CreateJobInput): Promise<string> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      assigned_to: input.assigned_to,
      assignment_type: input.assignment_type,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone ?? null,
      address: input.address ?? null,
      client_company: input.client_company ?? null,
      fixed_price:
        input.assignment_type === "underentreprenor" ? input.fixed_price ?? null : null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export interface JobMember {
  id: string;
  job_id: string;
  user_id: string;
  invited_by: string | null;
  created_at: string;
  profile?: { display_name: string | null; email: string } | null;
}

export interface TimeEntry {
  id: string;
  job_id: string;
  user_id: string;
  work_date: string;
  hours: number;
  description: string | null;
  status: TimeEntryStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface SelfCheck {
  id: string;
  job_id: string;
  user_id: string;
  template_key: string;
  data: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
}

/** List jobs visible to current user (RLS handles filtering). */
export async function listJobs(): Promise<JobWithLead[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, lead:leads(id, name, phone, job_type, property_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as any[];
  // Fetch properties separately (no FK declared)
  const propIds = Array.from(
    new Set(rows.map((r) => r.lead?.property_id).filter(Boolean) as string[])
  );
  let propMap: Record<string, { address: string; municipality: string }> = {};
  if (propIds.length) {
    const { data: props } = await supabase
      .from("properties")
      .select("id, address, municipality")
      .in("id", propIds);
    propMap = Object.fromEntries(
      (props ?? []).map((p: any) => [p.id, { address: p.address, municipality: p.municipality }])
    );
  }
  return rows.map((r) => ({
    ...r,
    property: r.lead?.property_id ? propMap[r.lead.property_id] ?? null : null,
  })) as JobWithLead[];
}

export async function getJob(id: string): Promise<JobWithLead | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, lead:leads(id, name, phone, job_type, property_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  let property = null;
  if (row.lead?.property_id) {
    const { data: p } = await supabase
      .from("properties")
      .select("address, municipality")
      .eq("id", row.lead.property_id)
      .maybeSingle();
    property = p ?? null;
  }
  return { ...row, property } as JobWithLead;
}

export async function updateJobStatus(id: string, status: JobStatus) {
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
  if (error) throw error;
}

/* ===== Members ===== */
export async function listJobMembers(jobId: string): Promise<JobMember[]> {
  const { data, error } = await supabase
    .from("job_members")
    .select("*")
    .eq("job_id", jobId);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  if (!rows.length) return [];
  const userIds = rows.map((r) => r.user_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds);
  const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: profMap[r.user_id] ?? null }));
}

export async function addJobMember(jobId: string, userId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("job_members").insert({
    job_id: jobId,
    user_id: userId,
    invited_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function removeJobMember(memberId: string) {
  const { error } = await supabase.from("job_members").delete().eq("id", memberId);
  if (error) throw error;
}

/* ===== Time entries ===== */
export async function listTimeEntries(jobId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("job_id", jobId)
    .order("work_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

export async function addTimeEntry(input: {
  job_id: string;
  work_date: string;
  hours: number;
  description?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("time_entries").insert({
    job_id: input.job_id,
    user_id: auth.user!.id,
    work_date: input.work_date,
    hours: input.hours,
    description: input.description ?? null,
  });
  if (error) throw error;
}

/* ===== Self checks (placeholder mall) ===== */
export async function listSelfChecks(jobId: string): Promise<SelfCheck[]> {
  const { data, error } = await supabase
    .from("self_checks")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SelfCheck[];
}
