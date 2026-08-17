import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads } from "@/lib/leads-api";
import { fetchSaljare, type Saljare } from "@/lib/saljare-api";
import {
  PERIOD_LABELS,
  commissionFor,
  commissionRateFor,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgePercent, Download, Loader2, TrendingUp, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/provisionsoversikt")({
  component: () => (
    <RequireAuth>
      <Guard />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Provisionsöversikt – admin | admin.vt6" },
      {
        name: "description",
        content: "Adminöversikt över säljarnas provision: totalt utfall, per säljare, per månad och underlag per affär.",
      },
      { property: "og:title", content: "Provisionsöversikt – admin" },
      { property: "og:description", content: "Totalt provisionsutfall och underlag per säljare och affär." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const dateStr = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("sv-SE") : "–");

function Guard() {
  const { isAdmin, loading } = useUserRoles();
  if (loading) {
    return (
      <AppShell title="Provisionsöversikt">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Kontrollerar behörighet…
        </div>
      </AppShell>
    );
  }
  if (!isAdmin) {
    return (
      <AppShell title="Provisionsöversikt">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">Endast för administratörer</h2>
          <p className="mt-2 text-sm text-muted-foreground">Du saknar behörighet att se provisionsöversikten.</p>
        </div>
      </AppShell>
    );
  }
  return <OverviewPage />;
}

function OverviewPage() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [search, setSearch] = useState("");

  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });
  const { data: sellers = [] } = useQuery({ queryKey: ["saljare"], queryFn: fetchSaljare });

  const sellerById = useMemo(() => new Map(sellers.map((s) => [s.id, s])), [sellers]);
  const sellerFor = (l: Lead): Saljare | null => sellerById.get(l.sellerId ?? l.createdBy ?? "") ?? null;

  const perSeller = useMemo(
    () =>
      sellers
        .map((s) => {
          const own = leads.filter((l: Lead) => (l.sellerId ?? l.createdBy) === s.id);
          return { seller: s, ...summarize(own, s, period) };
        })
        .sort((a, b) => b.commission - a.commission),
    [sellers, leads, period],
  );

  const completed = useMemo(
    () => leads.filter((l: Lead) => l.pipelineStage === "slutford" && isInPeriod(l, period)),
    [leads, period],
  );

  const totals = useMemo(() => {
    const commission = completed.reduce((s, l) => s + commissionFor(l, sellerFor(l)), 0);
    const revenue = completed.reduce((s, l) => s + netValue(l), 0);
    const pipeline = leads.filter((l: Lead) => l.pipelineStage !== "slutford" && (l.price ?? 0) > 0);
    return {
      commission,
      revenue: Math.round(revenue),
      deals: completed.length,
      share: revenue > 0 ? (commission / revenue) * 100 : 0,
      pipelineCommission: pipeline.reduce((s, l) => s + commissionFor(l, sellerFor(l)), 0),
      pipelineDeals: pipeline.length,
      unassigned: completed.filter((l) => !sellerFor(l)).length,
    };
  }, [completed, leads, sellerById]);

  const months = useMemo(() => {
    const map = new Map<string, { commission: number; revenue: number; deals: number }>();
    for (const l of leads as Lead[]) {
      if (l.pipelineStage !== "slutford" || !l.completedAt) continue;
      const d = new Date(l.completedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) ?? { commission: 0, revenue: 0, deals: 0 };
      cur.commission += commissionFor(l, sellerFor(l));
      cur.revenue += netValue(l);
      cur.deals += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([month, v]) => ({ month, ...v, revenue: Math.round(v.revenue) }))
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .slice(0, 12);
  }, [leads, sellerById]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return completed
      .filter((l) =>
        !q ||
        [l.name, l.address, sellerFor(l)?.display_name].some((v) => String(v ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? "")));
  }, [completed, search, sellerById]);

  const exportCsv = () => {
    const head = ["Kund", "Adress", "Säljare", "Slutförd", "Ordervärde exkl moms", "Sats %", "Provision"];
    const body = rows.map((l) => {
      const s = sellerFor(l);
      return [
        l.name,
        l.address ?? "",
        s?.display_name ?? "Ej tilldelad",
        l.completedAt ? new Date(l.completedAt).toISOString().slice(0, 10) : "",
        Math.round(netValue(l)),
        commissionRateFor(l, s),
        commissionFor(l, s),
      ];
    });
    const csv = [head, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `provision-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Provisionsöversikt"
      description="Adminöversikt över hela säljteamets provision, utfall per månad och underlag per affär."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportera CSV
        </Button>
      }
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
          <Stat icon={Wallet} label="Total provision" value={kr(totals.commission)} sub={`${totals.deals} slutförda affärer`} highlight />
          <Stat icon={TrendingUp} label="Ordervärde exkl. moms" value={kr(totals.revenue)} />
          <Stat icon={BadgePercent} label="Provisionsandel" value={`${totals.share.toFixed(1)} %`} sub="av ordervärdet" />
          <Stat
            icon={Users}
            label="Prognos pipeline"
            value={kr(totals.pipelineCommission)}
            sub={`${totals.pipelineDeals} affärer på gång`}
          />
        </div>

        {totals.unassigned > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {totals.unassigned} slutförda affärer saknar tilldelad säljare i vald period.
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Per säljare – {PERIOD_LABELS[period].toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Säljare</TableHead>
                    <TableHead className="text-right">Sats</TableHead>
                    <TableHead className="text-right">Affärer</TableHead>
                    <TableHead className="text-right">Ordervärde exkl. moms</TableHead>
                    <TableHead className="text-right">Prognos</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perSeller.map((r) => (
                    <TableRow key={r.seller.id}>
                      <TableCell>
                        <div className="font-medium">{r.seller.display_name}</div>
                        <div className="text-xs text-muted-foreground">{r.seller.email}</div>
                      </TableCell>
                      <TableCell className="text-right">{r.seller.provision_rate ?? 0} %</TableCell>
                      <TableCell className="text-right">{r.deals}</TableCell>
                      <TableCell className="text-right">{kr(r.revenueNet)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{kr(r.pipelineCommission)}</TableCell>
                      <TableCell className="text-right font-semibold">{kr(r.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Utfall per månad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {months.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Ingen historik ännu.</p>
            ) : (
              months.map((m) => (
                <div key={m.month} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{m.month}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{m.deals} affärer</Badge>
                    <span className="text-muted-foreground">{kr(m.revenue)}</span>
                    <span className="font-semibold">{kr(m.commission)}</span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Underlag per affär</CardTitle>
            <Input
              placeholder="Sök kund, adress eller säljare…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Inga slutförda affärer i vald period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kund</TableHead>
                    <TableHead>Säljare</TableHead>
                    <TableHead>Slutförd</TableHead>
                    <TableHead className="text-right">Ordervärde exkl. moms</TableHead>
                    <TableHead className="text-right">Sats</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => {
                    const s = sellerFor(l);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground">{l.address}</div>
                        </TableCell>
                        <TableCell>{s?.display_name ?? <span className="text-muted-foreground">Ej tilldelad</span>}</TableCell>
                        <TableCell>{dateStr(l.completedAt)}</TableCell>
                        <TableCell className="text-right">{kr(netValue(l))}</TableCell>
                        <TableCell className="text-right">{commissionRateFor(l, s)} %</TableCell>
                        <TableCell className="text-right font-semibold">{kr(commissionFor(l, s))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: typeof Wallet;
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
        <div className={`mt-2 text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
