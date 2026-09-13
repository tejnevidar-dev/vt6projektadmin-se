import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processBookingReminders } from "@/lib/booking-reminders.server";

// Replaces Lovable Cloud's "Jobs" feature, which ran the same logic every 5 minutes
// via src/routes/api/public/hooks/send-booking-reminders.ts. Scheduled via
// `scheduledTasks` in vite.config.ts's nitro() options -- on the cloudflare-module
// preset Nitro auto-generates the actual Cloudflare Cron Trigger at build time, no
// manual wrangler.jsonc editing needed.

export default defineTask({
  meta: {
    name: "send-booking-reminders",
    description: "Sends due booking reminder emails/SMS (was a 5-minute Lovable Cloud Job)",
  },
  async run() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const result = await processBookingReminders(supabase);
    return { result };
  },
});
