import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads, setLeadInvoiced, setLeadRotPaid } from "@/lib/leads-api";
import { isRotApplicationDue, type Lead } from "@/lib/types";
import {
  agingBuckets,
  daysToDue,
  economyCsv,
  economyKpis,
  isOverdue,
  margin,
  missingRotData,
  monthlySeries,
  net,
  completedLeads,
} from "@/lib/economy-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Landmark,
  Loader2,
  PiggyBank,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ekonomi/")({
  component: () => (
    <RequireAuth>
      <EkonomiDashboard />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Ekonomiöversikt – fakturor, ROT och marginal | admin.vt6" },
      {
        name: "description",
        content:
          "Ekonomidashboard med omsättning, täckningsbidrag, fakturastatus, förfallna fakturor och ROT-ansökningar.",
      },
      { property: "og:title", content: "Ekonomiöversikt – admin.vt6" },
      {
        property: "og:description",
        content: "Omsättning, marginal, fakturastatus och ROT-underlag för slutförda jobb.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const kr = (n: number | null | undefined) => `${Math.round(n ?? 0).toLocaleString("sv-SE")} kr`;
const tkr = (n: number) => `${Math.round(n / 1000).toLocaleString("sv-SE")} tkr`;
const dateStr = (d: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("sv-SE") : "–";

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "good";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={
            tone === "warn"
              ? "text-2xl font-semibold text-destructive"
              : tone === "good"
                ? "text-2xl font-semibold text-primary"
                : "text-2xl font-semibold"
          }
        >
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EkonomiDashboard() {
  const { isEkonomi, loading } = useUserRoles();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
    enabled: isEkonomi,
  });

  const kpis = useMemo(() => economyKpis(leads), [leads]);
  const series = useMemo(() => monthlySeries(leads, 12), [leads]);
  const aging = useMemo(() => agingBuckets(leads), [leads]);

  const match = (l: Lead) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [l.name, l.address, l.phone, l.personalNumber, l.propertyDesignation, l.economyNote]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  };

  const done = useMemo(() => completedLeads(leads).filter(match), [leads, search]);
  const uninvoiced = done.filter((l) => !l.invoiced);
  const overdue = done.filter((l) => isOverdue(l));
  const rotDue = done.filter((l) => isRotApplicationDue(l));
  const missing = done.filter((l) => missingRotData(l).length > 0);

  const refresh = () => qc.invalidateQueries({ queryKey: ["leads"] });

  const markInvoiced = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const due = new Date(Date.now() + 30 * 86400000);
      const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
      await setLeadInvoiced(lead.id, true, iso);
      toast.success("Markerad som fakturerad (förfaller om 30 dagar)");
      refresh();
    } catch {
      toast.error("Kunde inte markera som fakturerad");
    } finally {
      setBusyId(null);
    }
  };

  const markRot = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      await setLeadRotPaid(lead.id, !lead.rotPaid);
      toast.success(lead.rotPaid ? "ROT återställd" : "ROT markerad som ansökt");
      refresh();
    } catch {
      toast.error("Kunde inte uppdatera ROT-status");
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    const blob = new Blob([economyCsv(leads)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekonomi-underlag-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Bokföringsunderlag exporterat");
  };

  if (loading) {
    return (
      <AppShell title="Ekonomiöversikt">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!isEkonomi) {
    return (
      <AppShell title="Ekonomiöversikt">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Endast för ekonomiansvarig och administratörer.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const leadRow = (l: Lead, action: "invoice" | "rot" | "none") => (
    <TableRow key={l.id}>
      <TableCell className="font-medium">
        <Link to="/leads" className="hover:underline">
          {l.name}
        </Link>
        <div className="text-xs text-muted-foreground">{l.address}</div>
      </TableCell>
      <TableCell className="text-right text-sm">{kr(l.price)}</TableCell>
      <TableCell className="text-right text-sm">{kr(net(l))}</TableCell>
      <TableCell className="text-right text-sm">{kr(margin(l))}</TableCell>
      <TableCell className="text-right text-sm font-medium">{kr(l.rotAmount)}</TableCell>
      <TableCell className="text-sm">
        {l.invoiced ? (
          <span className={isOverdue(l) ? "text-destructive" : undefined}>
            {dateStr(l.invoiceDueDate)}
            {isOverdue(l) && ` (${Math.abs(daysToDue(l) ?? 0)} d sen)`}
          </span>
        ) : (
          <Badge variant="destructive">Ej fakturerad</Badge>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {missingRotData(l).length > 0 ? (
          <span className="text-destructive">{missingRotData(l).join(", ")}</span>
        ) : (
          <span className="text-muted-foreground">Komplett</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {action === "invoice" && (
          <Button size="sm" variant="outline" disabled={busyId === l.id} onClick={() => markInvoiced(l)}>
            <Receipt className="mr-1.5 h-3.5 w-3.5" /> Fakturerad
          </Button>
        )}
        {action === "rot" && (
          <Button size="sm" disabled={busyId === l.id} onClick={() => markRot(l)}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> {l.rotPaid ? "Ångra" : "Ansökt"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );

  const table = (rows: Lead[], action: "invoice" | "rot" | "none", empty: string) => (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kund</TableHead>
            <TableHead className="text-right">Pris</TableHead>
            <TableHead className="text-right">Netto</TableHead>
            <TableHead className="text-right">TB</TableHead>
            <TableHead className="text-right">ROT</TableHead>
            <TableHead>Förfaller</TableHead>
            <TableHead>Underlag</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((l) => leadRow(l, action))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AppShell
      title="Ekonomiöversikt"
      description="Omsättning, marginal, fakturastatus och ROT för slutförda jobb."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> Exportera underlag
          </Button>
          <Button size="sm" asChild>
            <Link to="/ekonomi/rot">
              <Landmark className="mr-1.5 h-4 w-4" /> ROT-ansökningar
            </Link>
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={TrendingUp}
              label="Omsättning (netto)"
              value={kr(kpis.revenueNet)}
              hint={`${kpis.jobs} slutförda jobb · ${kr(kpis.revenueGross)} inkl. moms`}
            />
            <Kpi
              icon={PiggyBank}
              label="Täckningsbidrag"
              value={kr(kpis.margin)}
              tone="good"
              hint={`${kpis.marginPct.toFixed(1)} % marginal · material ${kr(kpis.materialCost)}`}
            />
            <Kpi
              icon={Receipt}
              label="Ej fakturerat"
              value={kr(kpis.uninvoicedAmount)}
              tone={kpis.uninvoicedCount ? "warn" : "default"}
              hint={`${kpis.uninvoicedCount} jobb väntar på faktura`}
            />
            <Kpi
              icon={AlertTriangle}
              label="Förfallna fakturor"
              value={kr(kpis.overdueAmount)}
              tone={kpis.overdueCount ? "warn" : "default"}
              hint={`${kpis.overdueCount} förfallna · ${kpis.dueSoonCount} förfaller inom 7 dagar`}
            />
            <Kpi
              icon={Landmark}
              label="ROT utestående"
              value={kr(kpis.rotOutstandingAmount)}
              hint={`${kpis.rotOutstandingCount} jobb · ${kpis.rotDueCount} redo att ansöka`}
            />
            <Kpi
              icon={CheckCircle2}
              label="ROT ansökt"
              value={kr(kpis.rotAppliedAmount)}
              hint="Begärt från Skatteverket"
            />
            <Kpi
              icon={AlertTriangle}
              label="Ofullständiga underlag"
              value={String(kpis.missingDataCount)}
              tone={kpis.missingDataCount ? "warn" : "default"}
              hint="Saknar personnummer, fastighet eller belopp"
            />
            <Kpi
              icon={Receipt}
              label="Fakturerat"
              value={kr(kpis.invoicedAmount)}
              hint="Totalt fakturerat inkl. moms"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Omsättning och marginal per månad</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => tkr(v)} tick={{ fontSize: 11 }} width={60} />
                    <Tooltip formatter={(v: number) => kr(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenueNet" name="Netto" stroke="var(--primary)" strokeWidth={2} />
                    <Line type="monotone" dataKey="margin" name="TB" stroke="var(--chart-2)" strokeWidth={2} />
                    <Line type="monotone" dataKey="material" name="Material" stroke="var(--muted-foreground)" strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Fordringar per ålder</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aging}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tickFormatter={(v: number) => tkr(v)} tick={{ fontSize: 11 }} width={60} />
                    <Tooltip formatter={(v: number) => kr(v)} />
                    <Bar dataKey="amount" name="Belopp" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Input
            placeholder="Sök på namn, adress, personnummer eller fastighetsbeteckning…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          <Tabs defaultValue="uninvoiced">
            <TabsList>
              <TabsTrigger value="uninvoiced">Att fakturera ({uninvoiced.length})</TabsTrigger>
              <TabsTrigger value="overdue">Förfallna ({overdue.length})</TabsTrigger>
              <TabsTrigger value="rot">ROT att ansöka ({rotDue.length})</TabsTrigger>
              <TabsTrigger value="missing">Saknar underlag ({missing.length})</TabsTrigger>
              <TabsTrigger value="all">Alla slutförda ({done.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="uninvoiced" className="mt-4">
              {table(uninvoiced, "invoice", "Allt är fakturerat.")}
            </TabsContent>
            <TabsContent value="overdue" className="mt-4">
              {table(overdue, "none", "Inga förfallna fakturor.")}
            </TabsContent>
            <TabsContent value="rot" className="mt-4">
              {table(rotDue, "rot", "Inga ROT-ansökningar att göra just nu.")}
            </TabsContent>
            <TabsContent value="missing" className="mt-4">
              {table(missing, "none", "Alla underlag är kompletta.")}
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              {table(done, "none", "Inga slutförda jobb ännu.")}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}
