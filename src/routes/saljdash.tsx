import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads } from "@/lib/leads-api";
import { fetchSaljare, setSellerProvisionRate, type Saljare } from "@/lib/saljare-api";
import {
  PERIOD_LABELS,
  commissionFor,
  isInPeriod,
  kr,
  netValue,
  summarize,
  type PeriodKey,
} from "@/lib/commission";
import type { Lead } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Crown, Flame, Loader2, Medal, Percent, Target, TrendingUp, Trophy } from "lucide-react";


export const Route = createFileRoute("/saljdash")({
  component: () => (
    <RequireAuth>
      <SaljDashPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Säljdash – jämför säljarnas resultat | admin.vt6" },
      {
        name: "description",
        content:
          "Topplista över säljarnas slutförda affärer, ordervärde och provision — jämför dig med teamet per vecka, månad och år.",
      },
      { property: "og:title", content: "Säljdash – jämför säljarnas resultat" },
      { property: "og:description", content: "Topplista, snittaffär och pipeline för hela säljteamet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface Row {
  seller: Saljare;
  deals: number;
  revenueNet: number;
  commission: number;
  pipelineDeals: number;
  pipelineCommission: number;
  avgDeal: number;
}

function SaljDashPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();

  const [period, setPeriod] = useState<PeriodKey>("month");

  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });
  const { data: sellers = [] } = useQuery({ queryKey: ["saljare"], queryFn: fetchSaljare });

  const rows: Row[] = useMemo(() => {
    return sellers
      .map((s) => {
        const own = leads.filter((l: Lead) => (l.sellerId ?? l.createdBy) === s.id);
        const sum = summarize(own, s, period);
        return {
          seller: s,
          ...sum,
          avgDeal: sum.deals > 0 ? Math.round(sum.revenueNet / sum.deals) : 0,
        };
      })
      .sort((a, b) => b.commission - a.commission || b.revenueNet - a.revenueNet);
  }, [sellers, leads, period]);

  const top = rows[0];
  const myIndex = rows.findIndex((r) => r.seller.id === user?.id);
  const me = myIndex >= 0 ? rows[myIndex] : null;
  const maxCommission = Math.max(1, ...rows.map((r) => r.commission));
  const teamCommission = rows.reduce((s, r) => s + r.commission, 0);
  const teamRevenue = rows.reduce((s, r) => s + r.revenueNet, 0);
  const teamDeals = rows.reduce((s, r) => s + r.deals, 0);

  const bestDeals = useMemo(() => {
    const byId = new Map(sellers.map((s) => [s.id, s]));
    return leads
      .filter((l: Lead) => l.pipelineStage === "slutford" && isInPeriod(l, period))
      .map((l: Lead) => {
        const s = byId.get(l.sellerId ?? l.createdBy ?? "") ?? null;
        return { lead: l, seller: s, net: netValue(l), commission: commissionFor(l, s) };
      })
      .sort((a, b) => b.net - a.net)
      .slice(0, 8);
  }, [leads, sellers, period]);

  return (
    <AppShell
      title="Säljdash"
      description="Jämför teamets resultat: topplista, snittaffär och pipeline i realtid."
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
          <Stat icon={Crown} label="Ledare" value={top?.seller.display_name ?? "–"} sub={top ? kr(top.commission) : undefined} highlight />
          <Stat icon={Trophy} label="Din placering" value={me ? `#${myIndex + 1} av ${rows.length}` : "–"} sub={me ? kr(me.commission) : "Inga affärer ännu"} />
          <Stat icon={TrendingUp} label="Teamets ordervärde" value={kr(teamRevenue)} sub={`${teamDeals} slutförda affärer`} />
          <Stat icon={Target} label="Total provision" value={kr(teamCommission)} />
        </div>

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
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{r.deals} affärer</span>
                        <span className="text-muted-foreground">Snitt {kr(r.avgDeal)}</span>
                        <span className="font-semibold">{kr(r.commission)}</span>
                      </div>
                    </div>
                    <Progress value={(r.commission / maxCommission) * 100} className="mt-2 h-1.5" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {isAdmin && <ProvisionRatesCard sellers={sellers} rows={rows} />}

        <div className="grid gap-4 lg:grid-cols-2">

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
                    <TableHead className="text-right">Prognos provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.seller.id}>
                      <TableCell className="font-medium">{r.seller.display_name}</TableCell>
                      <TableCell className="text-right">{r.pipelineDeals}</TableCell>
                      <TableCell className="text-right font-semibold">{kr(r.pipelineCommission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

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
        </div>
      </div>
    </AppShell>
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
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className={`mt-2 truncate text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
