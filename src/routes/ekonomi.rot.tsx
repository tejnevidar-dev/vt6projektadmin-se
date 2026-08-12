import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads, setLeadRotPaid, setLeadInvoiced } from "@/lib/leads-api";
import { isRotApplicationDue, type Lead } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, ExternalLink, Landmark, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

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

const kr = (n: number | null | undefined) => `${(n ?? 0).toLocaleString("sv-SE")} kr`;
const dateStr = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("sv-SE") : "–");

function EkonomiRotPage() {
  const { isEkonomi, loading } = useUserRoles();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
    enabled: isEkonomi,
  });

  const done = useMemo(() => leads.filter((l) => l.pipelineStage === "slutford"), [leads]);

  const match = (l: Lead) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [l.name, l.address, l.phone, l.personalNumber, l.propertyDesignation]
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
                {l.name}
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

        <Input
          placeholder="Sök på namn, adress, personnummer eller fastighetsbeteckning…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

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
