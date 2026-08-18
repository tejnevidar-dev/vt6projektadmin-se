/** Aggregeringsmotor för SEO Command Center (server-only). */
import {
  categorizeKeyword,
  classifyIntent,
  expectedCtr,
  healthScore as calcHealth,
  keywordRecommendation,
  opportunityScore,
  periodDays,
  potentialTraffic,
  severityRank,
  type IssueSeverity,
  type KeywordRow,
  type PageAudit,
  type SeoIssue,
  type SeoPeriodKey,
} from "./analysis";
import { crawlSite, SITE_ORIGIN } from "./crawler.server";
import { ga4Status, runOrganicReport } from "./ga4.server";
import { psiConfigured, runPsi } from "./psi.server";
import { semrushConfigured } from "./semrush.server";

import { inspectUrl, resolveSiteUrl, searchAnalytics, TARGET_SITE } from "../gsc.server";
import type {
  ContentGap,
  DataSource,
  KeywordsResponse,
  LinkSuggestion,
  LocalReportRow,
  LocalTarget,
  OpportunityItem,
  OverviewResponse,
  SeoAlert,
  TechnicalResponse,
  Totals,
} from "./types";

type Sb = { from: (t: string) => any };

/* ----------------- datum ----------------- */

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function shiftDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function weekStart(d: Date) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

export function periodRange(period: SeoPeriodKey) {
  const days = periodDays(period);
  const endDate = shiftDays(new Date(), -3); // GSC-fördröjning
  const startDate = shiftDays(endDate, -days + 1);
  const prevEnd = shiftDays(startDate, -1);
  const prevStart = shiftDays(prevEnd, -days + 1);
  return { days, startDate: iso(startDate), endDate: iso(endDate), prevStart: iso(prevStart), prevEnd: iso(prevEnd) };
}

export async function requireSite(): Promise<string> {
  const r = await resolveSiteUrl(TARGET_SITE);
  if (r.status !== "selected") throw new Error(`Flera Search Console-egenskaper matchar: ${r.candidates.join(", ")}`);
  return r.siteUrl;
}

/* ----------------- datakällor ----------------- */

export async function dataSources(): Promise<DataSource[]> {
  const gscKeys = Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"]);
  let gscDetail = "Ansluten";
  let gscOk = gscKeys;
  if (gscKeys) {
    try {
      gscDetail = `Ansluten – egenskap ${await requireSite()}`;
    } catch (e) {
      gscOk = false;
      gscDetail = (e as Error).message;
    }
  } else {
    gscDetail = "Search Console-anslutningen saknas.";
  }
  const ga4 = ga4Status();
  return [
    { id: "gsc", name: "Google Search Console", connected: gscOk, detail: gscDetail, required: ["Google Search Console-anslutning"] },
    {
      id: "ga4",
      name: "Google Analytics 4",
      connected: ga4.connected,
      detail: ga4.connected ? `Property ${ga4.propertyId}` : ga4.reason,
      required: ["Google Analytics-anslutning", "GA4_PROPERTY_ID"],
    },
    {
      id: "psi",
      name: "PageSpeed Insights / Lighthouse",
      connected: true,
      detail: psiConfigured() ? "Ansluten med API-nyckel" : "Fungerar utan nyckel men med låg kvot. Lägg till PAGESPEED_API_KEY för stabil hämtning.",
      required: ["PAGESPEED_API_KEY (valfritt men rekommenderat)"],
    },
    { id: "crawler", name: "Egen sitecrawler + sitemap", connected: true, detail: `Crawlar ${SITE_ORIGIN}`, required: [] },
    {
      id: "serp",
      name: "Semrush – keywords, backlinks, konkurrenter",
      connected: semrushConfigured(),
      detail: semrushConfigured()
        ? "Ansluten. Sökvolym, keyword difficulty, backlinkprofil och konkurrenter hämtas live."
        : "Ingen extern SEO-API ansluten. Sökvolym, backlinks och konkurrentdata visas inte förrän Semrush kopplas in.",
      required: ["Semrush-anslutning"],
    },
    { id: "gbp", name: "Google Business Profile", connected: false, detail: "Ej ansluten. Det finns ingen Google Business Profile-connector i plattformen ännu – kräver egen OAuth-app mot Business Profile API.", required: ["Google Business Profile API (egen OAuth-app)"] },

  ];
}

/* ----------------- GSC-hjälpare ----------------- */

type Row = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

function totalsOf(rows: Row[] | undefined): Totals {
  const clicks = (rows ?? []).reduce((s, r) => s + (r.clicks ?? 0), 0);
  const impressions = (rows ?? []).reduce((s, r) => s + (r.impressions ?? 0), 0);
  const posSum = (rows ?? []).reduce((s, r) => s + (r.position ?? 0) * (r.impressions ?? 0), 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? posSum / impressions : 0 };
}

function mapDim(rows: Row[] | undefined) {
  return (rows ?? []).map((r) => ({
    key: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

/* ----------------- historik ----------------- */

export async function persistDaily(sb: Sb, siteUrl: string, dimension: string, rows: Row[], keyCount: 1 | 2 | 0) {
  const payload = (rows ?? [])
    .map((r) => {
      const keys = r.keys ?? [];
      const metric_date = keyCount === 0 ? keys[0] : keys[keyCount];
      if (!metric_date) return null;
      return {
        site_url: siteUrl,
        dimension,
        key1: keyCount === 0 ? "" : (keys[0] ?? ""),
        key2: keyCount === 2 ? (keys[1] ?? "") : "",
        metric_date,
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      };
    })
    .filter(Boolean);
  if (!payload.length) return 0;
  for (let i = 0; i < payload.length; i += 500) {
    await sb.from("seo_daily_metrics").upsert(payload.slice(i, i + 500), { onConflict: "site_url,dimension,key1,key2,metric_date" });
  }
  return payload.length;
}

/* ----------------- översikt ----------------- */

export async function buildOverview(sb: Sb, period: SeoPeriodKey): Promise<OverviewResponse> {
  const siteUrl = await requireSite();
  const { startDate, endDate, prevStart, prevEnd } = periodRange(period);
  const base = { startDate, endDate, type: "web" as const };

  const [daily, devices, countries, queries, prevQueries, prevTotals] = await Promise.all([
    searchAnalytics(siteUrl, { ...base, dimensions: ["date"], rowLimit: 500 }),
    searchAnalytics(siteUrl, { ...base, dimensions: ["device"], rowLimit: 10 }).catch(() => ({ rows: [] })),
    searchAnalytics(siteUrl, { ...base, dimensions: ["country"], rowLimit: 10 }).catch(() => ({ rows: [] })),
    searchAnalytics(siteUrl, { ...base, dimensions: ["query"], rowLimit: 1000 }),
    searchAnalytics(siteUrl, { startDate: prevStart, endDate: prevEnd, type: "web", dimensions: ["query"], rowLimit: 1000 }).catch(() => ({ rows: [] })),
    searchAnalytics(siteUrl, { startDate: prevStart, endDate: prevEnd, type: "web", rowLimit: 1 }).catch(() => ({ rows: [] })),
  ]);

  await persistDaily(sb, siteUrl, "total", daily.rows ?? [], 0).catch(() => 0);

  const series = (daily.rows ?? [])
    .map((r) => ({
      date: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const weekMap = new Map<string, { clicks: number; impressions: number; posSum: number }>();
  for (const p of series) {
    const ws = iso(weekStart(new Date(`${p.date}T00:00:00Z`)));
    const b = weekMap.get(ws) ?? { clicks: 0, impressions: 0, posSum: 0 };
    b.clicks += p.clicks;
    b.impressions += p.impressions;
    b.posSum += p.position * p.impressions;
    weekMap.set(ws, b);
  }
  const weekly = [...weekMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, b]) => ({
      date,
      clicks: b.clicks,
      impressions: b.impressions,
      ctr: b.impressions ? b.clicks / b.impressions : 0,
      position: b.impressions ? b.posSum / b.impressions : 0,
    }));

  const prevMap = new Map((prevQueries.rows ?? []).map((r) => [r.keys?.[0] ?? "", r]));
  const currentKeys = new Set((queries.rows ?? []).map((r) => r.keys?.[0] ?? ""));
  let improved = 0, declined = 0, added = 0;
  const buckets = { top3: 0, pos4_10: 0, pos11_20: 0, pos21_50: 0, total: 0 };
  for (const r of queries.rows ?? []) {
    const pos = r.position ?? 0;
    buckets.total++;
    if (pos <= 3) buckets.top3++;
    else if (pos <= 10) buckets.pos4_10++;
    else if (pos <= 20) buckets.pos11_20++;
    else if (pos <= 50) buckets.pos21_50++;
    const prev = prevMap.get(r.keys?.[0] ?? "");
    if (!prev) added++;
    else {
      const delta = (prev.position ?? 0) - pos;
      if (delta >= 1) improved++;
      else if (delta <= -1) declined++;
    }
  }
  const lost = (prevQueries.rows ?? []).filter((r) => !currentKeys.has(r.keys?.[0] ?? "")).length;

  let index: OverviewResponse["index"] = {
    verdict: null, coverageState: null, robotsTxtState: null, indexingState: null,
    lastCrawlTime: null, googleCanonical: null, userCanonical: null, pageFetchState: null,
    mobileVerdict: null, error: null,
  };
  try {
    const insp = await inspectUrl(siteUrl, TARGET_SITE);
    const r = insp.inspectionResult?.indexStatusResult ?? {};
    index = {
      verdict: r.verdict ?? null,
      coverageState: r.coverageState ?? null,
      robotsTxtState: r.robotsTxtState ?? null,
      indexingState: r.indexingState ?? null,
      lastCrawlTime: r.lastCrawlTime ?? null,
      googleCanonical: r.googleCanonical ?? null,
      userCanonical: r.userCanonical ?? null,
      pageFetchState: r.pageFetchState ?? null,
      mobileVerdict: insp.inspectionResult?.mobileUsabilityResult?.verdict ?? null,
      error: null,
    };
  } catch (e) {
    index.error = (e as Error).message;
  }

  const ga4 = ga4Status();
  let analytics: OverviewResponse["analytics"] = { connected: false, reason: ga4.connected ? undefined : (ga4 as any).reason };
  if (ga4.connected) {
    try {
      const rep = await runOrganicReport(startDate, endDate);
      analytics = { connected: true, users: rep.users, sessions: rep.sessions, conversions: rep.conversions };
    } catch (e) {
      analytics = { connected: false, reason: (e as Error).message };
    }
  }

  let pagespeed: OverviewResponse["pagespeed"] = { connected: false, reason: "Kunde inte hämtas." };
  try {
    const [mobile, desktop] = await Promise.all([runPsi(SITE_ORIGIN + "/", "mobile"), runPsi(SITE_ORIGIN + "/", "desktop")]);
    pagespeed = { connected: true, mobile, desktop };
  } catch (e) {
    pagespeed = { connected: false, reason: (e as Error).message };
  }

  const totals = totalsOf(daily.rows);
  const prevRow = prevTotals.rows?.[0];
  const previousTotals = prevRow
    ? { clicks: prevRow.clicks ?? 0, impressions: prevRow.impressions ?? 0, ctr: prevRow.ctr ?? 0, position: prevRow.position ?? 0 }
    : null;

  const alerts = buildAlerts({ totals, previousTotals, index, queries: queries.rows ?? [], prevMap, pagespeed });

  return {
    siteUrl,
    period,
    rangeStart: startDate,
    rangeEnd: endDate,
    totals,
    previousTotals,
    series,
    weekly,
    devices: mapDim(devices.rows),
    countries: mapDim(countries.rows).slice(0, 8),
    keywordBuckets: buckets,
    keywordMovement: { improved, declined, added, lost },
    index,
    analytics,
    pagespeed,
    alerts,
    fetchedAt: new Date().toISOString(),
  };
}

function buildAlerts(input: {
  totals: Totals;
  previousTotals: Totals | null;
  index: OverviewResponse["index"];
  queries: Row[];
  prevMap: Map<string, Row>;
  pagespeed: OverviewResponse["pagespeed"];
}): SeoAlert[] {
  const alerts: SeoAlert[] = [];
  const { totals, previousTotals } = input;
  if (previousTotals && previousTotals.clicks > 10) {
    const change = ((totals.clicks - previousTotals.clicks) / previousTotals.clicks) * 100;
    if (change <= -20) alerts.push({ id: "clicks_drop", severity: "critical", title: "Organiska klick faller", detail: `Klicken har minskat ${Math.abs(Math.round(change))} % mot föregående period.` });
    if (change >= 20) alerts.push({ id: "clicks_up", severity: "low", title: "Organiska klick ökar", detail: `Klicken har ökat ${Math.round(change)} % mot föregående period.` });
  }
  if (previousTotals && previousTotals.ctr > 0) {
    const ctrChange = ((totals.ctr - previousTotals.ctr) / previousTotals.ctr) * 100;
    if (ctrChange <= -25) alerts.push({ id: "ctr_drop", severity: "high", title: "Kraftigt CTR-fall", detail: `CTR har minskat ${Math.abs(Math.round(ctrChange))} %.` });
  }
  if (input.index.verdict && input.index.verdict !== "PASS")
    alerts.push({ id: "index_fail", severity: "critical", title: "Indexeringsproblem på startsidan", detail: `Search Console rapporterar: ${input.index.coverageState ?? input.index.verdict}.` });

  for (const r of input.queries) {
    const key = r.keys?.[0] ?? "";
    const prev = input.prevMap.get(key);
    if (!prev) {
      if ((r.clicks ?? 0) >= 5) alerts.push({ id: `new_${key}`, severity: "low", title: "Nytt sökord ger trafik", detail: `"${key}" ger ${r.clicks} klick, position ${(r.position ?? 0).toFixed(1)}.`, keyword: key });
      continue;
    }
    const drop = (r.position ?? 0) - (prev.position ?? 0);
    if (drop >= 5 && (prev.impressions ?? 0) >= 30)
      alerts.push({ id: `drop_${key}`, severity: "high", title: "Sökord tappar ranking", detail: `"${key}" har fallit ${drop.toFixed(1)} positioner (${(prev.position ?? 0).toFixed(1)} → ${(r.position ?? 0).toFixed(1)}).`, keyword: key });
  }

  const ps = input.pagespeed as any;
  if (ps.connected && ps.mobile?.performance != null && ps.mobile.performance < 50)
    alerts.push({ id: "cwv_mobile", severity: "high", title: "Svag mobilprestanda", detail: `Lighthouse performance ${ps.mobile.performance}/100 på mobil.` });

  return alerts.slice(0, 40);
}

/* ----------------- sökord ----------------- */

export async function buildKeywords(sb: Sb, period: SeoPeriodKey, localities: string[]): Promise<KeywordsResponse> {
  const siteUrl = await requireSite();
  const { startDate, endDate, prevStart, prevEnd } = periodRange(period);
  const base = { startDate, endDate, type: "web" as const };

  const [current, previous, queryPage, queryDevice, queryCountry] = await Promise.all([
    searchAnalytics(siteUrl, { ...base, dimensions: ["query"], rowLimit: 1000 }),
    searchAnalytics(siteUrl, { startDate: prevStart, endDate: prevEnd, type: "web", dimensions: ["query"], rowLimit: 1000 }).catch(() => ({ rows: [] })),
    searchAnalytics(siteUrl, { ...base, dimensions: ["query", "page"], rowLimit: 1000 }).catch(() => ({ rows: [] })),
    searchAnalytics(siteUrl, { ...base, dimensions: ["query", "device"], rowLimit: 1000 }).catch(() => ({ rows: [] })),
    searchAnalytics(siteUrl, { ...base, dimensions: ["query", "country"], rowLimit: 1000 }).catch(() => ({ rows: [] })),
  ]);

  await persistDaily(sb, siteUrl, "query", [], 1).catch(() => 0);

  const bestBy = (rows: Row[] | undefined) => {
    const m = new Map<string, { key: string; clicks: number; impressions: number }>();
    for (const r of rows ?? []) {
      const q = r.keys?.[0] ?? "";
      const v = r.keys?.[1] ?? "";
      const cur = m.get(q);
      const score = (r.clicks ?? 0) * 10 + (r.impressions ?? 0);
      if (!cur || score > cur.clicks * 10 + cur.impressions) m.set(q, { key: v, clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 });
    }
    return m;
  };
  const pageMap = bestBy(queryPage.rows);
  const deviceMap = bestBy(queryDevice.rows);
  const countryMap = bestBy(queryCountry.rows);
  const prevMap = new Map((previous.rows ?? []).map((r) => [r.keys?.[0] ?? "", r]));

  const rows: KeywordRow[] = (current.rows ?? []).map((r) => {
    const keyword = r.keys?.[0] ?? "";
    const prev = prevMap.get(keyword);
    const position = r.position ?? 0;
    const previousPosition = prev ? (prev.position ?? 0) : null;
    const impressions = r.impressions ?? 0;
    const clicks = r.clicks ?? 0;
    const ctr = r.ctr ?? 0;
    const intent = classifyIntent(keyword, localities);
    const exp = expectedCtr(position);
    const partial = {
      keyword,
      position,
      previousPosition,
      positionChange: previousPosition != null ? Number((previousPosition - position).toFixed(1)) : null,
      clicks,
      previousClicks: prev?.clicks ?? 0,
      impressions,
      previousImpressions: prev?.impressions ?? 0,
      ctr,
      expectedCtr: exp,
      ctrGap: Number((ctr - exp).toFixed(4)),
      landingPage: pageMap.get(keyword)?.key ?? null,
      device: deviceMap.get(keyword)?.key ?? null,
      country: countryMap.get(keyword)?.key ?? null,
      intent,
      potentialTraffic: potentialTraffic(impressions, position, clicks),
      isNew: !prev,
      isLost: false,
    };
    return {
      ...partial,
      categories: categorizeKeyword(partial),
      opportunityScore: opportunityScore({ impressions, position, clicks, ctr, expectedCtr: exp, intent, positionChange: partial.positionChange }),
      recommendation: keywordRecommendation(partial),
    };
  });

  const currentKeys = new Set(rows.map((r) => r.keyword));
  const lost = (previous.rows ?? [])
    .filter((r) => !currentKeys.has(r.keys?.[0] ?? "") && (r.impressions ?? 0) >= 10)
    .map((r) => ({
      keyword: r.keys?.[0] ?? "",
      previousPosition: r.position ?? 0,
      previousClicks: r.clicks ?? 0,
      previousImpressions: r.impressions ?? 0,
    }));

  return { period, rangeStart: startDate, rangeEnd: endDate, rows, lost, fetchedAt: new Date().toISOString() };
}

/* ----------------- teknisk SEO ----------------- */

export async function buildTechnical(sb: Sb, maxPages: number): Promise<TechnicalResponse> {
  const crawl = await crawlSite(SITE_ORIGIN, maxPages);
  const pages = crawl.audits;

  const byValue = (get: (p: PageAudit) => string | null) => {
    const m = new Map<string, string[]>();
    for (const p of pages) {
      const v = (get(p) ?? "").trim();
      if (!v) continue;
      m.set(v, [...(m.get(v) ?? []), p.url]);
    }
    return [...m.entries()].filter(([, urls]) => urls.length > 1).map(([value, urls]) => ({ value, urls }));
  };

  const duplicateTitles = byValue((p) => p.title);
  const duplicateDescriptions = byValue((p) => p.metaDescription);
  const orphanPages = pages.filter((p) => (p.internalLinksIn ?? 0) === 0 && p.url !== `${SITE_ORIGIN}/`).map((p) => p.url);

  const grouped = new Map<string, SeoIssue & { pages: number }>();
  for (const p of pages) {
    for (const i of p.issues) {
      const g = grouped.get(i.code);
      if (g) g.pages++;
      else grouped.set(i.code, { ...i, pages: 1 });
    }
  }
  for (const d of duplicateTitles)
    grouped.set(`dup_title_${d.value}`, { code: "duplicate_title", severity: "high", title: "Dubblerad title", detail: `"${d.value}" används på ${d.urls.length} sidor.`, fix: "Ge varje sida en unik title.", url: d.urls[0], pages: d.urls.length });
  for (const d of duplicateDescriptions)
    grouped.set(`dup_desc_${d.value}`, { code: "duplicate_description", severity: "medium", title: "Dubblerad meta description", detail: `Används på ${d.urls.length} sidor.`, fix: "Skriv unika beskrivningar.", url: d.urls[0], pages: d.urls.length });
  if (orphanPages.length)
    grouped.set("orphan", { code: "orphan_pages", severity: "medium", title: "Föräldralösa sidor", detail: `${orphanPages.length} sidor saknar interna inlänkar.`, fix: "Länka till sidorna från meny eller relaterat innehåll.", url: orphanPages[0], pages: orphanPages.length });
  if (crawl.robots.blocksAll)
    grouped.set("robots_block", { code: "robots_block_all", severity: "critical", title: "robots.txt blockerar allt", detail: "Disallow: / för alla robotar.", fix: "Ta bort den blockerande raden.", url: `${SITE_ORIGIN}/robots.txt`, pages: 1 });
  if (crawl.sitemapError)
    grouped.set("sitemap_err", { code: "sitemap_error", severity: "high", title: "Sitemap-problem", detail: crawl.sitemapError, fix: "Se till att sitemap.xml är nåbar och innehåller alla publika sidor.", url: `${SITE_ORIGIN}/sitemap.xml`, pages: 1 });

  const issues = [...grouped.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.pages - a.pages);
  const issuesBySeverity = issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<IssueSeverity, number>,
  );

  // spara sidanalyser
  try {
    await sb.from("seo_page_audits").upsert(
      pages.map((p) => ({
        url: p.url,
        status_code: p.statusCode,
        title: p.title,
        meta_description: p.metaDescription,
        h1: p.h1,
        headings: p.headings,
        word_count: p.wordCount,
        canonical: p.canonical,
        robots: p.robots,
        in_sitemap: p.inSitemap,
        internal_links_out: p.internalLinksOut,
        images_total: p.imagesTotal,
        images_missing_alt: p.imagesMissingAlt,
        structured_data: p.structuredData,
        html_bytes: p.htmlBytes,
        issues: p.issues,
        health_score: p.healthScore,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "url" },
    );
    await sb.from("seo_sync_log").insert({ source: "crawler", status: "ok", rows_written: pages.length, finished_at: new Date().toISOString() });
  } catch (e) {
    await sb.from("seo_sync_log").insert({ source: "crawler", status: "error", message: (e as Error).message, finished_at: new Date().toISOString() });
  }

  return {
    crawledAt: crawl.crawledAt,
    origin: SITE_ORIGIN,
    pagesCrawled: pages.length,
    robots: { ok: crawl.robots.ok, status: crawl.robots.status, blocksAll: crawl.robots.blocksAll, sitemaps: crawl.robots.sitemaps, error: (crawl.robots as any).error },
    sitemapUrls: crawl.sitemapUrls.length,
    sitemapError: crawl.sitemapError,
    issues,
    issuesBySeverity,
    duplicateTitles,
    duplicateDescriptions,
    orphanPages,
    pages: pages.sort((a, b) => a.healthScore - b.healthScore),
  };
}

/** Läser senast sparade sidanalyser utan att crawla om. */
export async function storedPages(sb: Sb): Promise<PageAudit[]> {
  const { data } = await sb.from("seo_page_audits").select("*").order("health_score", { ascending: true });
  return (data ?? []).map((r: any) => ({
    url: r.url,
    statusCode: r.status_code,
    title: r.title,
    metaDescription: r.meta_description,
    h1: r.h1 ?? [],
    headings: r.headings ?? [],
    wordCount: r.word_count ?? 0,
    canonical: r.canonical,
    robots: r.robots,
    inSitemap: r.in_sitemap,
    internalLinksOut: r.internal_links_out ?? [],
    imagesTotal: r.images_total ?? 0,
    imagesMissingAlt: r.images_missing_alt ?? 0,
    structuredData: r.structured_data ?? [],
    htmlBytes: r.html_bytes ?? 0,
    issues: r.issues ?? [],
    healthScore: r.health_score ?? calcHealth(r.issues ?? []),
  }));
}

/* ----------------- möjligheter ----------------- */

export function buildOpportunities(keywords: KeywordRow[], pages: PageAudit[], local: LocalReportRow[]): OpportunityItem[] {
  const items: OpportunityItem[] = [];
  const prio = (s: number): OpportunityItem["priority"] => (s >= 75 ? "critical" : s >= 55 ? "high" : s >= 35 ? "medium" : "low");

  for (const k of keywords) {
    if (k.opportunityScore < 25) continue;
    const cat = k.categories.includes("high_impr_low_ctr")
      ? "CTR"
      : k.categories.includes("declining")
        ? "Tappad ranking"
        : k.categories.includes("untapped")
          ? "Nytt innehåll"
          : "Innehåll";
    items.push({
      id: `kw_${k.keyword}`,
      score: k.opportunityScore,
      priority: prio(k.opportunityScore),
      category: cat,
      title:
        cat === "CTR"
          ? `Optimera title/meta för "${k.keyword}"`
          : cat === "Nytt innehåll"
            ? `Skapa dedikerad sida för "${k.keyword}"`
            : `Förbättra ranking för "${k.keyword}"`,
      why:
        cat === "CTR"
          ? `Sökordet får ${Math.round(k.impressions)} visningar men bara ${Math.round(k.clicks)} klick (CTR ${(k.ctr * 100).toFixed(1)} % mot förväntade ${(k.expectedCtr * 100).toFixed(1)} % på position ${k.position.toFixed(1)}).`
          : cat === "Tappad ranking"
            ? `Positionen har fallit ${Math.abs(k.positionChange ?? 0)} steg till ${k.position.toFixed(1)}.`
            : `Position ${k.position.toFixed(1)} med ${Math.round(k.impressions)} visningar – potentiellt ${k.potentialTraffic} extra klick vid topp 3.`,
      keywords: [k.keyword],
      url: k.landingPage,
      currentData: `Pos ${k.position.toFixed(1)} · ${Math.round(k.clicks)} klick · ${Math.round(k.impressions)} visn. · CTR ${(k.ctr * 100).toFixed(1)} %`,
      expectedEffect: `+${k.potentialTraffic} klick/period vid topp 3`,
      action: k.recommendation,
      difficulty: k.position > 20 ? 70 : k.position > 10 ? 50 : 30,
      impact: Math.min(100, Math.round(k.opportunityScore * 1.1)),
    });
  }

  for (const p of pages) {
    for (const i of p.issues) {
      if (i.severity === "low") continue;
      const score = i.severity === "critical" ? 85 : i.severity === "high" ? 60 : 40;
      items.push({
        id: `page_${p.url}_${i.code}`,
        score,
        priority: prio(score),
        category: "Teknisk SEO",
        title: `${i.title} – ${new URL(p.url).pathname}`,
        why: i.detail,
        keywords: [],
        url: p.url,
        currentData: `Health score ${p.healthScore}/100 · ${p.wordCount} ord · ${p.internalLinksIn ?? 0} inlänkar`,
        expectedEffect: i.severity === "critical" ? "Kan blockera indexering och all trafik till sidan" : "Bättre relevanssignaler och CTR",
        action: i.fix,
        difficulty: 25,
        impact: score,
      });
    }
  }

  for (const l of local) {
    if (l.status === "stark") continue;
    const score = l.status === "saknas" ? 65 : l.status === "svag" ? 55 : 35;
    items.push({
      id: `local_${l.service}_${l.locality}`,
      score,
      priority: prio(score),
      category: "Lokal SEO",
      title: `${l.service} i ${l.locality}`,
      why: l.recommendation,
      keywords: [`${l.service} ${l.locality}`],
      url: l.landingUrl,
      currentData: l.position != null ? `Pos ${l.position.toFixed(1)} · ${l.clicks} klick · ${l.impressions} visn.` : "Ingen rapporterad Search Console-data",
      expectedEffect: "Ökad lokal synlighet för tjänst + ort",
      action: l.hasPage ? "Förbättra den befintliga lokala sidan med unikt innehåll, referensprojekt och intern länkning." : "Skapa en dedikerad landningssida för tjänsten i orten.",
      difficulty: l.hasPage ? 40 : 65,
      impact: score,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 100);
}

/* ----------------- lokal SEO ----------------- */

export function buildLocal(targets: LocalTarget[], keywords: KeywordRow[], pages: PageAudit[]): LocalReportRow[] {
  return targets
    .filter((t) => t.active)
    .map((t) => {
      const needle = `${t.service} ${t.locality}`.toLowerCase();
      const svc = t.service.toLowerCase();
      const loc = t.locality.toLowerCase();
      const matches = keywords.filter((k) => {
        const kw = k.keyword.toLowerCase();
        return kw.includes(loc) && (kw.includes(svc) || svc.split(" ").some((w) => w.length > 3 && kw.includes(w)));
      });
      const clicks = matches.reduce((s, k) => s + k.clicks, 0);
      const impressions = matches.reduce((s, k) => s + k.impressions, 0);
      const position = impressions ? matches.reduce((s, k) => s + k.position * k.impressions, 0) / impressions : null;

      const candidatePages = pages.filter((p) => {
        const u = p.url.toLowerCase();
        const text = `${p.title ?? ""} ${p.h1.join(" ")}`.toLowerCase();
        return u.includes(loc.replace(/\s+/g, "-")) || text.includes(loc);
      });
      const landingUrl = t.landing_url ?? candidatePages[0]?.url ?? null;
      const hasPage = Boolean(landingUrl);

      let status: LocalReportRow["status"];
      let recommendation: string;
      if (position != null && position <= 5) {
        status = "stark";
        recommendation = `Stark position (${position.toFixed(1)}) för "${needle}". Behåll och bevaka.`;
      } else if (position != null) {
        status = "svag";
        recommendation = `Position ${position.toFixed(1)} för "${needle}". Stärk landningssidan med lokalt innehåll, referenser och interna länkar.`;
      } else if (!hasPage) {
        status = "saknas";
        recommendation = `Ingen lokal sida för "${needle}" och ingen rapporterad data. Skapa en landningssida för tjänsten i orten.`;
      } else {
        status = "obevakad";
        recommendation = `Sidan finns men Search Console rapporterar ingen data för "${needle}" ännu. Kontrollera indexering och innehållets ortsrelevans.`;
      }

      const cannibalization = candidatePages.length > 1 ? candidatePages.map((p) => p.url) : [];

      return {
        service: t.service,
        locality: t.locality,
        landingUrl,
        hasPage,
        keywords: matches.length,
        clicks,
        impressions,
        position,
        status,
        recommendation,
        cannibalization,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);
}

/* ----------------- content gaps & interna länkar ----------------- */

export function buildContentGaps(keywords: KeywordRow[], pages: PageAudit[], local: LocalReportRow[]): ContentGap[] {
  const gaps: ContentGap[] = [];
  const slug = (s: string) => s.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const untapped = keywords.filter((k) => k.position > 15 && k.impressions >= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 20);
  for (const k of untapped) {
    const related = keywords
      .filter((x) => x.keyword !== k.keyword && x.keyword.split(" ").some((w) => w.length > 4 && k.keyword.includes(w)))
      .slice(0, 5)
      .map((x) => x.keyword);
    gaps.push({
      id: `gap_${k.keyword}`,
      primaryKeyword: k.keyword,
      secondaryKeywords: related,
      intent: k.intent,
      impressions: k.impressions,
      position: k.position,
      recommendedUrl: `/${slug(k.keyword)}`,
      recommendedTitle: `${k.keyword.charAt(0).toUpperCase()}${k.keyword.slice(1)} – RoslagsTak`,
      recommendedH1: k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1),
      outline: [
        "Kort intro som svarar direkt på sökintentionen",
        "Vad ingår i tjänsten – steg för steg",
        "Priser, ROT-avdrag och vad som påverkar kostnaden",
        "Referensprojekt med bilder",
        "Vanliga frågor (FAQ med schema)",
        "Tydlig CTA: begär offert",
      ],
      linkFrom: pages.filter((p) => (p.internalLinksIn ?? 0) > 1).slice(0, 3).map((p) => p.url),
      reason: `${Math.round(k.impressions)} visningar men position ${k.position.toFixed(1)} – ingen sida matchar sökintentionen tillräckligt väl.`,
    });
  }

  for (const l of local.filter((x) => x.status === "saknas").slice(0, 15)) {
    gaps.push({
      id: `gap_local_${l.service}_${l.locality}`,
      primaryKeyword: `${l.service} ${l.locality}`,
      secondaryKeywords: [`${l.service} i ${l.locality}`, `${l.service} nära mig`, `${l.service} pris ${l.locality}`],
      intent: "local",
      impressions: l.impressions,
      position: l.position,
      recommendedUrl: `/${slug(l.service)}-${slug(l.locality)}`,
      recommendedTitle: `${l.service} i ${l.locality} – RoslagsTak`,
      recommendedH1: `${l.service} i ${l.locality}`,
      outline: [
        `Lokal intro: ${l.service} i ${l.locality} och närliggande områden`,
        "Vanliga taktyper och förutsättningar i området",
        "Process, garantier och ROT-avdrag",
        "Referensprojekt i orten",
        "FAQ",
        "Kontakt/offertformulär",
      ],
      linkFrom: pages.slice(0, 3).map((p) => p.url),
      reason: `Ingen dedikerad landningssida för ${l.service} i ${l.locality}.`,
    });
  }

  const thin = pages.filter((p) => p.wordCount < 300 && (p.statusCode ?? 200) < 400);
  for (const p of thin.slice(0, 10)) {
    gaps.push({
      id: `gap_thin_${p.url}`,
      primaryKeyword: p.h1[0] ?? p.title ?? p.url,
      secondaryKeywords: [],
      intent: "commercial",
      impressions: 0,
      position: null,
      recommendedUrl: new URL(p.url).pathname,
      recommendedTitle: p.title ?? "",
      recommendedH1: p.h1[0] ?? "",
      outline: ["Utöka med process, priser, referenser och FAQ", "Lägg till bilder med alt-text", "Interna länkar till relaterade tjänster"],
      linkFrom: [],
      reason: `Tunt innehåll: ${p.wordCount} ord.`,
    });
  }

  return gaps;
}

export function buildLinkSuggestions(pages: PageAudit[], keywords: KeywordRow[]): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const hubs = [...pages].sort((a, b) => (b.internalLinksIn ?? 0) - (a.internalLinksIn ?? 0)).slice(0, 5);

  for (const p of pages) {
    if ((p.internalLinksIn ?? 0) > 2) continue;
    const kw = keywords.find((k) => k.landingPage === p.url);
    for (const hub of hubs.slice(0, 2)) {
      if (hub.url === p.url) continue;
      suggestions.push({
        from: hub.url,
        to: p.url,
        anchor: kw?.keyword ?? p.h1[0] ?? p.title ?? new URL(p.url).pathname,
        reason: `${new URL(p.url).pathname} har bara ${p.internalLinksIn ?? 0} interna inlänkar – länka från en stark sida.`,
      });
    }
  }
  return suggestions.slice(0, 40);
}
