import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads } from "@/lib/leads-api";
import { fetchSaljare, setSellerProvisionRate, type Saljare } from "@/lib/saljare-api";
import { PERIOD_LABELS, commissionFor, kr, netValue, type PeriodKey } from "@/lib/commission";
import {
  STAGE_PROBABILITY,
  delta,
  funnel,
  groupBy,
  jobTypeOf,
  leadsOf,
  periodRanges,
  sourceOf,
  statsFor,
  timeSeries,
  type Range,
  type SellerStats,
} from "@/lib/sales-analytics";
import {
  JOB_TYPE_LABELS,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type Lead,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Crown,
  Flame,
  Gauge,
  Loader2,
  Medal,
  Percent,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/saljdash")({
  component: () => (
    <RequireAuth>
      <SaljDashPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Säljdash – detaljerad säljstatistik | admin.vt6" },
      {
        name: "description",
        content:
          "Avancerad säljanalys: topplista, konverteringsgrad, säljcykel, pipeline-prognos och provision per säljare — vecka, månad, kvartal och år.",
      },
      { property: "og:title", content: "Säljdash – detaljerad säljstatistik" },
      {
        property: "og:description",
        content: "Topplista, konvertering, säljcykel, källanalys och viktad pipeline-prognos för hela säljteamet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SOURCE_LABELS: Record<string, string> = {
  field: "Fältsälj",
  telemarketing: "Telemarketing",
  scan: "Byggnadsscanning",
  referral: "Referens",
  csv_import: "CSV-import",
  roslagstak: "Webb (roslagstak)",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 197 37% 44%))",
  "hsl(var(--chart-4, 43 74% 66%))",
  "hsl(var(--chart-5, 27 87% 67%))",
  "hsl(var(--muted-foreground))",
];

interface Row extends SellerStats {
  seller: Saljare;
  prev: SellerStats;
  leadsList: Lead[];
}

function SaljDashPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const [period, setPeriod] = useState<PeriodKey>("month");

  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });
  const { data: sellers = [] } = useQuery({ queryKey: ["saljare"], queryFn: fetchSaljare });

  const { current, previous } = useMemo(() => periodRanges(period), [period]);

  const rows: Row[] = useMemo(() => {
    return sellers
      .map((s) => {
        const own = leadsOf(leads as Lead[], s.id);
        const stats = statsFor(own, s, current);
        const prev = statsFor(own, s, previous ?? ({ start: null, end: new Date(0) } as Range));
        return { seller: s, ...stats, prev, leadsList: own };
      })
      .sort((a, b) => b.commission - a.commission || b.revenueNet - a.revenueNet);
  }, [sellers, leads, current, previous]);

  const top = rows[0];
  const myIndex = rows.findIndex((r) => r.seller.id === user?.id);
  const me = myIndex >= 0 ? rows[myIndex] : null;
  const maxCommission = Math.max(1, ...rows.map((r) => r.commission));

  const team = useMemo(() => {
    const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);
    const deals = sum((r) => r.deals);
    return {
      deals,
      revenue: sum((r) => r.revenueNet),
      commission: sum((r) => r.commission),
      forecast: sum((r) => r.weightedForecast),
      pipelineValue: sum((r) => r.pipelineValue),
      avgDeal: deals ? Math.round(sum((r) => r.revenueNet) / deals) : 0,
      prevDeals: sum((r) => r.prev.deals),
      prevRevenue: sum((r) => r.prev.revenueNet),
      prevCommission: sum((r) => r.prev.commission),
      cycle: (() => {
        const vals = rows.map((r) => r.avgCycleDays).filter((v): v is number => v != null);
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      })(),
      winRate: (() => {
        const withLeads = rows.filter((r) => r.leads > 0);
        return withLeads.length
          ? withLeads.reduce((s, r) => s + r.winRate, 0) / withLeads.length
          : 0;
      })(),
    };
  }, [rows]);

  const completedInPeriod = useMemo(
    () =>
      (leads as Lead[]).filter(
        (l) =>
          l.pipelineStage === "slutford" &&
          l.completedAt &&
          (!current.start || new Date(l.completedAt) >= current.start),
      ),
    [leads, current],
  );

  const sellerById = useMemo(() => new Map(sellers.map((s) => [s.id, s])), [sellers]);

  const bestDeals = useMemo(
    () =>
      completedInPeriod
        .map((l) => {
          const s = sellerById.get(l.sellerId ?? l.createdBy ?? "") ?? null;
          return { lead: l, seller: s, net: netValue(l), commission: commissionFor(l, s) };
        })
        .sort((a, b) => b.net - a.net)
        .slice(0, 8),
    [completedInPeriod, sellerById],
  );

  const trend = useMemo(() => timeSeries(leads as Lead[], null, 12), [leads]);
  const funnelSteps = useMemo(() => funnel(leads as Lead[], PIPELINE_STAGES), [leads]);
  const bySource = useMemo(() => groupBy(completedInPeriod, sourceOf), [completedInPeriod]);
  const byJobType = useMemo(() => groupBy(completedInPeriod, jobTypeOf), [completedInPeriod]);

  const maxFunnel = Math.max(1, ...funnelSteps.map((f) => f.count));

  return (
    <AppShell
      title="Säljdash"
      description="Avancerad säljanalys: topplista, konvertering, säljcykel och viktad prognos i realtid."
    >
      <div className="space-y-6">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <TabsList>
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((p) => (
              <TabsTrigger key={p} value={p}>
                {PERIOD_LABELS[p]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={Crown}
            label="Ledare"
            value={top?.seller.display_name ?? "–"}
            sub={top ? `${kr(top.commission)} · ${top.deals} affärer` : undefined}
            highlight
          />
          <Stat
            icon={Trophy}
            label="Din placering"
            value={me ? `#${myIndex + 1} av ${rows.length}` : "–"}
            sub={me ? kr(me.commission) : "Inga affärer ännu"}
            change={me ? delta(me.commission, previous ? me.prev.commission : null) : null}
          />
          <Stat
            icon={TrendingUp}
            label="Teamets ordervärde"
            value={kr(team.revenue)}
            sub={`${team.deals} slutförda affärer`}
            change={previous ? delta(team.revenue, team.prevRevenue) : null}
          />
          <Stat
            icon={Target}
            label="Total provision"
            value={kr(team.commission)}
            change={previous ? delta(team.commission, team.prevCommission) : null}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Gauge} label="Snittaffär" value={kr(team.avgDeal)} sub="Ordervärde exkl. moms" />
          <Stat icon={Percent} label="Vinstgrad" value={`${team.winRate.toFixed(0)} %`} sub="Slutförda av skapade leads" />
          <Stat
            icon={Clock}
            label="Säljcykel"
            value={team.cycle != null ? `${team.cycle} dagar` : "–"}
            sub="Lead → slutförd"
          />
          <Stat
            icon={Flame}
            label="Viktad prognos"
            value={kr(team.forecast)}
            sub={`Pipeline ${kr(team.pipelineValue)}`}
          />
        </div>

        <Tabs defaultValue="topplista">
          <TabsList className="flex-wrap">
            <TabsTrigger value="topplista">Topplista</TabsTrigger>
            <TabsTrigger value="analys">Analys</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="detaljer">Detaljer</TabsTrigger>
          </TabsList>

          {/* TOPPLISTA */}
          <TabsContent value="topplista" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Topplista – {PERIOD_LABELS[period].toLowerCase()}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="flex items-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
                  </div>
                ) : rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Inga säljare registrerade.</p>
                ) : (
                  rows.map((r, i) => {
                    const isMe = r.seller.id === user?.id;
                    const d = previous ? delta(r.commission, r.prev.commission) : null;
                    return (
                      <div
                        key={r.seller.id}
                        className={`rounded-lg border p-3 ${isMe ? "border-primary/50 bg-primary/5" : "border-border"}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <RankBadge rank={i + 1} />
                            <span className="font-medium">{r.seller.display_name}</span>
                            {isMe && <Badge variant="secondary">Du</Badge>}
                            {d != null && <DeltaTag value={d} />}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="text-muted-foreground">{r.deals} affärer</span>
                            <span className="text-muted-foreground">Snitt {kr(r.avgDeal)}</span>
                            <span className="text-muted-foreground">Vinst {r.winRate.toFixed(0)} %</span>
                            <span className="font-semibold">{kr(r.commission)}</span>
                          </div>
                        </div>
                        <Progress value={(r.commission / maxCommission) * 100} className="mt-2 h-1.5" />
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Egna leads: {r.ownDeals} ({kr(r.ownCommission)})</span>
                          <span>Inkommande: {r.inboundDeals} ({kr(r.inboundCommission)})</span>
                          <span>Säljcykel: {r.avgCycleDays != null ? `${r.avgCycleDays} d` : "–"}</span>
                          <span>Prognos: {kr(r.weightedForecast)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Provision per säljare</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows.map((r) => ({ name: r.seller.display_name, provision: r.commission, ordervarde: r.revenueNet }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v: number) => kr(v)} />
                    <Legend />
                    <Bar dataKey="ordervarde" name="Ordervärde" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="provision" name="Provision" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANALYS */}
          <TabsContent value="analys" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Trend – 12 månader</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v: number, n) => (n === "Affärer" ? v : kr(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="revenueNet" name="Ordervärde" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="deals" name="Affärer" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Affärer per leadkälla</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  {bySource.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Inga slutförda affärer i perioden.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={bySource.map((s) => ({ name: SOURCE_LABELS[s.key] ?? s.key, value: s.revenueNet }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={85}
                        >
                          {bySource.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => kr(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ordervärde per jobbtyp</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jobbtyp</TableHead>
                        <TableHead className="text-right">Affärer</TableHead>
                        <TableHead className="text-right">Ordervärde</TableHead>
                        <TableHead className="text-right">Provision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byJobType.map((j) => (
                        <TableRow key={j.key}>
                          <TableCell className="font-medium">{JOB_TYPE_LABELS[j.key] ?? j.key}</TableCell>
                          <TableCell className="text-right">{j.deals}</TableCell>
                          <TableCell className="text-right">{kr(j.revenueNet)}</TableCell>
                          <TableCell className="text-right font-semibold">{kr(j.commission)}</TableCell>
                        </TableRow>
                      ))}
                      {byJobType.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                            Inga slutförda affärer i perioden.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4 text-primary" /> Största affärerna
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bestDeals.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">Inga slutförda affärer i vald period.</p>
                ) : (
                  bestDeals.map(({ lead, seller, net, commission }) => (
                    <div key={lead.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{lead.name}</span>{" "}
                        <span className="text-muted-foreground">· {seller?.display_name ?? "Okänd säljare"}</span>
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-muted-foreground">{kr(net)}</span>{" "}
                        <span className="font-semibold">/ {kr(commission)}</span>
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PIPELINE */}
          <TabsContent value="pipeline" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Säljtratt – hela teamet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {funnelSteps.map((f) => (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{PIPELINE_STAGE_LABELS[f.stage]}</span>
                      <span className="text-muted-foreground">
                        {f.count} st · {kr(f.value)} ·{" "}
                        {Math.round((STAGE_PROBABILITY[f.stage] ?? 0) * 100)} % sannolikhet
                      </span>
                    </div>
                    <Progress value={(f.count / maxFunnel) * 100} className="mt-1.5 h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pipeline per säljare (prognos)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Säljare</TableHead>
                      <TableHead className="text-right">Öppna affärer</TableHead>
                      <TableHead className="text-right">Pipelinevärde</TableHead>
                      <TableHead className="text-right">Max provision</TableHead>
                      <TableHead className="text-right">Viktad prognos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.seller.id}>
                        <TableCell className="font-medium">{r.seller.display_name}</TableCell>
                        <TableCell className="text-right">{r.pipelineDeals}</TableCell>
                        <TableCell className="text-right">{kr(r.pipelineValue)}</TableCell>
                        <TableCell className="text-right">{kr(r.pipelineCommission)}</TableCell>
                        <TableCell className="text-right font-semibold">{kr(r.weightedForecast)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DETALJER */}
          <TabsContent value="detaljer" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nyckeltal per säljare</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Säljare</TableHead>
                      <TableHead className="text-right">Affärer</TableHead>
                      <TableHead className="text-right">Nya leads</TableHead>
                      <TableHead className="text-right">Vinstgrad</TableHead>
                      <TableHead className="text-right">Snittaffär</TableHead>
                      <TableHead className="text-right">Säljcykel</TableHead>
                      <TableHead className="text-right">Snittprovision</TableHead>
                      <TableHead className="text-right">Ordervärde</TableHead>
                      <TableHead className="text-right">Provision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.seller.id}>
                        <TableCell className="font-medium">{r.seller.display_name}</TableCell>
                        <TableCell className="text-right">{r.deals}</TableCell>
                        <TableCell className="text-right">{r.leads}</TableCell>
                        <TableCell className="text-right">{r.winRate.toFixed(0)} %</TableCell>
                        <TableCell className="text-right">{kr(r.avgDeal)}</TableCell>
                        <TableCell className="text-right">{r.avgCycleDays != null ? `${r.avgCycleDays} d` : "–"}</TableCell>
                        <TableCell className="text-right">{kr(r.avgCommission)}</TableCell>
                        <TableCell className="text-right">{kr(r.revenueNet)}</TableCell>
                        <TableCell className="text-right font-semibold">{kr(r.commission)}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                          Inga säljare registrerade.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {isAdmin && <ProvisionRatesCard sellers={sellers} rows={rows} />}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function DeltaTag({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? "text-primary" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(Math.round(value))} %
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const color =
    rank === 1
      ? "bg-primary text-primary-foreground"
      : rank <= 3
        ? "bg-secondary text-secondary-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${color}`}>
      {rank <= 3 ? <Medal className="h-3.5 w-3.5" /> : rank}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  change,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  change?: number | null;
}) {
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`truncate text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
          {change != null && <DeltaTag value={change} />}
        </div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

type RateField = "provision_rate" | "provision_rate_inbound";

function ProvisionRatesCard({ sellers, rows }: { sellers: Saljare[]; rows: Row[] }) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const keyOf = (s: Saljare, f: RateField) => `${s.id}:${f}`;
  const stored = (s: Saljare, f: RateField) => (s[f] != null ? String(s[f]) : "");
  const valueFor = (s: Saljare, f: RateField) => drafts[keyOf(s, f)] ?? stored(s, f);

  const parse = (raw: string): number | null | undefined => {
    const v = raw.trim().replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
    return n;
  };

  const save = async (s: Saljare) => {
    const own = parse(valueFor(s, "provision_rate"));
    const inbound = parse(valueFor(s, "provision_rate_inbound"));
    if (own === undefined || inbound === undefined) {
      toast.error("Ange satser mellan 0 och 100");
      return;
    }
    setSavingId(s.id);
    try {
      await setSellerProvisionRate(s, { provision_rate: own, provision_rate_inbound: inbound });
      await qc.invalidateQueries({ queryKey: ["saljare"] });
      setDrafts((d) => {
        const next = { ...d };
        delete next[keyOf(s, "provision_rate")];
        delete next[keyOf(s, "provision_rate_inbound")];
        return next;
      });
      toast.success(`Provisionssatser sparade för ${s.display_name}`);
    } catch {
      toast.error("Kunde inte spara provisionssatser");
    } finally {
      setSavingId(null);
    }
  };

  const commissionById = new Map(rows.map((r) => [r.seller.id, r.commission]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4 text-primary" /> Provisionssatser (admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Två satser per säljare: <strong>egen lead</strong> (säljaren har skaffat leaden själv) och{" "}
          <strong>inkommande lead</strong> (t.ex. via hemsidan). Provisionen räknas ut automatiskt på
          ordervärde exkl. moms för slutförda affärer.
        </p>
        {sellers.map((s) => {
          const dirty =
            valueFor(s, "provision_rate") !== stored(s, "provision_rate") ||
            valueFor(s, "provision_rate_inbound") !== stored(s, "provision_rate_inbound");
          return (
            <div key={s.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.display_name}</div>
                <div className="text-sm text-muted-foreground">{kr(commissionById.get(s.id) ?? 0)}</div>
              </div>
              {(
                [
                  ["provision_rate", "Egen lead"],
                  ["provision_rate_inbound", "Inkommande lead"],
                ] as [RateField, string][]
              ).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      placeholder="0"
                      value={valueFor(s, field)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [keyOf(s, field)]: e.target.value }))}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" disabled={!dirty || savingId === s.id} onClick={() => save(s)}>
                {savingId === s.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Spara
              </Button>
            </div>
          );
        })}
        {sellers.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">Inga säljare registrerade.</p>
        )}
      </CardContent>
    </Card>
  );
}
