import type { IssueSeverity, KeywordRow, PageAudit, SearchIntent, SeoIssue, SeoPeriodKey } from "./analysis";

export type { KeywordRow, PageAudit, SeoIssue, IssueSeverity, SearchIntent, SeoPeriodKey };

export type DataSource = {
  id: string;
  name: string;
  connected: boolean;
  detail: string;
  required: string[];
};

export type PsiScores = {
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

export type Totals = { clicks: number; impressions: number; ctr: number; position: number };

export type SeriesPoint = { date: string; clicks: number; impressions: number; ctr: number; position: number };

export type IndexStatus = {
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

export type OverviewResponse = {
  siteUrl: string;
  period: SeoPeriodKey;
  rangeStart: string;
  rangeEnd: string;
  totals: Totals;
  previousTotals: Totals | null;
  series: SeriesPoint[];
  weekly: SeriesPoint[];
  devices: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
  countries: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
  keywordBuckets: { top3: number; pos4_10: number; pos11_20: number; pos21_50: number; total: number };
  keywordMovement: { improved: number; declined: number; added: number; lost: number };
  index: IndexStatus;
  analytics: { connected: boolean; reason?: string; users?: number; sessions?: number; conversions?: number };
  pagespeed: { connected: boolean; reason?: string; mobile?: PsiScores; desktop?: PsiScores };
  alerts: SeoAlert[];
  fetchedAt: string;
};

export type SeoAlert = {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  url?: string;
  keyword?: string;
};

export type KeywordsResponse = {
  period: SeoPeriodKey;
  rangeStart: string;
  rangeEnd: string;
  rows: KeywordRow[];
  lost: { keyword: string; previousPosition: number; previousClicks: number; previousImpressions: number }[];
  fetchedAt: string;
};

export type OpportunityItem = {
  id: string;
  score: number;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  why: string;
  keywords: string[];
  url: string | null;
  currentData: string;
  expectedEffect: string;
  action: string;
  difficulty: number;
  impact: number;
};

export type TechnicalResponse = {
  crawledAt: string;
  origin: string;
  pagesCrawled: number;
  robots: { ok: boolean; status: number; blocksAll: boolean; sitemaps: string[]; error?: string };
  sitemapUrls: number;
  sitemapError: string | null;
  issues: (SeoIssue & { pages: number })[];
  issuesBySeverity: Record<IssueSeverity, number>;
  duplicateTitles: { value: string; urls: string[] }[];
  duplicateDescriptions: { value: string; urls: string[] }[];
  orphanPages: string[];
  pages: PageAudit[];
};

export type LocalTarget = {
  id: string;
  service: string;
  locality: string;
  landing_url: string | null;
  active: boolean;
};

export type LocalReportRow = {
  service: string;
  locality: string;
  landingUrl: string | null;
  hasPage: boolean;
  keywords: number;
  clicks: number;
  impressions: number;
  position: number | null;
  status: "stark" | "svag" | "saknas" | "obevakad";
  recommendation: string;
  cannibalization: string[];
};

export type ContentGap = {
  id: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  intent: SearchIntent;
  impressions: number;
  position: number | null;
  recommendedUrl: string;
  recommendedTitle: string;
  recommendedH1: string;
  outline: string[];
  linkFrom: string[];
  reason: string;
};

export type LinkSuggestion = {
  from: string;
  to: string;
  anchor: string;
  reason: string;
};

export type SeoTask = {
  id: string;
  title: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  impact: number;
  difficulty: number;
  opportunity_score: number;
  affected_url: string | null;
  target_keyword: string | null;
  problem: string | null;
  recommendation: string | null;
  status: "todo" | "in_progress" | "done" | "ignored";
  source: string;
  source_key: string | null;
  baseline: Record<string, number> | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
