import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads, updateLeadRotUnderlag, saveBookingPropertyDesignation, getOfferPdfSignedUrl } from "@/lib/leads-api";
import { fetchActivities, type LeadActivity } from "@/lib/activities-api";
import { fetchLeadDocuments, getLeadDocumentUrl, isInvoiceDocument, type LeadDocument } from "@/lib/lead-documents-api";
import { fetchOffersForLead, type OfferRow } from "@/lib/calculations-api";
import { InvoiceRotPanel } from "@/components/InvoiceRotPanel";
import { EconomyNoteCard } from "@/components/EconomyNoteCard";
import { isRotApplicationDue, type Lead } from "@/lib/types";
import { daysToDue, isOverdue, margin, missingRotData, net, VAT } from "@/lib/economy-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  Loader2,
  Receipt,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { kr, dateSv as dt, dateTimeSv as dtTime } from "@/lib/format";

export const Route = createFileRoute("/ekonomi/$leadId")({
  component: () => (
    <RequireAuth>
      <EkonomiDetail />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Arbetsorder – ekonomidetaljer | admin.vt6" },
      {
        name: "description",
        content: "Poster, ROT-underlag, underlagshistorik och fakturastatus för en enskild arbetsorder.",
      },
      { property: "og:title", content: "Arbetsorder – ekonomidetaljer" },
      {
        property: "og:description",
        content: "Se ekonomiska poster, ROT-underlag, dokument och statushistorik för arbetsordern.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});



function StatusBadges({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={lead.pipelineStage === "slutford" ? "default" : "secondary"}>
        {lead.pipelineStage === "slutford" ? "Slutfört jobb" : "Pågår"}
      </Badge>
      {lead.invoiced ? (
        <Badge variant={isOverdue(lead) ? "destructive" : "outline"}>
          {isOverdue(lead) ? `Förfallen ${Math.abs(daysToDue(lead) ?? 0)} d` : `Fakturerad · förfaller ${dt(lead.invoiceDueDate)}`}
        </Badge>
      ) : (
        <Badge variant="destructive">Ej fakturerad</Badge>
      )}
      {lead.rotEligible && (lead.rotAmount ?? 0) > 0 && (
        <Badge variant={lead.rotPaid ? "outline" : isRotApplicationDue(lead) ? "destructive" : "secondary"}>
          {lead.rotPaid ? `ROT ansökt ${dt(lead.rotAppliedAt)}` : isRotApplicationDue(lead) ? "ROT att ansöka" : "ROT väntar"}
        </Badge>
      )}
    </div>
  );
}

function EkonomiDetail() {
  const { leadId } = Route.useParams();
  const { isEkonomi, loading } = useUserRoles();
  const qc = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
    enabled: isEkonomi,
  });
  const lead = useMemo(() => leads.find((l) => l.id === leadId) ?? null, [leads, leadId]);

  const { data: activities = [] } = useQuery<LeadActivity[]>({
    queryKey: ["lead-activities", leadId],
    queryFn: () => fetchActivities(leadId),
    enabled: isEkonomi,
  });
  const { data: docs = [] } = useQuery<LeadDocument[]>({
    queryKey: ["lead-documents", leadId],
    queryFn: () => fetchLeadDocuments(leadId),
    enabled: isEkonomi,
  });
  const { data: offers = [] } = useQuery<OfferRow[]>({
    queryKey: ["lead-offers", leadId],
    queryFn: () => fetchOffersForLead(leadId),
    enabled: isEkonomi,
  });

  const [personalNumber, setPersonalNumber] = useState("");
  const [designation, setDesignation] = useState("");
  const [rotEligible, setRotEligible] = useState(false);
  const [rotAmount, setRotAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setPersonalNumber(lead.personalNumber ?? "");
    setDesignation(lead.propertyDesignation ?? "");
    setRotEligible(lead.rotEligible);
    setRotAmount(lead.rotAmount != null ? String(lead.rotAmount) : "");
  }, [lead?.id, lead?.personalNumber, lead?.propertyDesignation, lead?.rotEligible, lead?.rotAmount]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    qc.invalidateQueries({ queryKey: ["lead-documents", leadId] });
  };

  const saveRot = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      await updateLeadRotUnderlag(lead.id, {
        personalNumber: personalNumber.trim() || null,
        rotEligible,
        rotAmount: rotAmount.trim() ? Number(rotAmount) : null,
      });
      if (lead.propertyId && (designation.trim() || null) !== (lead.propertyDesignation ?? null)) {
        await saveBookingPropertyDesignation({
          propertyId: lead.propertyId,
          propertyDesignation: designation.trim() || null,
        });
      }
      toast.success("ROT-underlag sparat");
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte spara ROT-underlaget");
    } finally {
      setSaving(false);
    }
  };

  const openDoc = async (doc: LeadDocument) => {
    try {
      window.open(await getLeadDocumentUrl(doc.filePath), "_blank", "noopener");
    } catch {
      toast.error("Kunde inte öppna dokumentet");
    }
  };

  const openOfferPdf = async (path: string) => {
    try {
      window.open(await getOfferPdfSignedUrl(path), "_blank", "noopener");
    } catch {
      toast.error("Kunde inte öppna offerten");
    }
  };

  if (loading || isLoading) {
    return (
      <AppShell title="Arbetsorder">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!isEkonomi) {
    return (
      <AppShell title="Arbetsorder">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Endast för ekonomiansvarig och administratörer.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!lead) {
    return (
      <AppShell title="Arbetsorder">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Hittade ingen arbetsorder med det id:t.
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/ekonomi">Tillbaka till ekonomiöversikten</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const gross = lead.price ?? 0;
  const netto = net(lead);
  const moms = gross - netto;
  const material = (lead.materialCost ?? 0) + (lead.subcontractorPrice ?? 0);
  const tb = margin(lead);
  const rot = lead.rotEligible ? (lead.rotAmount ?? 0) : 0;
  const missing = missingRotData(lead);
  const invoiceDocs = docs.filter(isInvoiceDocument);
  const otherDocs = docs.filter((d) => !isInvoiceDocument(d));

  const poster: { label: string; value: string; hint?: string; strong?: boolean }[] = [
    { label: "Ordervärde inkl. moms", value: kr(gross) },
    { label: `Moms (${Math.round(VAT * 100)} %)`, value: kr(moms) },
    { label: "Netto (exkl. moms)", value: kr(netto), strong: true },
    { label: "Materialkostnad / UE", value: kr(material), hint: lead.subcontractorName ?? undefined },
    { label: "Täckningsbidrag", value: kr(tb), hint: netto > 0 ? `${((tb / netto) * 100).toFixed(1)} % marginal` : undefined, strong: true },
    { label: "ROT-avdrag", value: kr(rot), hint: lead.rotEligible ? "Begärs från Skatteverket" : "ROT ej aktuellt" },
    { label: "Kunden betalar", value: kr(gross - rot), strong: true },
  ];

  return (
    <AppShell
      title={lead.name}
      description={`${lead.address || "Adress saknas"} · ${lead.municipality || ""}`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/ekonomi">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Ekonomiöversikt
          </Link>
        </Button>
      }
    >
      <div className="space-y-5">
        <StatusBadges lead={lead} />

        {missing.length > 0 && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> Underlaget är ofullständigt: {missing.join(", ")}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" /> Poster
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {poster.map((p) => (
                <div key={p.label} className="flex items-baseline justify-between border-b border-border/60 py-1.5 last:border-0">
                  <div>
                    <div className={p.strong ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{p.label}</div>
                    {p.hint && <div className="text-xs text-muted-foreground">{p.hint}</div>}
                  </div>
                  <div className={p.strong ? "text-base font-semibold" : "text-sm"}>{p.value}</div>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Slutfört: {dt(lead.completedAt)}</div>
                <div>Offert godkänd: {dt(lead.offerAcceptedAt)}</div>
                <div>Fakturerad: {lead.invoiced ? dt(lead.invoicedAt) : "Nej"}</div>
                <div>Förfallodatum: {dt(lead.invoiceDueDate)}</div>
                <div>Fastighetsbeteckning: {lead.propertyDesignation || "–"}</div>
                <div>Personnummer: {lead.personalNumber || "–"}</div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <InvoiceRotPanel lead={lead} onUpdated={refresh} />
            <EconomyNoteCard leadId={lead.id} note={lead.economyNote} onUpdated={refresh} />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" /> ROT-underlag
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pnr">Personnummer</Label>
              <Input id="pnr" value={personalNumber} onChange={(e) => setPersonalNumber(e.target.value)} placeholder="ÅÅÅÅMMDD-XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fastighet">Fastighetsbeteckning</Label>
              <Input id="fastighet" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="T.ex. Norrtälje Vigelsjö 3:12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rotbelopp">ROT-belopp (kr)</Label>
              <Input
                id="rotbelopp"
                type="number"
                value={rotAmount}
                onChange={(e) => setRotAmount(e.target.value)}
                placeholder="0"
                disabled={!rotEligible}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="roteligible">ROT ska nyttjas</Label>
                <p className="text-xs text-muted-foreground">Styr om ansökan ska göras till Skatteverket.</p>
              </div>
              <Switch id="roteligible" checked={rotEligible} onCheckedChange={setRotEligible} />
            </div>
            <div className="md:col-span-2">
              <Button size="sm" onClick={saveRot} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Spara ROT-underlag
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Underlag och dokument
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {offers.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Offert</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Belopp</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offers.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="text-sm">v{o.version} · {dt(o.created_at)}</TableCell>
                          <TableCell className="text-sm capitalize">{o.status}</TableCell>
                          <TableCell className="text-right text-sm">{kr(o.total_amount)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => openOfferPdf(o.pdf_path)}>
                              Öppna
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {lead.offerPdfPath && offers.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => openOfferPdf(lead.offerPdfPath!)}>
                  Öppna offert-PDF
                </Button>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fakturor</p>
                {invoiceDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen faktura uppladdad.</p>
                ) : (
                  invoiceDocs.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => openDoc(d)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">{d.fileName}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{dt(d.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Övriga underlag</p>
                {otherDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Inga övriga dokument.</p>
                ) : (
                  otherDocs.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => openDoc(d)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">{d.fileName}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{dt(d.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Underlagshistorik
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen historik ännu.</p>
              ) : (
                <ol className="space-y-3">
                  {activities.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm">{a.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {dtTime(a.created_at)}
                          {a.actor_name ? ` · ${a.actor_name}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
