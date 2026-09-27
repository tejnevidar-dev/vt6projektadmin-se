import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processOfferAgeAlerts } from "@/lib/offer-age-alert.server";

// Runs once/day (see vite.config.ts's scheduledTasks) -- flags offers stuck in 'skickad'
// with no reply and notifies the assigned seller in-app. Mirrors tasks/stale-lead-reminders.ts.

export default defineTask({
  meta: {
    name: "offer-age-alert",
    description: "Flags stale sent offers and notifies the assigned seller in-app",
  },
  async run() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const result = await processOfferAgeAlerts(supabase);
    return { result };
  },
});
