import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SeoPeriodKey } from "@/lib/seo/analysis";
import type {
  ContentGap,
  DataSource,
  KeywordsResponse,
  LinkSuggestion,
  LocalReportRow,
  OpportunityItem,
  OverviewResponse,
  SeoTask,
  TechnicalResponse,
} from "@/lib/seo/types";

async function assertAdmin(context: any) {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (!(data ?? []).some((r: { role: string }) => r.role === "admin")) throw new Error("Behörighet saknas");
  return context.supabase;
}

const periodInput = (input: { period?: SeoPeriodKey } | undefined) => ({
  period: (input?.period ?? "28d") as SeoPeriodKey,
});

export const getSeoSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DataSource[]> => {
    await assertAdmin(context);
    const { dataSources } = await import("@/lib/seo/engine.server");
    return dataSources();
  });

export const getSeoOverviewV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodInput)
  .handler(async ({ data, context }): Promise<OverviewResponse> => {
    const sb = await assertAdmin(context);
    const { buildOverview } = await import("@/lib/seo/engine.server");
    return buildOverview(sb, data.period);
  });

export const getSeoKeywords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodInput)
  .handler(async ({ data, context }): Promise<KeywordsResponse> => {
    const sb = await assertAdmin(context);
    const { buildKeywords } = await import("@/lib/seo/engine.server");
    const { data: targets } = await sb.from("seo_local_targets").select("locality");
    const localities = [...new Set((targets ?? []).map((t: { locality: string }) => t.locality))] as string[];
    return buildKeywords(sb, data.period, localities);
  });

export const getSeoTechnical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recrawl?: boolean; maxPages?: number } | undefined) => ({
    recrawl: input?.recrawl ?? false,
    maxPages: Math.min(Math.max(input?.maxPages ?? 40, 5), 120),
  }))
  .handler(async ({ data, context }): Promise<TechnicalResponse> => {
    const sb = await assertAdmin(context);
    const { buildTechnical } = await import("@/lib/seo/engine.server");
    return buildTechnical(sb, data.maxPages);
  });

export type SeoInsights = {
  opportunities: OpportunityItem[];
  local: LocalReportRow[];
  gaps: ContentGap[];
  links: LinkSuggestion[];
  orphanPages: string[];
  fetchedAt: string;
};

export const getSeoInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodInput)
  .handler(async ({ data, context }): Promise<SeoInsights> => {
    const sb = await assertAdmin(context);
    const engine = await import("@/lib/seo/engine.server");
    const { data: targets } = await sb.from("seo_local_targets").select("*");
    const localities = [...new Set(((targets ?? []) as any[]).map((t) => t.locality))] as string[];
    const [keywords, pages] = await Promise.all([
      engine.buildKeywords(sb, data.period, localities),
      engine.storedPages(sb),
    ]);
    const local = engine.buildLocal((targets ?? []) as any[], keywords.rows, pages);
    return {
      opportunities: engine.buildOpportunities(keywords.rows, pages, local),
      local,
      gaps: engine.buildContentGaps(keywords.rows, pages, local),
      links: engine.buildLinkSuggestions(pages, keywords.rows),
      orphanPages: pages.filter((p) => (p.internalLinksIn ?? 0) === 0).map((p) => p.url),
      fetchedAt: new Date().toISOString(),
    };
  });

export const getSeoMarket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { period?: SeoPeriodKey; database?: string } | undefined) => ({
    period: (input?.period ?? "28d") as SeoPeriodKey,
    database: (input?.database ?? "se").toLowerCase(),
  }))
  .handler(async ({ data, context }) => {
    const sb = await assertAdmin(context);
    const engine = await import("@/lib/seo/engine.server");
    const { buildMarket } = await import("@/lib/seo/market.server");
    const keywords = await engine.buildKeywords(sb, data.period, []);
    return buildMarket(
      keywords.rows
        .slice()
        .sort((a, b) => b.impressions - a.impressions)
        .map((k) => ({ keyword: k.keyword, clicks: k.clicks, impressions: k.impressions, position: k.position })),
      data.database,
    );
  });


/* ---- lokala mål ---- */

export const listLocalTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await assertAdmin(context);
    const { data } = await sb.from("seo_local_targets").select("*").order("locality");
    return (data ?? []) as any[];
  });

export const upsertLocalTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; service: string; locality: string; landing_url?: string | null; active?: boolean }) => {
    if (!input.service?.trim() || !input.locality?.trim()) throw new Error("Tjänst och ort krävs");
    return {
      id: input.id,
      service: input.service.trim(),
      locality: input.locality.trim(),
      landing_url: input.landing_url?.trim() || null,
      active: input.active ?? true,
    };
  })
  .handler(async ({ data, context }) => {
    const sb = await assertAdmin(context);
    const row: any = { service: data.service, locality: data.locality, landing_url: data.landing_url, active: data.active };
    if (data.id) row.id = data.id;
    const { error } = await sb.from("seo_local_targets").upsert(row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLocalTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data, context }) => {
    const sb = await assertAdmin(context);
    await sb.from("seo_local_targets").delete().eq("id", data.id);
    return { ok: true };
  });

/* ---- uppgifter ---- */

export const listSeoTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeoTask[]> => {
    const sb = await assertAdmin(context);
    const { data } = await sb.from("seo_tasks").select("*").order("opportunity_score", { ascending: false });
    return (data ?? []) as SeoTask[];
  });

export const createSeoTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    category?: string;
    priority?: string;
    impact?: number;
    difficulty?: number;
    opportunity_score?: number;
    affected_url?: string | null;
    target_keyword?: string | null;
    problem?: string | null;
    recommendation?: string | null;
    source?: string;
    source_key?: string | null;
    baseline?: Record<string, number> | null;
  }) => {
    if (!input.title?.trim()) throw new Error("Titel krävs");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = await assertAdmin(context);
    const { error } = await sb.from("seo_tasks").insert({
      title: data.title.trim(),
      category: data.category ?? "Övrigt",
      priority: data.priority ?? "medium",
      impact: data.impact ?? 50,
      difficulty: data.difficulty ?? 50,
      opportunity_score: data.opportunity_score ?? 50,
      affected_url: data.affected_url ?? null,
      target_keyword: data.target_keyword ?? null,
      problem: data.problem ?? null,
      recommendation: data.recommendation ?? null,
      source: data.source ?? "manual",
      source_key: data.source_key ?? null,
      baseline: data.baseline ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSeoTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status?: string; priority?: string; recommendation?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = await assertAdmin(context);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) {
      patch.status = data.status;
      patch.completed_at = data.status === "done" ? new Date().toISOString() : null;
    }
    if (data.priority) patch.priority = data.priority;
    if (data.recommendation !== undefined) patch.recommendation = data.recommendation;
    const { error } = await sb.from("seo_tasks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSeoTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data, context }) => {
    const sb = await assertAdmin(context);
    await sb.from("seo_tasks").delete().eq("id", data.id);
    return { ok: true };
  });
