import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/image-prepare";


export type JobStatus = "ej_paborjad" | "pagaende" | "klar";
export type JobAssignmentType = "arbetsledare" | "underentreprenor";
export type TimeEntryStatus = "pending" | "approved" | "rejected";

export interface Job {
  id: string;
  lead_id: string | null;
  assigned_to: string | null;
  assignment_type: JobAssignmentType | null;
  status: JobStatus;
  job_type: string | null;
  fixed_price: number | null;
  estimated_hours: number | null;
  hide_time_estimate: boolean;
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  client_company: string | null;
  client_contact_name: string | null;
  client_email: string | null;
  self_checks_emailed_at: string | null;
  self_checks_emailed_to: string | null;
  work_order_pdf_path: string | null;
  work_order_summary: string | null;
  work_order_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function updateJobType(jobId: string, jobType: string | null): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ job_type: jobType } as never)
    .eq("id", jobId);
  if (error) throw error;
}

/**
 * Polls the `jobs` table until a job for the given lead exists (created by
 * the `handle_lead_booking` trigger when a lead moves to "pagaende").
 * Resolves true once visible, or false if not seen within timeoutMs.
 */
export async function waitForJobByLead(
  leadId: string,
  timeoutMs = 8000,
  intervalMs = 400,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("jobs")
      .select("id")
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle();
    if (!error && data?.id) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
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
    price: number | null;
    created_by?: string | null;
  } | null;
  property?: {
    address: string;
    municipality: string;
  } | null;
  saljare?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface CreateJobInput {
  assigned_to: string;
  assignment_type: JobAssignmentType;
  customer_name: string;
  customer_phone?: string;
  address?: string;
  client_company?: string;
  client_contact_name?: string;
  client_email?: string;
  fixed_price?: number | null;
  notes?: string;
}

export async function createManualJob(input: CreateJobInput): Promise<string> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      assigned_to: input.assigned_to,
      assignment_type: input.assignment_type,
      status: "pagaende",
      customer_name: input.customer_name,
      customer_phone: input.customer_phone ?? null,
      address: input.address ?? null,
      client_company: input.client_company ?? null,
      client_contact_name: input.client_contact_name ?? null,
      client_email: input.client_email ?? null,
      fixed_price:
        input.assignment_type === "underentreprenor" ? input.fixed_price ?? null : null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export interface SelfCheckDelivery {
  id: string;
  job_id: string;
  self_check_id: string | null;
  template_key: string;
  recipient_email: string | null;
  status: "sent" | "failed";
  attempt: number;
  error_message: string | null;
  skipped_images: string[];
  embedded_image_count: number;
  pdf_path: string | null;
  created_at: string;
}

/** Utskickshistorik per egenkontroll för ett projekt (senaste först). */
export async function getSelfCheckDeliveries(jobId: string): Promise<SelfCheckDelivery[]> {
  const { data, error } = await supabase
    .from("self_check_deliveries")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    ...d,
    skipped_images: Array.isArray(d.skipped_images) ? (d.skipped_images as string[]) : [],
  })) as SelfCheckDelivery[];
}

/** Send all self-checks for a job to the client's email address. */

export async function sendSelfChecksToClient(
  jobId: string,
): Promise<{ to: string; count: number; imageCount: number; skippedImageCount: number }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Inte inloggad");
  const resp = await fetch("/api/send-self-checks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jobId }),
  });
  const json = (await resp.json().catch(() => ({}))) as {
    error?: string;
    to?: string;
    count?: number;
    imageCount?: number;
    skippedImageCount?: number;
  };
  if (!resp.ok) throw new Error(json.error ?? "Kunde inte skicka egenkontroller");
  return {
    to: json.to ?? "",
    count: json.count ?? 0,
    imageCount: json.imageCount ?? 0,
    skippedImageCount: json.skippedImageCount ?? 0,
  };
}


/** Clear the "self-checks emailed" state so it can be resent fresh. */
export async function revokeSelfChecksSent(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ self_checks_emailed_at: null, self_checks_emailed_to: null })
    .eq("id", jobId);
  if (error) throw error;
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

export interface SelfCheckImage {
  path: string;
  name: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

export interface SelfCheckFieldReview {
  status: "approved";
  reviewed_at: string;
  reviewed_by: string | null;
}

export interface SelfCheck {
  id: string;
  job_id: string;
  user_id: string;
  template_key: string;
  data: Record<string, unknown> & {
    images?: SelfCheckImage[];
    imagesByField?: Record<string, SelfCheckImage[]>;
    __fieldReviews?: Record<string, SelfCheckFieldReview>;
  };
  completed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
}

/**
 * Upload an image attached to a self-check.
 * Telefonbilder (HEIC/stora JPEG) normaliseras till en kompakt JPEG i webbläsaren
 * innan uppladdning, så att PDF-generatorn alltid kan bädda in dem.
 */
export async function uploadSelfCheckImage(jobId: string, file: File): Promise<SelfCheckImage> {
  const prepared = await prepareImageForUpload(file);
  const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await supabase.storage
    .from("self-check-images")
    .upload(path, prepared, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data: userData } = await supabase.auth.getUser();
  return {
    path,
    name: file.name,
    uploadedBy: userData.user?.id,
    uploadedAt: new Date().toISOString(),
  };
}


/** Fetch display names for a set of user IDs. Returns id → display name (or email). */
export async function getProfileNames(userIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", ids);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const p of data ?? []) {
    map[p.id] = (p as { display_name?: string | null; email?: string | null }).display_name
      || (p as { email?: string | null }).email
      || "Okänd";
  }
  return map;
}

export async function getSelfCheckImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("self-check-images")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteSelfCheckImage(path: string): Promise<void> {
  await supabase.storage.from("self-check-images").remove([path]);
}

export interface SelfCheckWithContext extends SelfCheck {
  job: {
    id: string;
    address: string | null;
    customer_name: string | null;
    assigned_to: string;
  } | null;
  property_address: string | null;
  performer: { display_name: string | null; email: string } | null;
}


export async function updateJobStatus(id: string, status: JobStatus) {
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function assignJobForeman(id: string, userId: string) {
  const { error } = await supabase
    .from("jobs")
    .update({ assigned_to: userId, assignment_type: "arbetsledare" })
    .eq("id", id);
  if (error) throw error;
}

export async function updateJobClientInfo(
  id: string,
  info: { client_company: string | null; client_contact_name: string | null; client_email: string | null }
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      client_company: info.client_company,
      client_contact_name: info.client_contact_name,
      client_email: info.client_email,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function updateJobPrice(
  id: string,
  price: number | null,
  leadId: string | null,
) {
  const { error } = await supabase
    .from("jobs")
    .update({ fixed_price: price })
    .eq("id", id);
  if (error) throw error;
  if (leadId) {
    const { error: leadErr } = await supabase
      .from("leads")
      .update({ price })
      .eq("id", leadId);
    if (leadErr) throw leadErr;
  }
}

export async function updateJobEstimatedHours(id: string, hours: number | null) {
  const { data: existing } = await supabase
    .from("jobs")
    .select("estimated_hours")
    .eq("id", id)
    .maybeSingle();
  const oldHours = (existing as { estimated_hours: number | null } | null)?.estimated_hours ?? null;
  const { error } = await supabase
    .from("jobs")
    .update({ estimated_hours: hours })
    .eq("id", id);
  if (error) throw error;
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    await supabase.from("job_estimate_audit").insert({
      job_id: id,
      user_id: auth.user.id,
      action: "update_hours",
      old_value: oldHours,
      new_value: hours,
    });
  }
}

export async function updateJobHideTimeEstimate(id: string, hide: boolean) {
  const { error } = await supabase
    .from("jobs")
    .update({ hide_time_estimate: hide })
    .eq("id", id);
  if (error) throw error;
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    await supabase.from("job_estimate_audit").insert({
      job_id: id,
      user_id: auth.user.id,
      action: hide ? "hide" : "show",
      old_value: null,
      new_value: null,
    });
  }
}

export interface JobEstimateAuditEntry {
  id: string;
  job_id: string;
  user_id: string | null;
  action: "hide" | "show" | "update_hours";
  old_value: number | null;
  new_value: number | null;
  created_at: string;
  user?: { display_name: string | null; email: string } | null;
}

export async function listJobEstimateAudit(jobId: string): Promise<JobEstimateAuditEntry[]> {
  const { data, error } = await supabase
    .from("job_estimate_audit")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as JobEstimateAuditEntry[];
  if (!rows.length) return [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]));
  let profMap: Record<string, { display_name: string | null; email: string }> = {};
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);
    profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, { display_name: p.display_name, email: p.email }]));
  }
  return rows.map((r) => ({ ...r, user: r.user_id ? profMap[r.user_id] ?? null : null }));
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

/* ===== Self checks ===== */
export async function listSelfChecks(jobId: string): Promise<SelfCheck[]> {
  const { data, error } = await supabase
    .from("self_checks")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SelfCheck[];
}

export async function createSelfCheck(input: {
  job_id: string;
  template_key: string;
  data: Record<string, unknown>;
  submit?: boolean;
}): Promise<SelfCheck> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("self_checks")
    .insert({
      job_id: input.job_id,
      user_id: auth.user!.id,
      template_key: input.template_key,
      data: input.data as never,
      completed_at: input.submit ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SelfCheck;
}

export async function updateSelfCheck(
  id: string,
  input: { data: Record<string, unknown>; submit?: boolean }
) {
  const patch: Record<string, unknown> = { data: input.data };
  if (input.submit) patch.completed_at = new Date().toISOString();
  const { error } = await supabase.from("self_checks").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function approveSelfCheckField(id: string, fieldLabel: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { data: existing, error: readErr } = await supabase
    .from("self_checks")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const currentData =
    typeof (existing as { data?: unknown } | null)?.data === "object" &&
    (existing as { data?: unknown } | null)?.data !== null &&
    !Array.isArray((existing as { data?: unknown }).data)
      ? { ...((existing as { data: Record<string, unknown> }).data) }
      : {};
  const previousReviews =
    typeof currentData.__fieldReviews === "object" && currentData.__fieldReviews !== null
      ? (currentData.__fieldReviews as Record<string, SelfCheckFieldReview>)
      : {};
  const nextData = {
    ...currentData,
    __fieldReviews: {
      ...previousReviews,
      [fieldLabel]: {
        status: "approved" as const,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.user?.id ?? null,
      },
    },
  };
  const { error } = await supabase.from("self_checks").update({ data: nextData } as never).eq("id", id);
  if (error) throw error;
}

export async function deleteSelfCheck(id: string) {
  const { error } = await supabase.from("self_checks").delete().eq("id", id);
  if (error) throw error;
}

/** List all self-checks visible to current user, with job/address/performer context. */
export async function listAllSelfChecks(): Promise<SelfCheckWithContext[]> {
  const { data, error } = await supabase
    .from("self_checks")
    .select("*")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as SelfCheck[];
  if (!rows.length) return [];

  const jobIds = Array.from(new Set(rows.map((r) => r.job_id)));
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const [{ data: jobs }, { data: profiles }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, address, customer_name, assigned_to, lead_id")
      .in("id", jobIds),
    supabase.from("profiles").select("id, display_name, email").in("id", userIds),
  ]);

  const leadIds = Array.from(
    new Set((jobs ?? []).map((j: any) => j.lead_id).filter(Boolean) as string[])
  );
  let leadPropMap: Record<string, string | null> = {};
  if (leadIds.length) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, property_id")
      .in("id", leadIds);
    const propIds = Array.from(
      new Set((leads ?? []).map((l: any) => l.property_id).filter(Boolean) as string[])
    );
    let propAddr: Record<string, string> = {};
    if (propIds.length) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, address")
        .in("id", propIds);
      propAddr = Object.fromEntries((props ?? []).map((p: any) => [p.id, p.address]));
    }
    leadPropMap = Object.fromEntries(
      (leads ?? []).map((l: any) => [l.id, l.property_id ? propAddr[l.property_id] ?? null : null])
    );
  }

  const jobMap = Object.fromEntries((jobs ?? []).map((j: any) => [j.id, j]));
  const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

  return rows.map((r) => {
    const j = jobMap[r.job_id];
    const propAddress = j?.lead_id ? leadPropMap[j.lead_id] ?? null : null;
    return {
      ...r,
      job: j
        ? {
            id: j.id,
            address: j.address ?? null,
            customer_name: j.customer_name ?? null,
            assigned_to: j.assigned_to,
          }
        : null,
      property_address: propAddress,
      performer: profMap[r.user_id] ?? null,
    } as SelfCheckWithContext;
  });
}

export async function markSelfCheckReviewed(id: string, notes?: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("self_checks")
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user?.id ?? null,
      review_notes: notes ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function unmarkSelfCheckReviewed(id: string) {
  const { error } = await supabase
    .from("self_checks")
    .update({ reviewed_at: null, reviewed_by: null })
    .eq("id", id);
  if (error) throw error;
}

// ============ Self-check instructions (admin-editable) ============

export interface SelfCheckInstructionRow {
  id: string;
  template_key: string;
  field_label: string | null;
  instruction: string;
  updated_at: string;
}

export async function listSelfCheckInstructions(): Promise<SelfCheckInstructionRow[]> {
  const { data, error } = await supabase
    .from("self_check_instructions")
    .select("id,template_key,field_label,instruction,updated_at");
  if (error) throw error;
  return (data ?? []) as SelfCheckInstructionRow[];
}

export async function upsertSelfCheckInstruction(args: {
  template_key: string;
  field_label: string | null;
  instruction: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("self_check_instructions")
    .upsert(
      {
        template_key: args.template_key,
        field_label: args.field_label ?? "",
        instruction: args.instruction,
        updated_by: auth.user?.id ?? null,
      },
      { onConflict: "template_key,field_label" },
    );
  if (error) throw error;
}
