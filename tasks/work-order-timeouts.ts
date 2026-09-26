import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processWorkOrderTimeouts } from "@/lib/work-order.server";

// Körs var 10:e minut: erbjudanden utan svar i tid går vidare till nästa UE (eller larm).
export default defineTask({
  meta: { name: "work-order-timeouts", description: "Skickar arbetsordrar vidare när UE inte svarat i tid" },
  async run() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    const sb = createClient(url, key, { auth: { persistSession: false } });
    return { result: await processWorkOrderTimeouts(sb) };
  },
});
