import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads } from "@/lib/leads-api";
import { fetchSaljare } from "@/lib/saljare-api";
import {
  PERIOD_LABELS,
  byMonth,
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
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BadgePercent, CheckCircle2, Loader2, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/provision")({
  component: () => (
    <RequireAuth>
      <ProvisionPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Min provision – säljpanel | admin.vt6" },
      {
        name: "description",
        content: "Följ dina affärer, ordervärde och intjänad provision per vecka, månad och år.",
      },
      { property: "og:title", content: "Min provision – säljpanel" },
      { property: "og:description", content: "Provision per vecka, månad och år för säljare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const dateStr = (d: string | null) => (d ? new Date(d).toLocaleDateString("sv-SE") : "–");

function ProvisionPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("me");

  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });
  const { data: sellers = [] } = useQuery({ queryKey: ["saljare"], queryFn: fetchSaljare });

  const sellerId = selected === "me" ? user?.id ?? "" : selected;
  const seller = sellers.find((s) => s.id === sellerId) ?? null;

  const myLeads = useMemo(
    () => leads.filter((l) => (l.sellerId ?? l.createdBy) === sellerId),
    [leads, sellerId],
  );

  const stats = useMemo(() => summarize(myLeads, seller, period), [myLeads, seller, period]);
  const months = useMemo(() => byMonth(myLeads, seller), [myLeads, seller]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myLeads
      .filter((l) => l.pipelineStage === "slutford" && isInPeriod(l, period))
      .filter((l) => !q || [l.name, l.address].some((v) => String(v ?? "").toLowerCase().includes(q)))
      .sort((a, b) => String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? "")));
  }, [myLeads, period, search]);

  const openRows = useMemo(
    () =>
      myLeads
        .filter((l) => l.pipelineStage !== "slutford" && (l.price ?? 0) > 0)
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
        .slice(0, 10),
    [myLeads],
  );

  const leaderboard = useMemo(() => {
    if (!isAdmin) return [];
    return sellers
      .map((s) => {
        const ls = leads.filter((l) => (l.sellerId ?? l.createdBy) === s.id);
        return { seller: s, ...summarize(ls, s, period) };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [isAdmin, sellers, leads, period]);

  return (
    <AppShell
      title="Min provision"
      description="Följ din egen prestation: slutförda affärer, ordervärde och intjänad provision."
      actions={
        isAdmin ? (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Mina affärer</SelectItem>
              {sellers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
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
          <StatCard icon={Wallet} label="Provision" value={kr(stats.commission)} highlight />
          <StatCard icon={CheckCircle2} label="Slutförda affärer" value={String(stats.deals)} />
          <StatCard icon={TrendingUp} label="Ordervärde exkl. moms" value={kr(stats.revenueNet)} />
          <StatCard
            icon={BadgePercent}
            label="Prognos i pipeline"
            value={kr(stats.pipelineCommission)}
            sub={`${stats.pipelineDeals} affärer på gång`}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Slutförda affärer – {PERIOD_LABELS[period].toLowerCase()}</CardTitle>
            <Input
              placeholder="Sök kund eller adress…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Inga slutförda affärer i vald period.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kund</TableHead>
                    <TableHead>Slutförd</TableHead>
                    <TableHead className="text-right">Ordervärde exkl. moms</TableHead>
                    <TableHead className="text-right">Sats</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.address}</div>
                      </TableCell>
                      <TableCell>{dateStr(l.completedAt)}</TableCell>
                      <TableCell className="text-right">{kr(netValue(l))}</TableCell>
                      <TableCell className="text-right">{commissionRateFor(l, seller)} %</TableCell>
                      <TableCell className="text-right font-semibold">{kr(commissionFor(l, seller))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Provision per månad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {months.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Ingen historik ännu.</p>
              ) : (
                months.map((m) => (
                  <div key={m.month} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{m.month}</span>
                    <span>
                      <Badge variant="secondary" className="mr-2">{m.deals} affärer</Badge>
                      <span className="font-semibold">{kr(m.commission)}</span>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pågående affärer (prognos)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {openRows.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Inga öppna affärer med pris.</p>
              ) : (
                openRows.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-3">
                      <span className="font-medium">{l.name}</span>{" "}
                      <span className="text-muted-foreground">· {l.pipelineStage}</span>
                    </span>
                    <span className="whitespace-nowrap font-semibold">{kr(commissionFor(l, seller))}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {isAdmin && leaderboard.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Säljarnas resultat – {PERIOD_LABELS[period].toLowerCase()}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Säljare</TableHead>
                    <TableHead className="text-right">Affärer</TableHead>
                    <TableHead className="text-right">Ordervärde exkl. moms</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((r) => (
                    <TableRow key={r.seller.id}>
                      <TableCell className="font-medium">{r.seller.display_name}</TableCell>
                      <TableCell className="text-right">{r.deals}</TableCell>
                      <TableCell className="text-right">{kr(r.revenueNet)}</TableCell>
                      <TableCell className="text-right font-semibold">{kr(r.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
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
