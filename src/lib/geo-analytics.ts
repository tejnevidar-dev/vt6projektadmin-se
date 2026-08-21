import type { Lead } from "@/lib/types";
import { netValue } from "@/lib/commission";

export interface AreaStats {
  area: string;
  leads: number;
  won: number;
  lost: number;
  revenue: number;
  pipeline: number;
  winRate: number;
  avgOrder: number;
}

/** Statistik per kommun (eller region). */
export function areaStats(leads: Lead[], key: "municipality" | "region" = "municipality"): AreaStats[] {
  const map = new Map<string, Lead[]>();
  for (const l of leads) {
    const area = (l[key] || "").trim() || "Okänt område";
    const arr = map.get(area) ?? [];
    arr.push(l);
    map.set(area, arr);
  }

  return [...map.entries()]
    .map(([area, rows]) => {
      const won = rows.filter((l) => l.pipelineStage === "slutford");
      const lost = rows.filter((l) => l.pipelineStage === "forlorad" || l.status === "lost");
      const open = rows.filter(
        (l) => l.pipelineStage !== "slutford" && l.pipelineStage !== "forlorad" && (l.price ?? 0) > 0,
      );
      const revenue = Math.round(won.reduce((s, l) => s + netValue(l), 0));
      const decided = won.length + lost.length;
      return {
        area,
        leads: rows.length,
        won: won.length,
        lost: lost.length,
        revenue,
        pipeline: Math.round(open.reduce((s, l) => s + netValue(l), 0)),
        winRate: decided ? (won.length / decided) * 100 : 0,
        avgOrder: won.length ? Math.round(revenue / won.length) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
}
