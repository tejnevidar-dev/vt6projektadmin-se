import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processReviewReady } from "@/lib/review-requests.server";

// Runs once/day (see vite.config.ts's scheduledTasks) -- flags leads paid N days ago as "redo"
// for a review request and notifies the seller in-app. Sends NOTHING to the customer.

export default defineTask({
  meta: {
    name: "review-ready",
    description: "Flags paid jobs ready for a review request, notifies the seller in-app",
  },
  async run() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const result = await processReviewReady(supabase);
    return { result };
  },
});
