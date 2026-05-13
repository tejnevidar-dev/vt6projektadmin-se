import { supabase } from "@/integrations/supabase/client";

export type ActivityType =
  | "created"
  | "stage_change"
  | "status_change"
  | "assignment"
  | "note"
  | "call"
  | "pitch_generated"
  | "updated";

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
}

export async function logActivity(
  leadId: string,
  type: ActivityType,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await (supabase.from("lead_activities") as any).insert({
    lead_id: leadId,
    user_id: userData.user?.id ?? null,
    type,
    description,
    metadata,
  });
  if (error) console.error("Failed to log activity:", error);
}

export async function fetchActivities(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const userIds = Array.from(new Set((data ?? []).map((a) => a.user_id).filter(Boolean))) as string[];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);
    nameMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.display_name || p.email || "Okänd"])
    );
  }

  return (data ?? []).map((a) => ({
    ...a,
    metadata: (a.metadata ?? {}) as Record<string, unknown>,
    actor_name: a.user_id ? nameMap[a.user_id] ?? null : null,
  }));
}
