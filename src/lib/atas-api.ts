import { supabase } from "@/integrations/supabase/client";

// `atas`/`app_settings` aren't in the generated types yet (same as-any pattern as
// `notifications-api.ts` -- these tables predate any app code, types.ts hasn't been
// regenerated since).
const db = supabase as any;

export type AtaApprovalStatus = "none" | "pending" | "approved" | "rejected";

export interface Ata {
  id: string;
  job_id: string;
  ata_number: string | null;
  created_by: string;
  total_amount: number;
  description: string | null;
  approval_status: AtaApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  signature_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AtaWithContext extends Ata {
  job?: { id: string; customer_name: string | null } | null;
}

const DEFAULT_THRESHOLD = 10000;

export async function getAtaApprovalThreshold(): Promise<number> {
  const { data, error } = await db.from("app_settings").select("value").eq("key", "ata_approval_threshold").maybeSingle();
  if (error) throw error;
  const value = data?.value;
  return typeof value === "number" ? value : DEFAULT_THRESHOLD;
}

export async function listJobAtas(jobId: string): Promise<Ata[]> {
  const { data, error } = await db
    .from("atas")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ata[];
}

export async function createAta(input: {
  jobId: string;
  totalAmount: number;
  description: string;
}): Promise<Ata> {
  const threshold = await getAtaApprovalThreshold();
  const { data: userData } = await supabase.auth.getUser();
  const approval_status: AtaApprovalStatus = input.totalAmount > threshold ? "pending" : "none";
  const { data, error } = await db
    .from("atas")
    .insert({
      job_id: input.jobId,
      created_by: userData.user?.id,
      total_amount: input.totalAmount,
      description: input.description,
      approval_status,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Ata;
}

export async function approveAta(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await db
    .from("atas")
    .update({ approval_status: "approved", approved_by: userData.user?.id, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectAta(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await db
    .from("atas")
    .update({ approval_status: "rejected", approved_by: userData.user?.id, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Admin-wide list of ÄTA:er som väntar på godkännande, med jobb/kund-kontext. */
export async function listPendingAtas(): Promise<AtaWithContext[]> {
  const { data, error } = await db
    .from("atas")
    .select("*, job:jobs(id, customer_name)")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AtaWithContext[];
}
