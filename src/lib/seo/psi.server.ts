/** Google PageSpeed Insights (server-only). Fungerar utan nyckel men med hård kvot. */

export type PsiResult = {
  strategy: "mobile" | "desktop";
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
  fieldData: boolean;
  fetchedAt: string;
};

export function psiConfigured(): boolean {
  return Boolean(process.env["PAGESPEED_API_KEY"]);
}

export async function runPsi(url: string, strategy: "mobile" | "desktop"): Promise<PsiResult> {
  const key = process.env["PAGESPEED_API_KEY"];
  const params = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) params.append("category", c);
  if (key) params.set("key", key);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`);
  if (!res.ok) {
    throw new Error(`PageSpeed Insights misslyckades [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as any;
  const cat = json.lighthouseResult?.categories ?? {};
  const audits = json.lighthouseResult?.audits ?? {};
  const field = json.loadingExperience?.metrics ?? {};
  const pick = (v: any) => (typeof v?.score === "number" ? Math.round(v.score * 100) : null);
  return {
    strategy,
    performance: pick(cat.performance),
    seo: pick(cat.seo),
    accessibility: pick(cat.accessibility),
    bestPractices: pick(cat["best-practices"]),
    lcp: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? audits["largest-contentful-paint"]?.numericValue ?? null,
    cls:
      field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null
        ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
        : (audits["cumulative-layout-shift"]?.numericValue ?? null),
    inp: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    ttfb: field.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ?? audits["server-response-time"]?.numericValue ?? null,
    fieldData: Boolean(json.loadingExperience?.metrics),
    fetchedAt: new Date().toISOString(),
  };
}
