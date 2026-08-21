import type { Lead, PipelineStage } from "@/lib/types";
import { PIPELINE_STAGES, WON_STAGES } from "@/lib/types";
import { VAT_RATE, isSold, netValue, saleDate } from "@/lib/commission";
import { STAGE_PROBABILITY, type Range } from "@/lib/sales-analytics";

const dateOf = (v: string | null | undefined) => (v ? new Date(v) : null);

const stageIndex = (s: PipelineStage) => PIPELINE_STAGES.indexOf(s);

export const isWon = (l: Lead) => isSold(l) || WON_STAGES.includes(l.pipelineStage);
export const isLost = (l: Lead) => l.pipelineStage === "forlorad" || l.status === "lost";
export const isOpen = (l: Lead) => !isWon(l) && !isLost(l);

/** Har leadet minst nått ett givet steg (vunna räknas som passerade alla säljsteg)? */
export function reached(l: Lead, stage: PipelineStage): boolean {
  if (isWon(l)) return true;
  if (isLost(l)) return false;
  return stageIndex(l.pipelineStage) >= stageIndex(stage);
}

function inRange(d: Date | null, r: Range): boolean {
  if (!d) return false;
  if (r.start && d < r.start) return false;
  return d < r.end;
}

export interface PeriodBucket {
  label: string;
  net: number;
  gross: number;
  deals: number;
  /** Affärerna som ingår i perioden (för drill-down). */
  rows: Lead[];
}

/** Försäljning idag / vecka / månad / kvartal / år (baserat på slutförandedatum). */
export function salesBuckets(leads: Lead[], now = new Date()): PeriodBucket[] {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfDay.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const defs: { label: string; start: Date }[] = [
    { label: "Idag", start: startOfDay },
    { label: "Denna vecka", start: startOfWeek },
    { label: "Denna månad", start: startOfMonth },
    { label: "Detta kvartal", start: startOfQuarter },
    { label: "I år", start: startOfYear },
  ];

  const won = leads.filter(isSold);
  return defs.map(({ label, start }) => {
    const rows = won.filter((l) => {
      const d = saleDate(l);
      return !!d && d >= start && d <= now;
    });
    const net = rows.reduce((s, l) => s + netValue(l), 0);
    const sorted = [...rows].sort((a, b) => (saleDate(b)?.getTime() ?? 0) - (saleDate(a)?.getTime() ?? 0));
    return { label, net: Math.round(net), gross: Math.round(net * (1 + VAT_RATE)), deals: rows.length, rows: sorted };
  });
}

export interface CommandCenterMetrics {
  /** Slutförda affärer i perioden. */
  deals: number;
  revenueNet: number;
  revenueGross: number;
  avgOrderValue: number;
  newLeads: number;
  bookedMeetings: number;
  offersSent: number;
  offersAccepted: number;
  lostDeals: number;
  openPipelineDeals: number;
  openPipelineValue: number;
  weightedPipeline: number;
  winRate: number;
  leadToMeeting: number;
  meetingToOffer: number;
  offerToDeal: number;
  avgCycleDays: number | null;
  /** Prognos = realiserat i perioden + viktad öppen pipeline. */
  forecast: number;
  /** Sales velocity: (öppna affärer × snittorder × win rate) / säljcykel. */
  salesVelocity: number | null;
}

export function commandCenter(leads: Lead[], range: Range): CommandCenterMetrics {
  const completed = leads.filter((l) => isSold(l) && inRange(saleDate(l), range));
  const created = leads.filter((l) => inRange(dateOf(l.createdAt), range));
  const open = leads.filter(isOpen);

  const revenueNet = completed.reduce((s, l) => s + netValue(l), 0);
  const openValue = open.reduce((s, l) => s + netValue(l), 0);
  const weighted = open.reduce((s, l) => s + netValue(l) * (STAGE_PROBABILITY[l.pipelineStage] ?? 0.3), 0);

  const meetings = created.filter((l) => reached(l, "mote_bokat")).length;
  const offers = created.filter((l) => reached(l, "offert_skickad")).length;
  const won = created.filter(isWon).length;
  const lost = created.filter(isLost).length;

  const cycles = completed
    .map((l) => {
      const a = dateOf(l.createdAt);
      const b = saleDate(l);
      return a && b ? (b.getTime() - a.getTime()) / 86400000 : null;
    })
    .filter((n): n is number => n != null && n >= 0);
  const avgCycleDays = cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null;

  const decided = won + lost;
  const winRate = decided ? (won / decided) * 100 : 0;
  const avgOrderValue = completed.length ? revenueNet / completed.length : 0;

  return {
    deals: completed.length,
    revenueNet: Math.round(revenueNet),
    revenueGross: Math.round(revenueNet * (1 + VAT_RATE)),
    avgOrderValue: Math.round(avgOrderValue),
    newLeads: created.length,
    bookedMeetings: meetings,
    offersSent: offers,
    offersAccepted: won,
    lostDeals: lost,
    openPipelineDeals: open.length,
    openPipelineValue: Math.round(openValue),
    weightedPipeline: Math.round(weighted),
    winRate,
    leadToMeeting: created.length ? (meetings / created.length) * 100 : 0,
    meetingToOffer: meetings ? (offers / meetings) * 100 : 0,
    offerToDeal: offers ? (won / offers) * 100 : 0,
    avgCycleDays,
    forecast: Math.round(revenueNet + weighted),
    salesVelocity:
      avgCycleDays && avgCycleDays > 0
        ? Math.round((open.length * (avgOrderValue || 0) * (winRate / 100)) / avgCycleDays)
        : null,
  };
}

export interface FunnelRow {
  label: string;
  count: number;
  value: number;
  /** Konvertering från föregående steg i procent. */
  conversion: number | null;
}

/** Konverteringstratt baserad på leads skapade i perioden. */
export function conversionFunnel(leads: Lead[], range: Range): FunnelRow[] {
  const cohort = leads.filter((l) => inRange(dateOf(l.createdAt), range));
  const steps: { label: string; rows: Lead[] }[] = [
    { label: "Leads", rows: cohort },
    { label: "Kontaktade", rows: cohort.filter((l) => reached(l, "kontaktad")) },
    { label: "Möten bokade", rows: cohort.filter((l) => reached(l, "mote_bokat")) },
    { label: "Möten genomförda", rows: cohort.filter((l) => reached(l, "mote_genomfort")) },
    { label: "Offerter skickade", rows: cohort.filter((l) => reached(l, "offert_skickad")) },
    { label: "Vunna", rows: cohort.filter(isWon) },
  ];
  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].rows.length : null;
    return {
      label: s.label,
      count: s.rows.length,
      value: Math.round(s.rows.reduce((a, l) => a + netValue(l), 0)),
      conversion: prev != null ? (prev ? (s.rows.length / prev) * 100 : 0) : null,
    };
  });
}

export type CompareMode = "week" | "month" | "year";

export const COMPARE_LABELS: Record<CompareMode, string> = {
  week: "Föregående vecka",
  month: "Föregående månad",
  year: "Föregående år",
};

/** Tidsserie över försäljning per vecka/månad/år för jämförelsegrafer. */
export function salesSeries(
  leads: Lead[],
  mode: CompareMode,
  now = new Date(),
): { label: string; current: number; previous: number }[] {
  const won = leads.filter((l) => isSold(l) && saleDate(l));
  const bucket = (d: Date) => {
    if (mode === "week") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (mode === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const sumIn = (from: Date, to: Date) => {
    const map = new Map<string, number>();
    for (const l of won) {
      const d = saleDate(l) as Date;
      if (d < from || d >= to) continue;
      const k = bucket(d);
      map.set(k, (map.get(k) ?? 0) + netValue(l));
    }
    return map;
  };

  if (mode === "year") {
    const out: { label: string; current: number; previous: number }[] = [];
    const cur = sumIn(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1));
    const prev = sumIn(new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear(), 0, 1));
    for (let m = 0; m < 12; m++) {
      const mm = String(m + 1).padStart(2, "0");
      out.push({
        label: new Date(now.getFullYear(), m, 1).toLocaleDateString("sv-SE", { month: "short" }),
        current: Math.round(cur.get(`${now.getFullYear()}-${mm}`) ?? 0),
        previous: Math.round(prev.get(`${now.getFullYear() - 1}-${mm}`) ?? 0),
      });
    }
    return out;
  }

  const days = mode === "week" ? 7 : 31;
  const startCur = new Date(now);
  startCur.setHours(0, 0, 0, 0);
  if (mode === "week") startCur.setDate(startCur.getDate() - ((now.getDay() + 6) % 7));
  else startCur.setDate(1);

  const startPrev = new Date(startCur);
  if (mode === "week") startPrev.setDate(startPrev.getDate() - 7);
  else startPrev.setMonth(startPrev.getMonth() - 1);

  const cur = sumIn(startCur, new Date(startCur.getTime() + days * 86400000));
  const prev = sumIn(startPrev, startCur);

  const out: { label: string; current: number; previous: number }[] = [];
  for (let i = 0; i < days; i++) {
    const dc = new Date(startCur.getTime() + i * 86400000);
    const dp = new Date(startPrev);
    dp.setDate(dp.getDate() + i);
    if (mode === "month" && dc.getMonth() !== startCur.getMonth()) break;
    out.push({
      label: mode === "week" ? dc.toLocaleDateString("sv-SE", { weekday: "short" }) : String(dc.getDate()),
      current: Math.round(cur.get(bucket(dc)) ?? 0),
      previous: Math.round(prev.get(bucket(dp)) ?? 0),
    });
  }
  return out;
}

const GOAL_KEY = "vt6.sales.monthly-goal";

export function readMonthlyGoal(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(GOAL_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function writeMonthlyGoal(value: number) {
  if (typeof window === "undefined") return;
  if (value > 0) window.localStorage.setItem(GOAL_KEY, String(Math.round(value)));
  else window.localStorage.removeItem(GOAL_KEY);
}
