import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processStaleLeadReminders } from "@/lib/stale-lead-reminders.server";

// Runs once/day (see vite.config.ts's scheduledTasks) -- flags leads stuck in
// forhandling/uppfoljning with no recent activity and notifies the assigned seller
// in-app. Mirrors tasks/send-booking-reminders.ts's structure.

export default defineTask({
  meta: {
    name: "stale-lead-reminders",
    description: "Flags stale forhandling/uppfoljning leads and notifies the assigned seller in-app",
  },
  async run() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const result = await processStaleLeadReminders(supabase);
    return { result };
  },
});
