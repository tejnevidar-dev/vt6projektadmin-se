/**
 * Rena analysfunktioner för SEO-panelen. Inga API-anrop, inga sidoeffekter.
 * Används både på server och klient.
 */

export type SeoPeriodKey = "7d" | "28d" | "3m" | "6m" | "12m";

export const SEO_PERIODS: { key: SeoPeriodKey; label: string; days: number }[] = [
  { key: "7d", label: "7 dagar", days: 7 },
  { key: "28d", label: "28 dagar", days: 28 },
  { key: "3m", label: "3 månader", days: 90 },
  { key: "6m", label: "6 månader", days: 180 },
  { key: "12m", label: "12 månader", days: 365 },
];

export function periodDays(key: SeoPeriodKey): number {
  return SEO_PERIODS.find((p) => p.key === key)?.days ?? 28;
}

/** Ungefärlig organisk CTR-kurva per Google-position (branschgenomsnitt). */
export const CTR_CURVE: Record<number, number> = {
  1: 0.283, 2: 0.152, 3: 0.11, 4: 0.08, 5: 0.061, 6: 0.048, 7: 0.04,
  8: 0.033, 9: 0.028, 10: 0.025, 11: 0.017, 12: 0.015, 13: 0.013,
  14: 0.012, 15: 0.011, 16: 0.01, 17: 0.009, 18: 0.008, 19: 0.008, 20: 0.007,
};

export function expectedCtr(position: number): number {
  const p = Math.max(1, Math.round(position));
  if (p <= 20) return CTR_CURVE[p] ?? 0.007;
  if (p <= 50) return 0.004;
  return 0.002;
}

/** Potentiell extra trafik/månad om sökordet når position 3. */
export function potentialTraffic(impressions: number, position: number, clicks: number): number {
  if (position <= 3) return 0;
  const potential = impressions * expectedCtr(3);
  return Math.max(0, Math.round(potential - clicks));
}

export type SearchIntent = "transactional" | "commercial" | "informational" | "navigational" | "local";

const INFO_HINTS = ["hur", "vad", "varför", "när", "guide", "tips", "kostnad", "pris på", "skillnad", "livslängd"];
const TRANS_HINTS = ["offert", "boka", "beställ", "köp", "pris", "kostnad", "billig", "företag", "firma"];
const COMMERCIAL_HINTS = ["bäst", "bästa", "jämför", "recension", "omdöme", "vilken"];

export function classifyIntent(keyword: string, localities: string[] = []): SearchIntent {
  const k = keyword.toLowerCase();
  if (localities.some((l) => l && k.includes(l.toLowerCase()))) return "local";
  if (k.includes("roslagstak") || k.includes("roslags tak")) return "navigational";
  if (COMMERCIAL_HINTS.some((h) => k.includes(h))) return "commercial";
  if (INFO_HINTS.some((h) => k.startsWith(h) || k.includes(` ${h} `))) return "informational";
  if (TRANS_HINTS.some((h) => k.includes(h))) return "transactional";
  return "commercial";
}

export type KeywordCategory =
  | "striking_distance"
  | "high_impr_low_ctr"
  | "almost_page1"
  | "declining"
  | "growing"
  | "untapped"
  | "top3";

export type KeywordRow = {
  keyword: string;
  position: number;
  previousPosition: number | null;
  positionChange: number | null;
  clicks: number;
  previousClicks: number;
  impressions: number;
  previousImpressions: number;
  ctr: number;
  expectedCtr: number;
  ctrGap: number;
  landingPage: string | null;
  device: string | null;
  country: string | null;
  intent: SearchIntent;
  potentialTraffic: number;
  opportunityScore: number;
  categories: KeywordCategory[];
  recommendation: string;
  isNew: boolean;
  isLost: boolean;
};

export function categorizeKeyword(r: Omit<KeywordRow, "categories" | "recommendation" | "opportunityScore">): KeywordCategory[] {
  const cats: KeywordCategory[] = [];
  const pos = r.position;
  const change = r.positionChange ?? 0;
  if (pos <= 3) cats.push("top3");
  if (pos >= 4 && pos <= 20) cats.push("striking_distance");
  if (pos >= 8 && pos <= 15) cats.push("almost_page1");
  if (r.impressions >= 50 && r.ctr < r.expectedCtr * 0.5) cats.push("high_impr_low_ctr");
  if (change <= -3) cats.push("declining");
  if (change >= 3) cats.push("growing");
  if (pos > 20 && r.impressions >= 20) cats.push("untapped");
  return cats;
}

/** 0–100. Väger potentiell trafik, närhet till topp 3, CTR-gap och intent. */
export function opportunityScore(r: {
  impressions: number;
  position: number;
  clicks: number;
  ctr: number;
  expectedCtr: number;
  intent: SearchIntent;
  positionChange: number | null;
}): number {
  const potential = potentialTraffic(r.impressions, r.position, r.clicks);
  const volumeScore = Math.min(40, Math.log10(1 + potential) * 22);
  const proximity = r.position <= 3 ? 0 : r.position <= 10 ? 25 : r.position <= 20 ? 18 : r.position <= 50 ? 8 : 3;
  const ctrScore = r.expectedCtr > 0 ? Math.min(15, Math.max(0, (r.expectedCtr - r.ctr) / r.expectedCtr) * 15) : 0;
  const intentScore =
    r.intent === "transactional" ? 15 : r.intent === "local" ? 13 : r.intent === "commercial" ? 9 : r.intent === "informational" ? 5 : 2;
  const trend = (r.positionChange ?? 0) <= -3 ? 5 : 0;
  return Math.max(0, Math.min(100, Math.round(volumeScore + proximity + ctrScore + intentScore + trend)));
}

export function keywordRecommendation(r: Pick<KeywordRow, "position" | "ctr" | "expectedCtr" | "impressions" | "landingPage" | "positionChange" | "intent">): string {
  if (r.position > 20 && r.impressions >= 20)
    return "Skapa eller stärk en dedikerad sida för sökintentionen – innehållet matchar i dag för svagt.";
  if ((r.positionChange ?? 0) <= -3)
    return "Positionen faller. Uppdatera och utöka innehållet, kontrollera teknik och interna länkar till sidan.";
  if (r.impressions >= 50 && r.ctr < r.expectedCtr * 0.5)
    return "Skriv om title och meta description så de matchar sökintentionen – visningar finns men klicken uteblir.";
  if (r.position >= 4 && r.position <= 20)
    return "Striking distance: fördjupa innehållet på landningssidan och lägg till interna länkar med relevant ankartext.";
  if (r.position <= 3) return "Behåll positionen – uppdatera innehållet regelbundet och bevaka konkurrenter.";
  return "Bevaka utvecklingen.";
}

/* ---------------- Technical SEO ---------------- */

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type SeoIssue = {
  code: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  fix: string;
  url?: string;
};

export type PageAudit = {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  headings: { tag: string; text: string }[];
  wordCount: number;
  canonical: string | null;
  robots: string | null;
  inSitemap: boolean;
  internalLinksOut: string[];
  imagesTotal: number;
  imagesMissingAlt: number;
  structuredData: string[];
  htmlBytes: number;
  issues: SeoIssue[];
  healthScore: number;
  internalLinksIn?: number;
};

export function auditIssues(p: Omit<PageAudit, "issues" | "healthScore">): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const add = (code: string, severity: IssueSeverity, title: string, detail: string, fix: string) =>
    issues.push({ code, severity, title, detail, fix, url: p.url });

  if (p.statusCode && p.statusCode >= 400)
    add("http_error", "critical", `HTTP ${p.statusCode}`, "Sidan svarar med felkod.", "Åtgärda serverfelet eller ta bort/redirecta länkarna till sidan.");
  if (!p.title) add("missing_title", "critical", "Saknar title", "Sidan har ingen <title>.", "Lägg till en unik title på 30–60 tecken med primärt sökord.");
  else if (p.title.length < 30) add("short_title", "medium", "Kort title", `${p.title.length} tecken.`, "Utöka till 30–60 tecken och inkludera sökord + ort.");
  else if (p.title.length > 60) add("long_title", "medium", "Lång title", `${p.title.length} tecken – klipps i Google.`, "Korta till max 60 tecken.");

  if (!p.metaDescription) add("missing_meta", "high", "Saknar meta description", "Google skriver då egen text.", "Skriv en säljande beskrivning på 120–158 tecken.");
  else if (p.metaDescription.length < 80) add("short_meta", "low", "Kort meta description", `${p.metaDescription.length} tecken.`, "Utöka till 120–158 tecken.");
  else if (p.metaDescription.length > 165) add("long_meta", "low", "Lång meta description", `${p.metaDescription.length} tecken.`, "Korta till max 158 tecken.");

  if (p.h1.length === 0) add("missing_h1", "high", "Saknar H1", "Sidan har ingen H1-rubrik.", "Lägg till exakt en H1 som beskriver sidans huvudämne.");
  if (p.h1.length > 1) add("multiple_h1", "medium", "Flera H1", `${p.h1.length} H1-rubriker.`, "Behåll en H1 och gör övriga till H2.");

  if (p.wordCount < 300 && (p.statusCode ?? 200) < 400)
    add("thin_content", "high", "Tunt innehåll", `${p.wordCount} ord.`, "Utöka till minst 600 relevanta ord med tjänst, process, ort och FAQ.");

  if (!p.canonical) add("missing_canonical", "medium", "Saknar canonical", "Ingen kanonisk URL angiven.", "Lägg till self-referencing canonical.");
  if (p.robots && /noindex/i.test(p.robots))
    add("noindex", "critical", "Noindex", "Sidan är blockerad från indexering.", "Ta bort noindex om sidan ska ranka.");
  if (!p.inSitemap && (p.statusCode ?? 200) < 400)
    add("not_in_sitemap", "medium", "Saknas i sitemap", "Sidan finns inte i sitemap.xml.", "Lägg till URL:en i sitemap.xml.");
  if (p.imagesMissingAlt > 0)
    add("missing_alt", "low", "Bilder utan alt-text", `${p.imagesMissingAlt} av ${p.imagesTotal} bilder saknar alt.`, "Beskriv bilden med sökordsrelevant alt-text.");
  if (p.structuredData.length === 0)
    add("no_schema", "medium", "Saknar strukturerad data", "Ingen JSON-LD hittades.", "Lägg till LocalBusiness/Service-schema samt FAQ där det passar.");
  if (p.htmlBytes > 400_000)
    add("heavy_html", "low", "Stor HTML", `${Math.round(p.htmlBytes / 1024)} kB.`, "Minska sidstorleken – lazy-loada bilder och dela upp innehåll.");
  if (p.internalLinksOut.length < 3 && (p.statusCode ?? 200) < 400)
    add("few_internal_links", "medium", "Få interna länkar ut", `${p.internalLinksOut.length} interna länkar.`, "Länka till relaterade tjänst- och ortsidor.");

  return issues;
}

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = { critical: 30, high: 15, medium: 7, low: 3 };

export function healthScore(issues: SeoIssue[]): number {
  const penalty = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function severityRank(s: IssueSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s];
}

/* ---------------- Diverse ---------------- */

export function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
