/** Marknadsdata (Semrush) för SEO Command Center. */
import { SITE_ORIGIN } from "./crawler.server";
import type { MarketResponse } from "./types";
import {
  backlinkProfile,
  domainOverview,
  keywordMetrics,
  organicCompetitors,
  semrushConfigured,
} from "./semrush.server";

export type { MarketResponse };


export function siteDomain(): string {
  try {
    return new URL(SITE_ORIGIN).hostname.replace(/^www\./, "");
  } catch {
    return SITE_ORIGIN.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

export async function buildMarket(
  gscKeywords: { keyword: string; clicks: number; impressions: number; position: number }[],
  database = "se",
): Promise<MarketResponse> {
  const domain = siteDomain();
  const base = { connected: false, domain, database, fetchedAt: new Date().toISOString() };
  if (!semrushConfigured()) {
    return { ...base, reason: "Datakälla ej ansluten: Semrush saknas." };
  }
  const top = gscKeywords.slice(0, 100);
  const [overview, backlinks, competitors, metrics] = await Promise.all([
    domainOverview(domain, database).catch(() => undefined),
    backlinkProfile(domain).catch(() => undefined),
    organicCompetitors(domain, database).catch(() => []),
    keywordMetrics(top.map((k) => k.keyword), database).catch(() => []),
  ]);
  const byPhrase = new Map(metrics.map((m) => [m.phrase, m]));
  return {
    ...base,
    connected: true,
    overview,
    backlinks,
    competitors,
    keywords: top.map((k) => {
      const m = byPhrase.get(k.keyword.trim().toLowerCase());
      return {
        ...k,
        volume: m ? m.volume : null,
        difficulty: m?.difficulty ?? null,
        cpc: m ? m.cpc : null,
      };
    }),
  };
}
