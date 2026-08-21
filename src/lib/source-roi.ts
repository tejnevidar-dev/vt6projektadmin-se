import type { Lead, LeadSource } from "@/lib/types";
import { netValue } from "@/lib/commission";

const COST_KEY = "vt6:source-costs";

/** Manuellt inlagd månadskostnad per leadkälla (kr). Ersätts av annonsintegration senare. */
export type SourceCosts = Partial<Record<LeadSource | string, number>>;

export function readSourceCosts(): SourceCosts {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(COST_KEY) ?? "{}") as SourceCosts;
  } catch {
    return {};
  }
}

export function writeSourceCosts(costs: SourceCosts) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COST_KEY, JSON.stringify(costs));
}

export interface SourceRoi {
  source: string;
  leads: number;
  won: number;
  lost: number;
  winRate: number;
  revenue: number;
  pipeline: number;
  avgOrder: number;
  cost: number;
  costPerLead: number | null;
  costPerDeal: number | null;
  roi: number | null;
  avgCycleDays: number | null;
}

export function sourceRoi(leads: Lead[], costs: SourceCosts): SourceRoi[] {
  const map = new Map<string, Lead[]>();
  for (const l of leads) {
    const arr = map.get(l.source) ?? [];
    arr.push(l);
    map.set(l.source, arr);
  }

  return [...map.entries()]
    .map(([source, rows]) => {
      const won = rows.filter((l) => l.pipelineStage === "slutford");
      const lost = rows.filter((l) => l.pipelineStage === "forlorad" || l.status === "lost");
      const open = rows.filter(
        (l) => l.pipelineStage !== "slutford" && l.pipelineStage !== "forlorad" && (l.price ?? 0) > 0,
      );
      const revenue = Math.round(won.reduce((s, l) => s + netValue(l), 0));
      const cost = Number(costs[source] ?? 0);
      const decided = won.length + lost.length;

      const cycles = won
        .map((l) =>
          l.completedAt && l.createdAt
            ? (new Date(l.completedAt).getTime() - new Date(l.createdAt).getTime()) / 86400000
            : null,
        )
        .filter((n): n is number => n != null && n >= 0);

      return {
        source,
        leads: rows.length,
        won: won.length,
        lost: lost.length,
        winRate: decided ? (won.length / decided) * 100 : 0,
        revenue,
        pipeline: Math.round(open.reduce((s, l) => s + netValue(l), 0)),
        avgOrder: won.length ? Math.round(revenue / won.length) : 0,
        cost,
        costPerLead: cost > 0 && rows.length ? Math.round(cost / rows.length) : null,
        costPerDeal: cost > 0 && won.length ? Math.round(cost / won.length) : null,
        roi: cost > 0 ? ((revenue - cost) / cost) * 100 : null,
        avgCycleDays: cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
}

/** Slår ihop manuellt inlagda kostnader med automatiskt hämtad annonskostnad (annons vinner). */
export function mergeSourceCosts(manual: SourceCosts, auto: Record<string, number>): SourceCosts {
  const out: SourceCosts = { ...manual };
  for (const [source, cost] of Object.entries(auto)) {
    if (cost > 0) out[source] = cost;
  }
  return out;
}
