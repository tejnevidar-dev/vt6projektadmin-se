import { supabase } from "@/integrations/supabase/client";

// `notifications` isn't in the generated types yet (added in migration
// 20260916120000_notifications.sql, after the last `supabase gen types` run) -- the
// `db` cast below follows the same as-any-until-regenerated pattern used for
// `lead_activities`/`atas` elsewhere in this codebase.
const db = supabase as any;

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function countUnreadNotifications(): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
