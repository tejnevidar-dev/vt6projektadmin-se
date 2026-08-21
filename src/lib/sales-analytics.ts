import type { Lead, PipelineStage, LeadSource, JobType } from "@/lib/types";
import type { Saljare } from "@/lib/saljare-api";
import { commissionFor, commissionRateFor, isInboundLead, netValue, periodStart, type PeriodKey } from "@/lib/commission";

export interface Range {
  start: Date | null;
  end: Date;
}

/** Aktuell period samt föregående lika lång period (för jämförelse). */
export function periodRanges(period: PeriodKey, now = new Date()): { current: Range; previous: Range | null } {
  const start = periodStart(period, now);
  if (!start) return { current: { start: null, end: now }, previous: null };
  const length = now.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - length);
  return {
    current: { start, end: now },
    previous: { start: prevStart, end: start },
  };
}

function inRange(date: Date | null, range: Range): boolean {
  if (!date) return false;
  if (range.start && date < range.start) return false;
  return date < range.end || range.start === null;
}

export function leadsOf(leads: Lead[], sellerId: string): Lead[] {
  return leads.filter((l) => (l.sellerId ?? l.createdBy) === sellerId);
}

const dateOf = (v: string | null | undefined) => (v ? new Date(v) : null);

export interface SellerStats {
  deals: number;
  revenueNet: number;
  commission: number;
  avgDeal: number;
  /** Antal leads som säljaren jobbat med (skapade i perioden). */
  leads: number;
  /** Andel slutförda av alla tilldelade leads. */
  winRate: number;
  /** Snittid från lead skapad till slutförd (dagar). */
  avgCycleDays: number | null;
  /** Snittprovision per affär. */
  avgCommission: number;
  ownDeals: number;
  inboundDeals: number;
  ownCommission: number;
  inboundCommission: number;
  pipelineDeals: number;
  pipelineValue: number;
  pipelineCommission: number;
  /** Vägd prognos utifrån stegsannolikhet. */
  weightedForecast: number;
  bookedDeals: number;
}

/** Grov sannolikhet att en affär i respektive steg går i mål. */
export const STAGE_PROBABILITY: Record<PipelineStage, number> = {
  inkommande_webb: 0.1,
  saljpanel: 0.15,
  kontaktad: 0.25,
  mote_bokat: 0.35,
  mote_genomfort: 0.45,
  offererad: 0.5,
  offert_skickad: 0.6,
  uppfoljning: 0.65,
  forhandling: 0.8,
  bokad: 0.95,
  pagaende: 0.98,
  slutford: 1,
  forlorad: 0,
};

export function statsFor(leads: Lead[], seller: Saljare | null | undefined, range: Range): SellerStats {
  const completed = leads.filter((l) => l.pipelineStage === "slutford" && inRange(dateOf(l.completedAt), range));
  const created = leads.filter((l) => inRange(dateOf(l.createdAt), range));
  const open = leads.filter((l) => l.pipelineStage !== "slutford" && (l.price ?? 0) > 0);

  const revenueNet = completed.reduce((s, l) => s + netValue(l), 0);
  const commission = completed.reduce((s, l) => s + commissionFor(l, seller), 0);

  const cycles = completed
    .map((l) => {
      const a = dateOf(l.createdAt);
      const b = dateOf(l.completedAt);
      return a && b ? (b.getTime() - a.getTime()) / 86400000 : null;
    })
    .filter((n): n is number => n != null && n >= 0);

  const own = completed.filter((l) => !isInboundLead(l));
  const inbound = completed.filter((l) => isInboundLead(l));

  return {
    deals: completed.length,
    revenueNet: Math.round(revenueNet),
    commission: Math.round(commission),
    avgDeal: completed.length ? Math.round(revenueNet / completed.length) : 0,
    leads: created.length,
    winRate: created.length ? (created.filter((l) => l.pipelineStage === "slutford").length / created.length) * 100 : 0,
    avgCycleDays: cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null,
    avgCommission: completed.length ? Math.round(commission / completed.length) : 0,
    ownDeals: own.length,
    inboundDeals: inbound.length,
    ownCommission: Math.round(own.reduce((s, l) => s + commissionFor(l, seller), 0)),
    inboundCommission: Math.round(inbound.reduce((s, l) => s + commissionFor(l, seller), 0)),
    pipelineDeals: open.length,
    pipelineValue: Math.round(open.reduce((s, l) => s + netValue(l), 0)),
    pipelineCommission: Math.round(open.reduce((s, l) => s + commissionFor(l, seller), 0)),
    weightedForecast: Math.round(
      open.reduce((s, l) => s + commissionFor(l, seller) * (STAGE_PROBABILITY[l.pipelineStage] ?? 0.3), 0),
    ),
    bookedDeals: leads.filter((l) => l.pipelineStage === "bokad").length,
  };
}

/** Procentuell förändring mellan två värden (null när jämförelse saknas). */
export function delta(current: number, previous: number | null): number | null {
  if (previous == null) return null;
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export interface FunnelStep {
  stage: PipelineStage;
  count: number;
  value: number;
}

export function funnel(leads: Lead[], stages: PipelineStage[]): FunnelStep[] {
  return stages.map((stage) => {
    const rows = leads.filter((l) => l.pipelineStage === stage);
    return { stage, count: rows.length, value: Math.round(rows.reduce((s, l) => s + netValue(l), 0)) };
  });
}

export function groupBy<K extends string>(
  leads: Lead[],
  key: (l: Lead) => K,
  seller?: Saljare | null,
): { key: K; deals: number; revenueNet: number; commission: number }[] {
  const map = new Map<K, { deals: number; revenueNet: number; commission: number }>();
  for (const l of leads) {
    const k = key(l);
    const cur = map.get(k) ?? { deals: 0, revenueNet: 0, commission: 0 };
    cur.deals += 1;
    cur.revenueNet += netValue(l);
    cur.commission += commissionFor(l, seller);
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([k, v]) => ({ key: k, deals: v.deals, revenueNet: Math.round(v.revenueNet), commission: Math.round(v.commission) }))
    .sort((a, b) => b.revenueNet - a.revenueNet);
}

export const sourceOf = (l: Lead): LeadSource => l.source;
export const jobTypeOf = (l: Lead): JobType => l.jobType;

/** Tidsserie per dag/vecka/månad över slutförda affärer. */
export function timeSeries(
  leads: Lead[],
  seller: Saljare | null | undefined,
  months = 12,
): { label: string; commission: number; revenueNet: number; deals: number }[] {
  const out: { label: string; commission: number; revenueNet: number; deals: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const rows = leads.filter((l) => {
      if (l.pipelineStage !== "slutford") return false;
      const c = dateOf(l.completedAt);
      return !!c && c >= d && c < next;
    });
    out.push({
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      deals: rows.length,
      revenueNet: Math.round(rows.reduce((s, l) => s + netValue(l), 0)),
      commission: Math.round(rows.reduce((s, l) => s + commissionFor(l, seller), 0)),
    });
  }
  return out;
}

export { commissionRateFor };
