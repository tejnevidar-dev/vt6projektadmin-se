import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Side } from "@/hooks/use-role";

export interface AgendaItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CalendarEvent {
  id: string;
  side: Side;
  owner_id: string;
  title: string;
  description: string | null;
  location: string | null;
  lead_id: string | null;
  job_id: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  agenda: AgendaItem[];
  created_at: string;
  updated_at: string;
  shared_users: string[];
  shared_roles: AppRole[];
  owner_name?: string | null;
}

export interface CalendarEventInput {
  side: Side;
  title: string;
  description?: string | null;
  location?: string | null;
  lead_id?: string | null;
  job_id?: string | null;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  agenda?: AgendaItem[];
  shared_users: string[];
  shared_roles: AppRole[];
}

export async function listCalendarEvents(side: Side): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      `*,
       calendar_event_shares_users(user_id),
       calendar_event_shares_roles(role)`
    )
    .eq("side", side)
    .order("start_at", { ascending: true });
  if (error) throw error;

  const events = (data ?? []) as any[];
  const ownerIds = Array.from(new Set(events.map((e) => e.owner_id))).filter(Boolean);
  let owners: Record<string, string | null> = {};
  if (ownerIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", ownerIds);
    (profiles ?? []).forEach((p: any) => {
      owners[p.id] = p.display_name || p.email || null;
    });
  }

  return events.map((e) => ({
    id: e.id,
    side: e.side,
    owner_id: e.owner_id,
    title: e.title,
    description: e.description,
    location: e.location,
    lead_id: e.lead_id,
    job_id: e.job_id,
    start_at: e.start_at,
    end_at: e.end_at,
    all_day: e.all_day,
    agenda: Array.isArray(e.agenda) ? (e.agenda as AgendaItem[]) : [],
    created_at: e.created_at,
    updated_at: e.updated_at,
    shared_users: (e.calendar_event_shares_users ?? []).map((s: any) => s.user_id),
    shared_roles: (e.calendar_event_shares_roles ?? []).map((s: any) => s.role),
    owner_name: owners[e.owner_id] ?? null,
  }));
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Ej inloggad");

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      side: input.side,
      owner_id: uid,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      lead_id: input.lead_id ?? null,
      job_id: input.job_id ?? null,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;

  const id = data!.id as string;
  await syncShares(id, input.shared_users, input.shared_roles);
  return id;
}

export async function updateCalendarEvent(id: string, input: CalendarEventInput): Promise<void> {
  const { error } = await supabase
    .from("calendar_events")
    .update({
      side: input.side,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      lead_id: input.lead_id ?? null,
      job_id: input.job_id ?? null,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day ?? false,
    })
    .eq("id", id);
  if (error) throw error;
  await syncShares(id, input.shared_users, input.shared_roles);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}

async function syncShares(eventId: string, users: string[], roles: AppRole[]) {
  await supabase.from("calendar_event_shares_users").delete().eq("event_id", eventId);
  await supabase.from("calendar_event_shares_roles").delete().eq("event_id", eventId);
  if (users.length) {
    const { error } = await supabase
      .from("calendar_event_shares_users")
      .insert(users.map((user_id) => ({ event_id: eventId, user_id })));
    if (error) throw error;
  }
  if (roles.length) {
    const { error } = await supabase
      .from("calendar_event_shares_roles")
      .insert(roles.map((role) => ({ event_id: eventId, role })));
    if (error) throw error;
  }
}

export interface ShareablePerson {
  id: string;
  name: string;
  email: string | null;
  roles: AppRole[];
}

export async function listShareablePeople(): Promise<ShareablePerson[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .order("display_name", { ascending: true });
  if (error) throw error;
  const ids = (profiles ?? []).map((p: any) => p.id);
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const rolesByUser = new Map<string, AppRole[]>();
  (roles ?? []).forEach((r: any) => {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role as AppRole);
    rolesByUser.set(r.user_id, arr);
  });
  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    name: p.display_name || p.email || "Okänd",
    email: p.email,
    roles: rolesByUser.get(p.id) ?? [],
  }));
}
