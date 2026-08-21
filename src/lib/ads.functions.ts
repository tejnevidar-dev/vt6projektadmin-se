import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdProvider } from "@/lib/ads.server";

export interface AdSyncResult {
  provider: AdProvider;
  status: "ok" | "error" | "not_configured";
  rows: number;
  cost: number;
  error?: string;
}

export interface AdConnectionStatus {
  google_ads: boolean;
  meta_ads: boolean;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (data ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Endast administratörer kan hantera annonskopplingar");
}

export const getAdConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdConnectionStatus> => {
    const { googleConfigured, metaConfigured } = await import("@/lib/ads.server");
    await assertAdmin(context.supabase, context.userId);
    return { google_ads: googleConfigured(), meta_ads: metaConfigured() };
  });

export const syncAdSpend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { days?: number } | undefined) => ({ days: Math.min(Math.max(data?.days ?? 90, 1), 365) }))
  .handler(async ({ data, context }): Promise<AdSyncResult[]> => {
    await assertAdmin(context.supabase, context.userId);

    const { fetchGoogleSpend, fetchMetaSpend, googleConfigured, metaConfigured } = await import("@/lib/ads.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const until = new Date();
    const since = new Date(until.getTime() - data.days * 86400000);
    const isoSince = since.toISOString().slice(0, 10);
    const isoUntil = until.toISOString().slice(0, 10);

    // Kampanj → leadkälla-mappning
    const { data: mapRows } = await supabaseAdmin.from("ad_source_map").select("*");
    const resolveSource = (provider: AdProvider, campaignName: string) => {
      const rules = (mapRows ?? []).filter((m: any) => m.provider === provider);
      const specific = rules.find(
        (m: any) => m.campaign_pattern && campaignName.toLowerCase().includes(String(m.campaign_pattern).toLowerCase()),
      );
      if (specific) return specific.lead_source as string;
      const fallback = rules.find((m: any) => !m.campaign_pattern);
      return (fallback?.lead_source as string) ?? "roslagstak";
    };

    const results: AdSyncResult[] = [];

    const providers: Array<{ provider: AdProvider; configured: boolean; fetcher: () => Promise<any[]> }> = [
      { provider: "google_ads", configured: googleConfigured(), fetcher: () => fetchGoogleSpend(isoSince, isoUntil) },
      { provider: "meta_ads", configured: metaConfigured(), fetcher: () => fetchMetaSpend(isoSince, isoUntil) },
    ];

    for (const p of providers) {
      if (!p.configured) {
        results.push({ provider: p.provider, status: "not_configured", rows: 0, cost: 0 });
        continue;
      }
      try {
        const rows = await p.fetcher();
        const payload = rows.map((r) => ({ ...r, lead_source: resolveSource(p.provider, r.campaign_name) }));
        if (payload.length) {
          const { error } = await supabaseAdmin
            .from("ad_spend")
            .upsert(payload, { onConflict: "provider,account_id,campaign_id,spend_date" });
          if (error) throw new Error(error.message);
        }
        const cost = payload.reduce((s, r) => s + Number(r.cost || 0), 0);
        await supabaseAdmin.from("ad_sync_runs").insert({
          provider: p.provider,
          status: "ok",
          rows_upserted: payload.length,
          period_start: isoSince,
          period_end: isoUntil,
        });
        results.push({ provider: p.provider, status: "ok", rows: payload.length, cost });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await supabaseAdmin.from("ad_sync_runs").insert({
          provider: p.provider,
          status: "error",
          rows_upserted: 0,
          period_start: isoSince,
          period_end: isoUntil,
          error_message: message.slice(0, 500),
        });
        results.push({ provider: p.provider, status: "error", rows: 0, cost: 0, error: message });
      }
    }

    return results;
  });
