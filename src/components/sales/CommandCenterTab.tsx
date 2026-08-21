import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Percent,
  Target,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kr, netValue, saleDate } from "@/lib/commission";
import { delta, type Range } from "@/lib/sales-analytics";
import {
  COMPARE_LABELS,
  commandCenter,
  conversionFunnel,
  readMonthlyGoal,
  salesBuckets,
  salesSeries,
  writeMonthlyGoal,
  type CompareMode,
} from "@/lib/sales-command-center";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  leads: Lead[];
  current: Range;
  previous: Range | null;
  periodLabel: string;
}

const pct = (n: number) => `${n.toFixed(0)} %`;

export function CommandCenterTab({ leads, current, previous, periodLabel }: Props) {
  const [compare, setCompare] = useState<CompareMode>("month");
  const [goal, setGoal] = useState<number>(() => readMonthlyGoal());
  const [drill, setDrill] = useState<PeriodBucket | null>(null);

  const now = useMemo(() => new Date(), []);
  const buckets = useMemo(() => salesBuckets(leads, now), [leads, now]);
  const m = useMemo(() => commandCenter(leads, current), [leads, current]);
  const prev = useMemo(
    () => (previous ? commandCenter(leads, previous) : null),
    [leads, previous],
  );
  const funnelRows = useMemo(() => conversionFunnel(leads, current), [leads, current]);
  const series = useMemo(() => salesSeries(leads, compare, now), [leads, compare, now]);

  const monthNet = buckets.find((b) => b.label === "Denna månad")?.net ?? 0;
  const goalPct = goal > 0 ? Math.min(100, (monthNet / goal) * 100) : 0;
  const forecastPct = goal > 0 ? (m.forecast / goal) * 100 : 0;
  const maxFunnel = Math.max(1, ...funnelRows.map((f) => f.count));

  return (
    <div className="space-y-4">
      {/* Försäljning per tidsfönster */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {buckets.map((b) => (
          <Card
            key={b.label}
            role="button"
            tabIndex={0}
            onClick={() => b.deals > 0 && setDrill(b)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && b.deals > 0) {
                e.preventDefault();
                setDrill(b);
              }
            }}
            className={cn(
              "transition-colors",
              b.deals > 0 ? "cursor-pointer hover:border-primary/50 hover:bg-accent/40" : "opacity-80",
            )}
          >
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{b.label}</p>
              <p className="mt-1 text-xl font-semibold">{kr(b.net)}</p>
              <p className="text-xs text-muted-foreground">
                {kr(b.gross)} ink. moms · {b.deals} affärer
              </p>
              {b.deals > 0 && (
                <p className="mt-1 text-[11px] font-medium text-primary">Visa affärer</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {drill?.label} – {drill?.deals} affärer · {kr(drill?.net ?? 0)} exkl. moms
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {drill?.rows.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name || "Namnlös kund"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[l.address, l.city].filter(Boolean).join(", ") || "–"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Godkänd: {saleDate(l)?.toLocaleDateString("sv-SE") ?? "–"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{kr(netValue(l))}</p>
                  <p className="text-xs text-muted-foreground">{kr(l.price ?? 0)} ink. moms</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mål */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Månadens mål
            </span>
            <span className="flex items-center gap-2 text-sm font-normal">
              <span className="text-muted-foreground">Mål (kr exkl. moms)</span>
              <Input
                type="number"
                value={goal || ""}
                placeholder="1 500 000"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setGoal(v);
                  writeMonthlyGoal(v);
                }}
                className="h-8 w-36"
              />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">
              {kr(monthNet)} {goal > 0 && <span className="text-muted-foreground">/ {kr(goal)}</span>}
            </span>
            <span className="text-muted-foreground">
              {goal > 0 ? `${goalPct.toFixed(0)} % av mål · prognos ${forecastPct.toFixed(0)} %` : "Sätt ett mål för att se progress"}
            </span>
          </div>
          <Progress value={goalPct} className="h-2.5" />
        </CardContent>
      </Card>

      {/* KPI-grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Försäljning exkl. moms" value={kr(m.revenueNet)} sub={`${kr(m.revenueGross)} ink. moms`} change={prev ? delta(m.revenueNet, prev.revenueNet) : null} highlight />
        <Kpi icon={Users} label="Nya leads" value={String(m.newLeads)} change={prev ? delta(m.newLeads, prev.newLeads) : null} />
        <Kpi icon={CalendarCheck} label="Bokade kundmöten" value={String(m.bookedMeetings)} change={prev ? delta(m.bookedMeetings, prev.bookedMeetings) : null} />
        <Kpi icon={FileText} label="Skickade offerter" value={String(m.offersSent)} change={prev ? delta(m.offersSent, prev.offersSent) : null} />
        <Kpi icon={CheckCircle2} label="Accepterade offerter" value={String(m.offersAccepted)} change={prev ? delta(m.offersAccepted, prev.offersAccepted) : null} />
        <Kpi icon={XCircle} label="Förlorade affärer" value={String(m.lostDeals)} change={prev ? delta(m.lostDeals, prev.lostDeals) : null} />
        <Kpi icon={Gauge} label="Snittordervärde" value={kr(m.avgOrderValue)} change={prev ? delta(m.avgOrderValue, prev.avgOrderValue) : null} />
        <Kpi icon={Percent} label="Win rate" value={pct(m.winRate)} sub="Vunna av avgjorda" change={prev ? delta(m.winRate, prev.winRate) : null} />
        <Kpi icon={Target} label="Öppen pipeline" value={kr(m.openPipelineValue)} sub={`${m.openPipelineDeals} affärer`} />
        <Kpi icon={Zap} label="Viktad pipeline" value={kr(m.weightedPipeline)} sub="Sannolikhetsviktad" />
        <Kpi icon={Clock} label="Lead → affär" value={m.avgCycleDays != null ? `${m.avgCycleDays} dagar` : "–"} sub="Genomsnittlig säljcykel" />
        <Kpi icon={TrendingUp} label="Prognos" value={kr(m.forecast)} sub="Realiserat + viktad pipeline" highlight />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Percent} label="Lead → möte" value={pct(m.leadToMeeting)} />
        <Kpi icon={Percent} label="Möte → offert" value={pct(m.meetingToOffer)} />
        <Kpi icon={Percent} label="Offert → affär" value={pct(m.offerToDeal)} />
        <Kpi icon={Zap} label="Sales velocity" value={m.salesVelocity != null ? `${kr(m.salesVelocity)}/dag` : "–"} sub="Pipelinens intäktstakt" />
      </div>

      {/* Jämförelsegraf */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span>Försäljning jämfört med föregående period</span>
            <Tabs value={compare} onValueChange={(v) => setCompare(v as CompareMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="week" className="text-xs">Vecka</TabsTrigger>
                <TabsTrigger value="month" className="text-xs">Månad</TabsTrigger>
                <TabsTrigger value="year" className="text-xs">År</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="ccCur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: number) => kr(v)} />
              <Legend />
              <Area
                type="monotone"
                dataKey="previous"
                name={COMPARE_LABELS[compare]}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                fill="none"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="current"
                name="Nuvarande period"
                stroke="hsl(var(--primary))"
                fill="url(#ccCur)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Konverteringstratt – {periodLabel.toLowerCase()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnelRows.map((f) => (
            <div key={f.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground">
                  {f.count} st · {kr(f.value)}
                  {f.conversion != null && (
                    <span className={cn("ml-2 font-semibold", f.conversion >= 50 ? "text-success" : f.conversion >= 25 ? "text-warning" : "text-destructive")}>
                      ↓ {f.conversion.toFixed(0)} %
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-3 w-full overflow-hidden rounded bg-muted">
                <div className="h-full rounded bg-primary/80" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </div>
            </div>
          ))}
          {funnelRows[0]?.count === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Inga leads skapade i perioden.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  change,
  highlight,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && "border-primary/40 bg-primary/5")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {sub && <span>{sub}</span>}
          {change != null && (
            <span className={cn("flex items-center gap-0.5 font-medium", change >= 0 ? "text-success" : "text-destructive")}>
              {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change).toFixed(0)} %
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
