import { defineTask } from "nitro/task";
import { createClient } from "@supabase/supabase-js";
import { processUeCompliance } from "@/lib/work-order.server";

// Körs dagligen: larm 30/14/7/3/1/0 dagar före att UE:s försäkring, ID06, A1 eller dokument går ut.
export default defineTask({
  meta: { name: "ue-compliance", description: "Larmar när UE-krav håller på att gå ut" },
  async run() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { result: { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" } };
    const sb = createClient(url, key, { auth: { persistSession: false } });
    return { result: await processUeCompliance(sb) };
  },
});
