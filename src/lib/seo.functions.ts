import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SeoWeek = {
  weekStart: string;
  weekEnd: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoOverview = {
  siteUrl: string;
  rangeStart: string;
  rangeEnd: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  previousTotals: { clicks: number; impressions: number; ctr: number; position: number } | null;
  weeks: SeoWeek[];
  topQueries: SeoRow[];
  topPages: SeoRow[];
  index: {
    verdict: string | null;
    coverageState: string | null;
    robotsTxtState: string | null;
    indexingState: string | null;
    lastCrawlTime: string | null;
    googleCanonical: string | null;
    userCanonical: string | null;
    pageFetchState: string | null;
    mobileVerdict: string | null;
    error: string | null;
  };
  fetchedAt: string;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function shiftDays(d: Date, days: number) {
  const n = new Date(d);
  n.setUTCDate(n.getUTCDate() + days);
  return n;
}

/** Monday-based week start */
function weekStart(d: Date) {
  const n = new Date(d);
  const day = (n.getUTCDay() + 6) % 7;
  n.setUTCDate(n.getUTCDate() - day);
  return n;
}

export const getSeoOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { weeks?: number } | undefined) => ({
    weeks: Math.min(Math.max(input?.weeks ?? 12, 4), 26),
  }))
  .handler(async ({ data, context }): Promise<SeoOverview> => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roleRows ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "saljare",
    );
    if (!allowed) throw new Error("Behörighet saknas");

    const { resolveSiteUrl, searchAnalytics, inspectUrl, TARGET_SITE } = await import("./gsc.server");

    const resolution = await resolveSiteUrl(TARGET_SITE);
    if (resolution.status !== "selected") {
      throw new Error(
        `Flera Search Console-egenskaper matchar: ${resolution.candidates.join(", ")}`,
      );
    }
    const siteUrl = resolution.siteUrl;

    // Search Console-data släpar ~3 dagar
    const end = weekStart(shiftDays(new Date(), -3));
    const endDate = shiftDays(end, -1); // senaste avslutade söndag
    const startDate = shiftDays(endDate, -(data.weeks * 7) + 1);
    const prevEnd = shiftDays(startDate, -1);
    const prevStart = shiftDays(prevEnd, -(data.weeks * 7) + 1);

    const base = { startDate: iso(startDate), endDate: iso(endDate), type: "web" as const };

    const [daily, queries, pages, previous] = await Promise.all([
      searchAnalytics(siteUrl, { ...base, dimensions: ["date"], rowLimit: 1000 }),
      searchAnalytics(siteUrl, { ...base, dimensions: ["query"], rowLimit: 25 }),
      searchAnalytics(siteUrl, { ...base, dimensions: ["page"], rowLimit: 25 }),
      searchAnalytics(siteUrl, {
        startDate: iso(prevStart),
        endDate: iso(prevEnd),
        type: "web",
        rowLimit: 1,
      }).catch(() => ({ rows: [] })),
    ]);

    const buckets = new Map<string, { clicks: number; impressions: number; posSum: number; imps: number }>();
    for (const row of daily.rows ?? []) {
      const date = row.keys?.[0];
      if (!date) continue;
      const ws = iso(weekStart(new Date(`${date}T00:00:00Z`)));
      const b = buckets.get(ws) ?? { clicks: 0, impressions: 0, posSum: 0, imps: 0 };
      b.clicks += row.clicks ?? 0;
      b.impressions += row.impressions ?? 0;
      b.posSum += (row.position ?? 0) * (row.impressions ?? 0);
      b.imps += row.impressions ?? 0;
      buckets.set(ws, b);
    }

    const weeks: SeoWeek[] = [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([ws, b]) => ({
        weekStart: ws,
        weekEnd: iso(shiftDays(new Date(`${ws}T00:00:00Z`), 6)),
        clicks: b.clicks,
        impressions: b.impressions,
        ctr: b.impressions ? b.clicks / b.impressions : 0,
        position: b.imps ? b.posSum / b.imps : 0,
      }));

    const totalClicks = weeks.reduce((s, w) => s + w.clicks, 0);
    const totalImpr = weeks.reduce((s, w) => s + w.impressions, 0);
    const posSum = weeks.reduce((s, w) => s + w.position * w.impressions, 0);

    const prevRow = previous.rows?.[0];

    const mapRows = (rows: typeof queries.rows): SeoRow[] =>
      (rows ?? []).map((r) => ({
        key: r.keys?.[0] ?? "",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      }));

    let index: SeoOverview["index"] = {
      verdict: null,
      coverageState: null,
      robotsTxtState: null,
      indexingState: null,
      lastCrawlTime: null,
      googleCanonical: null,
      userCanonical: null,
      pageFetchState: null,
      mobileVerdict: null,
      error: null,
    };
    try {
      const inspection = await inspectUrl(siteUrl, TARGET_SITE);
      const r = inspection.inspectionResult?.indexStatusResult ?? {};
      index = {
        verdict: r.verdict ?? null,
        coverageState: r.coverageState ?? null,
        robotsTxtState: r.robotsTxtState ?? null,
        indexingState: r.indexingState ?? null,
        lastCrawlTime: r.lastCrawlTime ?? null,
        googleCanonical: r.googleCanonical ?? null,
        userCanonical: r.userCanonical ?? null,
        pageFetchState: r.pageFetchState ?? null,
        mobileVerdict: inspection.inspectionResult?.mobileUsabilityResult?.verdict ?? null,
        error: null,
      };
    } catch (e) {
      index.error = e instanceof Error ? e.message : "Okänt fel";
    }

    return {
      siteUrl,
      rangeStart: iso(startDate),
      rangeEnd: iso(endDate),
      totals: {
        clicks: totalClicks,
        impressions: totalImpr,
        ctr: totalImpr ? totalClicks / totalImpr : 0,
        position: totalImpr ? posSum / totalImpr : 0,
      },
      previousTotals: prevRow
        ? {
            clicks: prevRow.clicks ?? 0,
            impressions: prevRow.impressions ?? 0,
            ctr: prevRow.ctr ?? 0,
            position: prevRow.position ?? 0,
          }
        : null,
      weeks,
      topQueries: mapRows(queries.rows),
      topPages: mapRows(pages.rows),
      fetchedAt: new Date().toISOString(),
    };
  });
