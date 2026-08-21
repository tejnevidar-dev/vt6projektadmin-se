import { useMemo, useState } from "react";
import { AlertTriangle, Skull, Swords, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LeadDetail } from "@/components/LeadDetail";
import { kr, netValue } from "@/lib/commission";
import { lostInsights } from "@/lib/lost-deals";
import { isWon } from "@/lib/sales-command-center";
import { LOST_REASON_LABELS, type Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  leads: Lead[];
  onUpdated?: () => void;
}

export function LostDealsTab({ leads, onUpdated }: Props) {
  const [selected, setSelected] = useState<Lead | null>(null);
  const won = useMemo(() => leads.filter(isWon).length, [leads]);
  const insights = useMemo(() => lostInsights(leads, won), [leads, won]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Skull} label="Förlorade affärer" value={String(insights.lostDeals.length)} />
        <Stat icon={TrendingDown} label="Förlorat värde" value={kr(insights.lostValue)} />
        <Stat icon={AlertTriangle} label="Förlustgrad" value={`${insights.lossRate.toFixed(0)} %`} />
        <Stat icon={Swords} label="Utan angiven orsak" value={String(insights.missingReason)} tone={insights.missingReason > 0 ? "warning" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Varför tappar vi affärer?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.breakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Inga förlorade affärer registrerade.</p>
            ) : (
              insights.breakdown.map((b) => (
                <div key={b.reason}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className={cn(b.reason === "okand" && "text-muted-foreground")}>{b.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {b.count} st · {kr(b.value)} · {b.share.toFixed(0)} %
                    </span>
                  </div>
                  <Progress value={b.share} className="mt-1.5 h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Konkurrenter som vinner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.competitors.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ingen konkurrent angiven ännu. Fyll i konkurrent på förlorade affärer för att bygga statistik.
              </p>
            ) : (
              insights.competitors.map((c) => (
                <div key={c.competitor} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.competitor}</div>
                    {c.topArea && <div className="truncate text-xs text-muted-foreground">Starkast i {c.topArea}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{c.count} affärer</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{kr(c.value)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Förlorade affärer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {insights.lostDeals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Inga förlorade affärer.</p>
          ) : (
            insights.lostDeals.slice(0, 30).map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{l.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.municipality || l.region || "–"}
                    {l.lostCompetitor ? ` · förlorad till ${l.lostCompetitor}` : ""}
                    {l.lostAt ? ` · ${new Date(l.lostAt).toLocaleDateString("sv-SE")}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{kr(netValue(l))}</span>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[10px]", !l.lostReason && "border-warning/40 text-warning-foreground")}
                >
                  {l.lostReason ? LOST_REASON_LABELS[l.lostReason] : "Orsak saknas"}
                </Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selected && (
        <LeadDetail lead={selected} onClose={() => setSelected(null)} onUpdated={() => onUpdated?.()} />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Skull;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
