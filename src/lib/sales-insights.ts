import type { Lead } from "@/lib/types";
import { LOST_REASON_LABELS } from "@/lib/types";
import { netValue } from "@/lib/commission";
import { areaStats } from "@/lib/geo-analytics";
import { sourceRoi, type SourceCosts } from "@/lib/source-roi";
import { staleDeals, todaysActions } from "@/lib/sales-actions";
import { kr } from "@/lib/format";

export type InsightTone = "positive" | "warning" | "critical" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  metric?: string;
}

const pct = (n: number) => `${n.toFixed(0)} %`;


/**
 * Regelbaserad insiktsmotor – hittar mönster i pipeline, källor, geografi
 * och förlustorsaker och formulerar konkreta rekommendationer.
 */
export function salesInsights(leads: Lead[], costs: SourceCosts = {}, now = new Date()): Insight[] {
  const out: Insight[] = [];
  if (leads.length === 0) return out;

  // 1. Dagens viktigaste aktiviteter
  const actions = todaysActions(leads, now);
  const high = actions.filter((a) => a.priority === "hog");
  if (high.length > 0) {
    out.push({
      id: "today-high",
      tone: "critical",
      title: `Ring dessa ${Math.min(5, high.length)} först`,
      body: high
        .slice(0, 5)
        .map((a) => `${a.lead.name}${a.value > 0 ? ` (${kr(a.value)})` : ""}`)
        .join(" · "),
      metric: `${high.length} högprio`,
    });
  }

  // 2. Pipeline i riskzonen
  const stale = staleDeals(leads, now);
  const atRisk = stale.reduce((s, d) => s + d.value, 0);
  if (stale.length > 0) {
    out.push({
      id: "stale",
      tone: atRisk > 500_000 ? "critical" : "warning",
      title: `${stale.length} affärer har tappat fart`,
      body: `${kr(atRisk)} i pipeline utan aktivitet. Störst risk: ${stale
        .slice(0, 3)
        .map((d) => d.lead.name)
        .join(", ")}.`,
      metric: kr(atRisk),
    });
  }

  // 3. Bästa och sämsta leadkälla
  const roi = sourceRoi(leads, costs).filter((r) => r.leads >= 3);
  if (roi.length >= 2) {
    const best = [...roi].sort((a, b) => b.winRate - a.winRate)[0]!;
    const worst = [...roi].sort((a, b) => a.winRate - b.winRate)[0]!;
    out.push({
      id: "source-best",
      tone: "positive",
      title: `${best.source} konverterar bäst`,
      body: `${pct(best.winRate)} vinstgrad och ${kr(best.avgOrder)} i snittorder. Lägg mer tid här.`,
      metric: pct(best.winRate),
    });
    if (worst.winRate < best.winRate / 2) {
      out.push({
        id: "source-worst",
        tone: "warning",
        title: `${worst.source} presterar svagt`,
        body: `Bara ${pct(worst.winRate)} vinstgrad på ${worst.leads} leads. Se över kvalificering eller pausa källan.`,
        metric: pct(worst.winRate),
      });
    }
  }

  // 4. Geografi
  const areas = areaStats(leads).filter((a) => a.area !== "Okänt område" && a.won + a.lost >= 3);
  if (areas.length > 0) {
    const top = [...areas].sort((a, b) => b.revenue - a.revenue)[0]!;
    out.push({
      id: "geo-top",
      tone: "positive",
      title: `${top.area} är din starkaste marknad`,
      body: `${kr(top.revenue)} omsatt på ${top.won} affärer, ${pct(top.winRate)} vinstgrad. Snittorder ${kr(top.avgOrder)}.`,
      metric: kr(top.revenue),
    });
  }

  // 5. Förlustmönster
  const lost = leads.filter((l) => l.pipelineStage === "forlorad" || l.status === "lost");
  if (lost.length >= 3) {
    const byReason = new Map<string, number>();
    for (const l of lost) {
      const key = l.lostReason ? LOST_REASON_LABELS[l.lostReason] : "Okänd orsak";
      byReason.set(key, (byReason.get(key) ?? 0) + 1);
    }
    const top = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0]!;
    out.push({
      id: "lost-reason",
      tone: "warning",
      title: `Vanligaste förlustorsaken: ${top[0]}`,
      body: `${top[1]} av ${lost.length} förlorade affärer (${pct((top[1] / lost.length) * 100)}). Adressera detta i pitchen.`,
      metric: pct((top[1] / lost.length) * 100),
    });

    // Stora affärer tappas oftare?
    const bigLost = lost.filter((l) => netValue(l) > 300_000).length;
    const bigWon = leads.filter((l) => l.pipelineStage === "slutford" && netValue(l) > 300_000).length;
    if (bigLost + bigWon >= 3 && bigLost > bigWon) {
      out.push({
        id: "big-deals",
        tone: "critical",
        title: "Du tappar oftare de stora affärerna",
        body: `${bigLost} förlorade mot ${bigWon} vunna över 300 tkr. Ta in referenser eller delbetalning tidigare i dialogen.`,
      });
    }
  }

  // 6. Offertsvar som dröjer
  const awaiting = leads.filter((l) => l.pipelineStage === "offert_skickad");
  if (awaiting.length >= 3) {
    out.push({
      id: "offers-open",
      tone: "neutral",
      title: `${awaiting.length} offerter väntar på svar`,
      body: `Totalt ${kr(awaiting.reduce((s, l) => s + netValue(l), 0))}. Följ upp senast dag 2 och dag 5 efter utskick.`,
      metric: kr(awaiting.reduce((s, l) => s + netValue(l), 0)),
    });
  }

  return out;
}
