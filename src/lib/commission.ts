import type { Lead } from "@/lib/types";
import type { Saljare } from "@/lib/saljare-api";

export const VAT_RATE = 0.25;

/** Ordervärde exkl. moms för en affär. */
export function netValue(lead: Lead): number {
  return (lead.price ?? 0) / (1 + VAT_RATE);
}

/** Provisionssats i procent: avvikande sats på affären, annars säljarens sats. */
export function commissionRateFor(lead: Lead, seller?: Saljare | null): number {
  if (lead.commissionRate != null) return lead.commissionRate;
  return seller?.provision_rate ?? 0;
}

/** Provisionsbelopp för en affär (ordervärde exkl. moms × sats). */
export function commissionFor(lead: Lead, seller?: Saljare | null): number {
  return Math.round(netValue(lead) * (commissionRateFor(lead, seller) / 100));
}

export type PeriodKey = "week" | "month" | "quarter" | "year" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  week: "Denna vecka",
  month: "Denna månad",
  quarter: "Detta kvartal",
  year: "I år",
  all: "Allt",
};

/** Startdatum för vald period (måndag som veckostart). */
export function periodStart(period: PeriodKey, now = new Date()): Date | null {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  switch (period) {
    case "week": {
      const day = (d.getDay() + 6) % 7; // måndag = 0
      d.setDate(d.getDate() - day);
      return d;
    }
    case "month":
      d.setDate(1);
      return d;
    case "quarter":
      d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
      return d;
    case "year":
      d.setMonth(0, 1);
      return d;
    default:
      return null;
  }
}

/** Datum som styr vilken period affären hamnar i (slutförandedatum). */
export function commissionDate(lead: Lead): Date | null {
  const raw = lead.completedAt ?? null;
  return raw ? new Date(raw) : null;
}

export function isInPeriod(lead: Lead, period: PeriodKey, now = new Date()): boolean {
  const start = periodStart(period, now);
  if (!start) return true;
  const d = commissionDate(lead);
  return !!d && d >= start;
}

export interface CommissionSummary {
  deals: number;
  revenueNet: number;
  commission: number;
  pipelineDeals: number;
  pipelineCommission: number;
}

/** Sammanställer provision för en säljares affärer under en period. */
export function summarize(
  leads: Lead[],
  seller: Saljare | null | undefined,
  period: PeriodKey,
  now = new Date(),
): CommissionSummary {
  const completed = leads.filter((l) => l.pipelineStage === "slutford" && isInPeriod(l, period, now));
  const pipeline = leads.filter((l) => l.pipelineStage !== "slutford" && (l.price ?? 0) > 0);
  return {
    deals: completed.length,
    revenueNet: Math.round(completed.reduce((s, l) => s + netValue(l), 0)),
    commission: completed.reduce((s, l) => s + commissionFor(l, seller), 0),
    pipelineDeals: pipeline.length,
    pipelineCommission: pipeline.reduce((s, l) => s + commissionFor(l, seller), 0),
  };
}

/** Grupperar slutförda affärer per månad (YYYY-MM) för trendvisning. */
export function byMonth(
  leads: Lead[],
  seller: Saljare | null | undefined,
): { month: string; commission: number; deals: number }[] {
  const map = new Map<string, { commission: number; deals: number }>();
  for (const l of leads) {
    if (l.pipelineStage !== "slutford") continue;
    const d = commissionDate(l);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = map.get(key) ?? { commission: 0, deals: 0 };
    cur.commission += commissionFor(l, seller);
    cur.deals += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .slice(0, 12);
}

export const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;
