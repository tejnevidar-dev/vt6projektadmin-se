import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processLeadAlerts } from "@/lib/lead-intake.server";

// Körs var 10:e minut (se vite.config.ts scheduledTasks): SLA-påminnelse för
// obesvarade leads, tystnadslarm och larm vid misslyckat leadmottagande.

export default defineTask({
  meta: {
    name: "lead-alerts",
    description: "Påminner om obesvarade leads och larmar vid tystnad eller intagsfel",
  },
  async run() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const result = await processLeadAlerts(supabase);
    return { result };
  },
});
