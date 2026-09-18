// Daily cron equivalent of processBookingReminders (see booking-reminders.server.ts
// for the established pattern this mirrors). Flags leads stuck in `forhandling`/
// `uppfoljning` with no recent lead_activities row, and drops an in-app notification
// (see notifications-api.ts / the notifications table) for the assigned seller --
// no email/SMS, per the 2026-09 feature plan.

const STALE_STAGES = ["forhandling", "uppfoljning"] as const;
const DEFAULT_STALE_DAYS = 5;

export interface StaleLeadReminderResult {
  checked: number;
  notified: number;
}

export async function processStaleLeadReminders(supabase: any): Promise<StaleLeadReminderResult> {
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "stale_lead_reminder_days")
    .maybeSingle();
  const staleDays = typeof setting?.value === "number" ? setting.value : DEFAULT_STALE_DAYS;
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, seller_id, pipeline_stage")
    .in("pipeline_stage", STALE_STAGES)
    .not("seller_id", "is", null);
  if (error) throw new Error(error.message);

  let notified = 0;
  for (const lead of leads ?? []) {
    const { data: lastActivity } = await supabase
      .from("lead_activities")
      .select("created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastAt = lastActivity?.created_at;
    if (lastAt && lastAt > cutoff) continue; // still fresh

    // Avoid re-notifying every single day once already flagged today.
    const { count: alreadyToday } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", lead.seller_id)
      .eq("type", "lead_stale")
      .eq("link", `/leads?lead=${lead.id}`)
      .gte("created_at", new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString());
    if (alreadyToday && alreadyToday > 0) continue;

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: lead.seller_id,
      type: "lead_stale",
      title: "Lead utan aktivitet",
      body: `${lead.name} har inte haft någon aktivitet på ${staleDays}+ dagar.`,
      link: `/leads?lead=${lead.id}`,
    });
    if (!insertError) notified++;
  }

  return { checked: (leads ?? []).length, notified };
}
