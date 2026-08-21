import type { Lead, LostReason } from "@/lib/types";
import { LOST_REASON_LABELS } from "@/lib/types";
import { netValue } from "@/lib/commission";
import { isLost } from "@/lib/sales-command-center";

export interface LostBreakdown {
  reason: LostReason | "okand";
  label: string;
  count: number;
  value: number;
  share: number;
}

export interface CompetitorStat {
  competitor: string;
  count: number;
  value: number;
  /** Vanligaste kommunen där konkurrenten vinner. */
  topArea: string | null;
}

export interface LostInsights {
  lostDeals: Lead[];
  lostValue: number;
  breakdown: LostBreakdown[];
  competitors: CompetitorStat[];
  missingReason: number;
  /** Andel förlorade av alla avgjorda affärer (vunna + förlorade). */
  lossRate: number;
}

export function lostInsights(leads: Lead[], won: number): LostInsights {
  const lost = leads.filter(isLost);
  const lostValue = lost.reduce((s, l) => s + netValue(l), 0);

  const byReason = new Map<LostReason | "okand", { count: number; value: number }>();
  for (const l of lost) {
    const key = (l.lostReason ?? "okand") as LostReason | "okand";
    const cur = byReason.get(key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += netValue(l);
    byReason.set(key, cur);
  }

  const breakdown: LostBreakdown[] = Array.from(byReason.entries())
    .map(([reason, v]) => ({
      reason,
      label: reason === "okand" ? "Ingen orsak angiven" : LOST_REASON_LABELS[reason],
      count: v.count,
      value: Math.round(v.value),
      share: lost.length ? (v.count / lost.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byComp = new Map<string, { count: number; value: number; areas: Map<string, number> }>();
  for (const l of lost) {
    const name = (l.lostCompetitor ?? "").trim();
    if (!name) continue;
    const cur = byComp.get(name) ?? { count: 0, value: 0, areas: new Map<string, number>() };
    cur.count += 1;
    cur.value += netValue(l);
    const area = l.municipality || l.region;
    if (area) cur.areas.set(area, (cur.areas.get(area) ?? 0) + 1);
    byComp.set(name, cur);
  }

  const competitors: CompetitorStat[] = Array.from(byComp.entries())
    .map(([competitor, v]) => ({
      competitor,
      count: v.count,
      value: Math.round(v.value),
      topArea: Array.from(v.areas.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.count - a.count);

  const decided = won + lost.length;

  return {
    lostDeals: lost.sort((a, b) => netValue(b) - netValue(a)),
    lostValue: Math.round(lostValue),
    breakdown,
    competitors,
    missingReason: lost.filter((l) => !l.lostReason).length,
    lossRate: decided ? (lost.length / decided) * 100 : 0,
  };
}
