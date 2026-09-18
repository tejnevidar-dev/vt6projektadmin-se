import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads, setLeadRotPaid, setLeadInvoiced } from "@/lib/leads-api";
import { isRotApplicationDue, type Lead } from "@/lib/types";
import { economyDate, rotCsv } from "@/lib/economy-analytics";
import { buildRotPdf } from "@/lib/rot-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Download, ExternalLink, FileDown, Landmark, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { kr, dateSv as dateStr } from "@/lib/format";

type RotPeriod = "month" | "quarter" | "year" | "all";

const PERIOD_LABELS: Record<RotPeriod, string> = {
  month: "Denna månad",
  quarter: "Detta kvartal",
  year: "I år",
  all: "Allt",
};

function inPeriod(l: Lead, period: RotPeriod, now = new Date()): boolean {
  if (period === "all") return true;
  const d = economyDate(l);
  if (!d) return false;
  if (period === "year") return d.getFullYear() === now.getFullYear();
  if (period === "quarter") {
    return (
      d.getFullYear() === now.getFullYear() &&
      Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3)
    );
  }
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export const Route = createFileRoute("/ekonomi/rot")({
  component: () => (
    <RequireAuth>
      <EkonomiRotPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "ROT-ansökningar – Ekonomi | admin.vt6" },
      { name: "description", content: "Överblick över slutförda jobb, fakturastatus och ROT-ansökningar till Skatteverket." },
      { property: "og:title", content: "ROT-ansökningar – Ekonomi" },
      { property: "og:description", content: "Fakturastatus, förfallodatum och ROT-underlag för slutförda jobb." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});



function EkonomiRotPage() {
  const { isEkonomi, loading } = useUserRoles();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [period, setPeriod] = useState<RotPeriod>("all");
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
    enabled: isEkonomi,
  });

  const done = useMemo(
    () => leads.filter((l) => l.pipelineStage === "slutford" && inPeriod(l, period)),
    [leads, period],
  );

  const exportCsv = () => {
    const blob = new Blob([rotCsv(done)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rot-underlag-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ROT-underlag exporterat");
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const bytes = await buildRotPdf(done, PERIOD_LABELS[period]);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rot-underlag-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ROT-underlag exporterat (PDF)");
    } catch (e) {
      toast.error("Kunde inte skapa PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const match = (l: Lead) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [l.name, l.address, l.phone, l.personalNumber, l.propertyDesignation, l.economyNote]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  };

  const uninvoiced = done.filter((l) => !l.invoiced).filter(match);
  const rotDue = done.filter((l) => isRotApplicationDue(l)).filter(match);
  const waiting = done
    .filter((l) => l.invoiced && l.rotEligible && (l.rotAmount ?? 0) > 0 && !l.rotPaid && !isRotApplicationDue(l))
    .filter(match);
  const applied = done.filter((l) => l.rotPaid).filter(match);

  const refresh = () => qc.invalidateQueries({ queryKey: ["leads"] });

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

  const markInvoiced = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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

  if (loading) {
    return (
      <AppShell title="ROT-ansökningar">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!isEkonomi) {
    return (
      <AppShell title="ROT-ansökningar">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Endast för ekonomiansvarig och administratörer.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const totalDue = rotDue.reduce((s, l) => s + (l.rotAmount ?? 0), 0);

  const renderTable = (rows: Lead[], variant: "invoice" | "rot") => (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kund</TableHead>
            <TableHead>Personnummer</TableHead>
            <TableHead>Fastighet</TableHead>
            <TableHead>Adress</TableHead>
            <TableHead className="text-right">Pris</TableHead>
            <TableHead className="text-right">ROT</TableHead>
            <TableHead>Faktura</TableHead>
            <TableHead>Kommentar</TableHead>
            <TableHead className="text-right">Åtgärd</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                Inget att visa här.
              </TableCell>
            </TableRow>
          )}
          {rows.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">
                <Link to="/ekonomi/$leadId" params={{ leadId: l.id }} className="hover:underline">
                  {l.name}
                </Link>
                <div className="text-xs text-muted-foreground">{l.phone}</div>
              </TableCell>
              <TableCell className="text-sm">{l.personalNumber || <span className="text-destructive">Saknas</span>}</TableCell>
              <TableCell className="text-sm">{l.propertyDesignation || <span className="text-destructive">Saknas</span>}</TableCell>
              <TableCell className="text-sm">{l.address}</TableCell>
              <TableCell className="text-right text-sm">{kr(l.price)}</TableCell>
              <TableCell className="text-right text-sm font-semibold">{kr(l.rotAmount)}</TableCell>
              <TableCell className="text-sm">
                {l.invoiced ? (
                  <span>
                    Förfaller {dateStr(l.invoiceDueDate)}
                  </span>
                ) : (
                  <Badge variant="destructive">Ej fakturerad</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[220px] text-sm">
                {l.economyNote ? (
                  <span className="whitespace-pre-wrap">{l.economyNote}</span>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {variant === "invoice" ? (
                  <Button size="sm" variant="outline" disabled={busyId === l.id} onClick={() => markInvoiced(l)}>
                    <Receipt className="mr-1.5 h-3.5 w-3.5" />
                    Fakturerad
                  </Button>
                ) : (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href="https://www7.skatteverket.se/portal/rotrut/begar-utbetalning/rot/kopare"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Skatteverket
                      </a>
                    </Button>
                    <Button size="sm" disabled={busyId === l.id} onClick={() => markRot(l)}>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      {l.rotPaid ? "Ångra" : "Ansökt"}
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AppShell title="ROT-ansökningar">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Landmark className="h-4 w-4" /> Att ansöka om
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{kr(totalDue)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Receipt className="h-4 w-4" /> Ej fakturerade jobb
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{uninvoiced.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" /> Ansökta
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{applied.length}</CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            placeholder="Sök på namn, adress, personnummer eller fastighetsbeteckning…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as RotPeriod)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" disabled={exportingPdf} onClick={exportPdf}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" /> {exportingPdf ? "Skapar…" : "PDF"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="rot">
            <TabsList>
              <TabsTrigger value="rot">Att ansöka ({rotDue.length})</TabsTrigger>
              <TabsTrigger value="uninvoiced">Ej fakturerade ({uninvoiced.length})</TabsTrigger>
              <TabsTrigger value="waiting">Väntar på förfallodatum ({waiting.length})</TabsTrigger>
              <TabsTrigger value="applied">Ansökta ({applied.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="rot" className="mt-4">{renderTable(rotDue, "rot")}</TabsContent>
            <TabsContent value="uninvoiced" className="mt-4">{renderTable(uninvoiced, "invoice")}</TabsContent>
            <TabsContent value="waiting" className="mt-4">{renderTable(waiting, "rot")}</TabsContent>
            <TabsContent value="applied" className="mt-4">{renderTable(applied, "rot")}</TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
