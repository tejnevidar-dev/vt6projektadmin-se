import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processUeDayEndReminders } from "@/lib/work-order.server";

// Körs var 10:e minut, men agerar bara kl. 17 (Stockholmstid) på vardagar: påminner UE om foto på tätat tak.
export default defineTask({
  meta: { name: "ue-day-end", description: "Påminner UE om dagslutsfoto (tätat tak) kl. 17" },
  async run() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    const sb = createClient(url, key, { auth: { persistSession: false } });
    return { result: await processUeDayEndReminders(sb) };
  },
});
