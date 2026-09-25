import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadConfig } from "@/lib/lead-intake.server";
import { safeEqual } from "@/lib/lead-intake";
import { buildMorningStats, INTAKE_SOURCES, type StatsLead } from "@/lib/morning-stats";

// Skyddad endpoint med aggregerade siffror till morgonrapporten. Returnerar BARA antal:
// inga namn, telefonnummer, mailadresser eller lead-id.
//
//   GET /api/public/morning-stats      Header: X-Report-Secret: <REPORT_SECRET>

const db = supabaseAdmin as any;
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" } as const;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export const Route = createFileRoute("/api/public/morning-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.REPORT_SECRET;
        if (!expected) return json({ error: "Server misconfigured" }, 500);
        const provided = request.headers.get("x-report-secret") ?? "";
        if (!provided || !safeEqual(provided, expected)) return json({ error: "Unauthorized" }, 401);

        const cfg = await loadConfig(db);

        const { data: leads, error } = await db
          .from("leads")
          .select("id, source, pipeline_stage, created_at, updated_at, offer_accepted_at, completed_at, last_contact")
          .order("created_at", { ascending: false })
          .limit(5000);
        if (error) return json({ error: "Query failed" }, 500);

        const openIds = ((leads ?? []) as StatsLead[])
          .filter((l) => l.pipeline_stage === "inkommande_webb" && (INTAKE_SOURCES as readonly string[]).includes(l.source))
          .map((l) => l.id);
        const touched = new Set<string>();
        if (openIds.length) {
          const { data: acts } = await db
            .from("lead_activities")
            .select("lead_id")
            .in("lead_id", openIds)
            .not("user_id", "is", null);
          for (const a of (acts ?? []) as { lead_id: string }[]) touched.add(a.lead_id);
        }

        const { count: errors } = await db
          .from("webhook_logs")
          .select("id", { count: "exact", head: true })
          .gte("status_code", 500)
          .gte("created_at", new Date(Date.now() - 86400000).toISOString());

        return json(
          buildMorningStats({
            leads: (leads ?? []) as StatsLead[],
            staffTouchedLeadIds: touched,
            slaHours: cfg.slaHours,
            intakeErrors24h: errors ?? 0,
          }),
        );
      },
    },
  },
});
