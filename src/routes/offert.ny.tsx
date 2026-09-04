import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  FileDown,
  Loader2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  UserRound,
  PenTool,
  Send,
  ExternalLink,
  Save,
  FolderOpen,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  generateManualOffer,
  type OfferInput,
  type OfferRow as OfferRowLine,
  type OfferVillkorSektion,
} from "@/lib/offer-manual.functions";
import { parseArbeteText } from "@/lib/offer-parse.functions";
import { QuickPriceCalculator } from "@/components/QuickPriceCalculator";
import {
  listMyDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
  type OfferDraftRow,
} from "@/lib/offer-drafts";
import {
  fetchOffersForLead,
  updateOfferStatus,
  type OfferRow as OfferHistoryRow,
} from "@/lib/calculations-api";
import { SelectCustomerDialog, type CustomerPick } from "@/components/SelectCustomerDialog";
import { SignAndSendDialog } from "@/components/SignAndSendDialog";
import {
  listSigningRequests,
  resendSigningEmail,
  getSigningPdfUrl,
  type SigningRequestRow,
} from "@/lib/signing.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/offert/ny")({
  head: () => ({ meta: [{ title: "Offert & Kalkyl – RoslagsTak" }] }),
  component: OffertNyPage,
});

const STANDARD_INTRO = "Vi tackar för er förfrågan och offererar enligt följande:";

const ARBETSTEXT_MALLAR: { key: string; label: string; text: string }[] = [
  {
    key: "takbyte",
    label: "Takbyte",
    text: `Komplett takbyte enligt nedan:
Rivning av befintligt taktäckningsmaterial samt bortforsling och deponering av rivningsavfall.
Kontroll av undertak och råspont, eventuellt byte av skadade delar enligt överenskommelse.
Montering av nytt undertak (underlagspapp/undertakspanel) med överlapp enligt tillverkarens anvisningar.
Montering av läkt och strölekt enligt gällande standard.
Läggning av nytt taktäckningsmaterial inklusive nock, gavlar och takfotsbeslag.
Montering av ränndalar i plåt där det förekommer.
Inkapsling/inklädnad av skorsten och genomföringar med plåtbeslag.
Montering av komplett plåtbeslagsdetaljer: nockplåt, gavelplåt, takfotsplåt och droppbleck.
Montering av hängrännor och stuprör i plåt.
Montering av snörasskydd enligt gällande krav.
Slutbesiktning och städning av arbetsplatsen.`,
  },
  {
    key: "taktvatt",
    label: "Taktvätt",
    text: `Taktvätt och behandling enligt nedan:
Förberedelse av arbetsplatsen med skydd av fasad, rabatter och markytor.
Skurning av hängrännor och röjning av löv och skräp.
Högtryckstvätt av hela takytan med anpassat tryck för befintlig taktyp.
Bortsköljning av mossa, alger och smuts från takpannor samt hängrännor.
Alg- och mossbehandling med långtidsverkande medel på hela takytan.
Kontroll och återställning av förskjutna takpannor.
Slutkontroll av hängrännor och stuprör samt spolning av nedfall.
Städning av arbetsplatsen.`,
  },
];

const STANDARD_VILLKOR: OfferVillkorSektion[] = [
  { rubrik: "1.1 Offertens giltighet", brodtext: "Offerten gäller i 30 dagar från offertdatum." },
  { rubrik: "1.2 Betalningsvillkor", brodtext: "Betalningsvillkor: 10 dagar netto." },
  { rubrik: "1.3 Arbetsstart", brodtext: "Arbetsstart bestäms i samråd med kund." },
  {
    rubrik: "1.4 ÄTA-arbeten",
    brodtext:
      "Allt arbete som ej är skriftligt nämnt i offerten betraktas som ÄTA-arbete och debiteras med 670 kr/h inkl. moms.",
  },
  {
    rubrik: "1.5 Entreprenadansvar",
    brodtext:
      "RoslagsTak (VT6 Invest AB) ansvarar för projektet i sin helhet inklusive erforderliga byggställningar, materialleveranser, transporter, avfallshantering, deponikostnader samt övriga åtgärder som krävs för att utföra de arbeten som anges i offerten.",
  },
  {
    rubrik: "1.6 ROT-avdrag",
    brodtext:
      "ROT-avdraget är preliminärt och förutsätter att beställaren uppfyller Skatteverkets villkor samt har tillgängligt ROT-utrymme.",
  },
  {
    rubrik: "1.7 Reducerat eller avslaget ROT-avdrag",
    brodtext:
      "Om Skatteverket helt eller delvis avslår ansökan om ROT-avdrag är beställaren skyldig att betala motsvarande belopp till entreprenören.",
  },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
interface FormState {
  offertnr: string;
  offertdatum: string;
  giltigTom: string;
  betalningsvillkor: string;
  kundNamn: string;
  objektadress: string;
  telefon: string;
  mail: string;
  fastighetsbeteckning: string;
  intro: string;
  arbetstext: string;
  rader: OfferRowLine[];
  entreprenadpris: number;
  materialkostnad: number;
  momsProcent: number;
  inkluderaRot: boolean;
  antalAgare: 1 | 2;
  rotManuell: boolean;
  rotManuelltBelopp: number;
  noteringarText: string;
  villkor: OfferVillkorSektion[];
  leadId: string | null;
}

function initialForm(): FormState {
  return {
    offertnr: "",
    offertdatum: todayISO(),
    giltigTom: plusDaysISO(30),
    betalningsvillkor: "10 dagar netto",
    kundNamn: "",
    objektadress: "",
    telefon: "",
    mail: "",
    fastighetsbeteckning: "",
    intro: STANDARD_INTRO,
    arbetstext: "",
    rader: [],
    entreprenadpris: 0,
    materialkostnad: 0,
    momsProcent: 25,
    inkluderaRot: true,
    antalAgare: 1,
    rotManuell: false,
    rotManuelltBelopp: 0,
    noteringarText: "",
    villkor: STANDARD_VILLKOR,
    leadId: null,
  };
}

function OffertNyPage() {
  const call = useServerFn(generateManualOffer);
  const callParse = useServerFn(parseArbeteText);


  const [form, setForm] = useState<FormState>(() => initialForm());
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  // ---------- Signering ----------
  const [lastPdf, setLastPdf] = useState<{ base64: string; offertnr: string } | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signings, setSignings] = useState<SigningRequestRow[]>([]);
  const callListSignings = useServerFn(listSigningRequests);
  const callResendSigning = useServerFn(resendSigningEmail);
  const callSigningPdf = useServerFn(getSigningPdfUrl);

  const loadSignings = async () => {
    try {
      setSignings(await callListSignings({ data: undefined as never }));
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    void loadSignings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ---------- Drafts ----------
  const [drafts, setDrafts] = useState<OfferDraftRow[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);

  const loadDrafts = async () => {
    try {
      setDrafts(await listMyDrafts());
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    loadDrafts();
    peekNextOfferNr();
  }, []);

  const peekNextOfferNr = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.rpc("peek_offer_number" as any);
      if (!error && typeof data === "string") {
        setForm((f) => (f.offertnr ? f : { ...f, offertnr: data }));
      }
    } catch { /* ignore */ }
  };

  const handleSaveDraft = async () => {
    try {
      const label =
        form.kundNamn.trim() ||
        form.offertnr ||
        `Utkast ${new Date().toLocaleString("sv-SE")}`;
      if (activeDraftId) {
        await updateDraft(activeDraftId, { label, payload: form, leadId: form.leadId });
        toast.success("Utkast uppdaterat");
      } else {
        const row = await createDraft({ label, payload: form, leadId: form.leadId });
        setActiveDraftId(row.id);
        toast.success("Utkast sparat");
      }
      loadDrafts();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte spara utkast");
    }
  };

  const handleOpenDraft = (d: OfferDraftRow) => {
    try {
      const p = d.payload as FormState;
      setForm({ ...initialForm(), ...p });
      setActiveDraftId(d.id);
      setDraftsOpen(false);
      toast.success(`Öppnade "${d.label}"`);
    } catch {
      toast.error("Kunde inte öppna utkast");
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Ta bort utkast?")) return;
    try {
      await deleteDraft(id);
      if (activeDraftId === id) setActiveDraftId(null);
      loadDrafts();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte ta bort");
    }
  };

  const handleNewDraft = () => {
    setForm(initialForm());
    setActiveDraftId(null);
    peekNextOfferNr();
    toast.info("Nytt utkast");
  };

  // ---------- Rader / AI-tolkning ----------
  const renumber = (list: { beskrivning: string }[]): OfferRowLine[] =>
    list.map((r, i) => ({ radnr: (i + 1) * 10, beskrivning: r.beskrivning }));

  const handleTolka = async () => {
    if (!form.arbetstext.trim()) {
      toast.error("Klistra in arbetstexten först");
      return;
    }
    setParsing(true);
    try {
      const res = await callParse({ data: { text: form.arbetstext } });
      set("rader", renumber(res.punkter.map((p) => ({ beskrivning: p }))));
      toast.success(`AI tolkade ${res.punkter.length} punkter`);
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte tolka texten");
    } finally {
      setParsing(false);
    }
  };
  const updateRad = (i: number, beskrivning: string) =>
    set(
      "rader",
      form.rader.map((r, idx) => (idx === i ? { ...r, beskrivning } : r)),
    );
  const removeRad = (i: number) =>
    set("rader", renumber(form.rader.filter((_, idx) => idx !== i)));
  const moveRad = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.rader.length) return;
    const copy = [...form.rader];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    set("rader", renumber(copy));
  };
  const addRad = () => set("rader", renumber([...form.rader, { beskrivning: "" }]));

  // ---------- Belopp ----------
  const totals = useMemo(() => {
    const moms = Math.round((form.entreprenadpris * form.momsProcent) / 100);
    const totalInkl = form.entreprenadpris + moms;
    const arbeteExMoms = Math.max(0, form.entreprenadpris - form.materialkostnad);
    const arbeteInklMoms = arbeteExMoms * (1 + form.momsProcent / 100);
    const rotTak = form.antalAgare * 50000;
    const rotRaknat = Math.round(arbeteInklMoms * 0.3);
    const rotAuto = Math.min(rotRaknat, rotTak);
    const rotManuelltClamped = Math.max(
      0,
      Math.min(Math.round(form.rotManuelltBelopp || 0), Math.min(rotTak, totalInkl)),
    );
    const rotBelopp = !form.inkluderaRot
      ? 0
      : form.rotManuell
        ? rotManuelltClamped
        : rotAuto;
    const rotKapad = form.inkluderaRot && !form.rotManuell && rotRaknat > rotTak;
    const attBetala = totalInkl - rotBelopp;
    return {
      moms,
      totalInkl,
      rotBelopp,
      attBetala,
      arbeteExMoms,
      rotTak,
      rotRaknat,
      rotAuto,
      rotKapad,
    };
  }, [
    form.entreprenadpris,
    form.materialkostnad,
    form.momsProcent,
    form.inkluderaRot,
    form.antalAgare,
    form.rotManuell,
    form.rotManuelltBelopp,
  ]);
  const rotEtikett = form.antalAgare === 2 ? "(2 ägare)" : "";

  // ---------- Villkor ----------
  const addVillkor = () => set("villkor", [...form.villkor, { rubrik: "", brodtext: "" }]);
  const updateVillkor = (i: number, patch: Partial<OfferVillkorSektion>) =>
    set(
      "villkor",
      form.villkor.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  const removeVillkor = (i: number) =>
    set("villkor", form.villkor.filter((_, idx) => idx !== i));

  // ---------- Kund ----------
  const applyCustomer = (c: CustomerPick) => {
    // Om det finns en sparad kalkyl för kunden – fyll i hela offerten direkt
    const existing = drafts.find((d) => d.lead_id === c.leadId);
    if (existing) {
      try {
        const p = existing.payload as Partial<FormState>;
        setForm({
          ...initialForm(),
          ...p,
          leadId: c.leadId,
          kundNamn: p.kundNamn || c.name,
          telefon: p.telefon || c.phone,
          mail: p.mail || c.email,
          objektadress: p.objektadress || c.address,
          fastighetsbeteckning: p.fastighetsbeteckning || c.propertyDesignation,
        } as FormState);
        setActiveDraftId(existing.id);
        peekNextOfferNr();
        toast.success(`Kalkyl hämtad för ${c.name} – priset är redan ifyllt`);
        return;
      } catch {
        /* falla tillbaka på vanligt kundval */
      }
    }
    setForm((f) => ({
      ...f,
      leadId: c.leadId,
      kundNamn: c.name || f.kundNamn,
      telefon: c.phone || f.telefon,
      mail: c.email || f.mail,
      objektadress: c.address || f.objektadress,
      fastighetsbeteckning: c.propertyDesignation || f.fastighetsbeteckning,
    }));
    toast.success(`Kund vald: ${c.name}`);
  };
  const clearCustomer = () =>
    setForm((f) => ({
      ...f,
      leadId: null,
      kundNamn: "",
      telefon: "",
      mail: "",
      objektadress: "",
      fastighetsbeteckning: "",
    }));

  // ---------- Historik ----------
  const [history, setHistory] = useState<OfferHistoryRow[]>([]);
  useEffect(() => {
    if (!form.leadId) {
      setHistory([]);
      return;
    }
    fetchOffersForLead(form.leadId).then(setHistory).catch(() => setHistory([]));
  }, [form.leadId]);

  const handleStatusChange = async (id: string, status: OfferHistoryRow["status"]) => {
    try {
      await updateOfferStatus(id, status);
      if (form.leadId) setHistory(await fetchOffersForLead(form.leadId));
      toast.success("Status uppdaterad");
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte uppdatera status");
    }
  };

  // ---------- Generera ----------
  const handleGenerate = async () => {
    if (!form.kundNamn.trim()) {
      toast.error("Ange kundnamn");
      return;
    }
    const cleanRader = renumber(
      form.rader
        .map((r) => ({ beskrivning: r.beskrivning.trim() }))
        .filter((r) => r.beskrivning),
    );
    if (cleanRader.length === 0) {
      toast.error("Tolka texten till punkter (eller lägg till manuellt) först");
      return;
    }
    const noteringarArr = form.noteringarText
      .split(/\n+/)
      .map((n) => n.trim())
      .filter(Boolean);
    const payload: OfferInput = {
      offertnr: form.offertnr,
      offertdatum: form.offertdatum,
      giltigTom: form.giltigTom,
      betalningsvillkor: form.betalningsvillkor,
      kundNamn: form.kundNamn,
      objektadress: form.objektadress,
      telefon: form.telefon,
      mail: form.mail,
      fastighetsbeteckning: form.fastighetsbeteckning,
      intro: form.intro,
      rader: cleanRader,
      entreprenadprisExklMoms: form.entreprenadpris,
      materialkostnad: form.materialkostnad,
      momsProcent: form.momsProcent,
      rotBelopp: totals.rotBelopp,
      rotEtikett: rotEtikett.trim(),
      noteringar: noteringarArr,
      villkor: form.villkor.filter((v) => v.rubrik.trim() || v.brodtext.trim()),
    };
    setLoading(true);
    try {
      const res = await call({ data: payload });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (res.offertnr) {
        setForm((f) => ({ ...f, offertnr: res.offertnr }));
      }
      setLastPdf({ base64: res.base64, offertnr: res.offertnr ?? form.offertnr });
      toast.success(`Offert ${res.offertnr ?? ""} genererad`);
      peekNextOfferNr();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte generera offert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="Offert & Kalkyl"
      description="Skapa offerter från bilder eller manuellt. Spara utkast, välj kund och följ upp status."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleNewDraft}>
            Nytt
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDraftsOpen((v) => !v)}>
            <FolderOpen className="mr-1 h-4 w-4" />
            Utkast ({drafts.length})
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft}>
            <Save className="mr-1 h-4 w-4" />
            {activeDraftId ? "Uppdatera utkast" : "Spara utkast"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!lastPdf) {
                toast.error("Generera PDF först");
                return;
              }
              setSignOpen(true);
            }}
          >
            <PenTool className="mr-1 h-4 w-4" />
            Signera & skicka
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Generera PDF
          </Button>
        </div>
      }
    >
      {draftsOpen && (
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Mina utkast</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga sparade utkast ännu.</p>
            ) : (
              <ul className="divide-y divide-border">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <button
                      className="flex-1 text-left hover:underline"
                      onClick={() => handleOpenDraft(d)}
                    >
                      <span className="font-medium">{d.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(d.updated_at).toLocaleString("sv-SE")}
                      </span>
                      {activeDraftId === d.id && (
                        <Badge className="ml-2" variant="secondary">
                          aktiv
                        </Badge>
                      )}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteDraft(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="offert" className="w-full">
        <TabsList>
          <TabsTrigger value="offert">Offert</TabsTrigger>
          <TabsTrigger value="kalkyl">Kalkyl</TabsTrigger>
        </TabsList>

        {/* ============= OFFERT ============= */}
        <TabsContent value="offert" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Offertuppgifter</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Offertnr</Label>
                  <Input value={form.offertnr} onChange={(e) => set("offertnr", e.target.value)} />
                </div>
                <div>
                  <Label>Betalningsvillkor</Label>
                  <Input
                    value={form.betalningsvillkor}
                    onChange={(e) => set("betalningsvillkor", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Offertdatum</Label>
                  <Input
                    type="date"
                    value={form.offertdatum}
                    onChange={(e) => set("offertdatum", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Giltig tom</Label>
                  <Input
                    type="date"
                    value={form.giltigTom}
                    onChange={(e) => set("giltigTom", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Kund</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                    <UserRound className="mr-1 h-4 w-4" />
                    Välj kund
                  </Button>
                  {form.leadId && (
                    <Button size="sm" variant="ghost" onClick={clearCustomer}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {form.leadId && (
                  <div className="sm:col-span-2 -mt-1">
                    <Badge variant="secondary">Kopplad till lead</Badge>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Label>Namn</Label>
                  <Input
                    value={form.kundNamn}
                    onChange={(e) => set("kundNamn", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Objektadress</Label>
                  <Input
                    value={form.objektadress}
                    onChange={(e) => set("objektadress", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telefon</Label>
                  <Input value={form.telefon} onChange={(e) => set("telefon", e.target.value)} />
                </div>
                <div>
                  <Label>Mail</Label>
                  <Input value={form.mail} onChange={(e) => set("mail", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Fastighetsbeteckning</Label>
                  <Input
                    value={form.fastighetsbeteckning}
                    onChange={(e) => set("fastighetsbeteckning", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tidigare offerter för kunden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">v{h.version}</span>
                      <span className="ml-2 text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString("sv-SE")}
                      </span>
                      <span className="ml-2">
                        {h.total_amount.toLocaleString("sv-SE")} kr
                      </span>
                      <Badge className="ml-2" variant="outline">
                        {h.status}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {(["skickad", "accepterad", "avvisad"] as const).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={h.status === s ? "default" : "outline"}
                          onClick={() => handleStatusChange(h.id, s)}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Arbetsbeskrivning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Introduktionstext</Label>
                <Input value={form.intro} onChange={(e) => set("intro", e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Klistra in arbetstexten (löpande text)</Label>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <FileDown className="mr-1 h-4 w-4" />
                          Infoga mall
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ARBETSTEXT_MALLAR.map((m) => (
                          <DropdownMenuItem
                            key={m.key}
                            onClick={() => {
                              set("arbetstext", m.text);
                              toast.success(`Mall "${m.label}" infogad`);
                            }}
                          >
                            {m.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" onClick={handleTolka} disabled={parsing}>
                    {parsing ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-4 w-4" />
                    )}
                    Tolka med AI
                  </Button>
                  </div>
                </div>
                <Textarea
                  rows={8}
                  placeholder="Klistra in hela din löpande text. AI läser och bryter ut arbetsmomenten till numrerade punkter."
                  value={form.arbetstext}
                  onChange={(e) => set("arbetstext", e.target.value)}
                />
              </div>

              {form.rader.length > 0 && (
                <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground">
                      {form.rader.length} punkter (redigerbara)
                    </div>
                    <Button size="sm" variant="ghost" onClick={addRad}>
                      <Plus className="mr-1 h-4 w-4" /> Lägg till
                    </Button>
                  </div>
                  {form.rader.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-8 pt-2 text-xs text-muted-foreground tabular-nums">
                        {r.radnr}
                      </span>
                      <Textarea
                        rows={2}
                        value={r.beskrivning}
                        onChange={(e) => updateRad(i, e.target.value)}
                        className="flex-1"
                      />
                      <div className="flex flex-col gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveRad(i, -1)}
                          disabled={i === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveRad(i, 1)}
                          disabled={i === form.rader.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeRad(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Belopp</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Entreprenadpris exkl. moms (kr)</Label>
                <Input
                  type="number"
                  value={form.entreprenadpris}
                  onChange={(e) => set("entreprenadpris", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Materialkostnad (kr)</Label>
                <Input
                  type="number"
                  value={form.materialkostnad}
                  onChange={(e) => set("materialkostnad", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Moms %</Label>
                <Input
                  type="number"
                  value={form.momsProcent}
                  onChange={(e) => set("momsProcent", Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="inkl-rot"
                  type="checkbox"
                  checked={form.inkluderaRot}
                  onChange={(e) => set("inkluderaRot", e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="inkl-rot" className="!m-0">
                  Inkludera ROT-avdrag (30 % av arbetskostnaden)
                </Label>
              </div>
              <div className="sm:col-span-2">
                <Label>Antal ägare (ROT-tak: 50 000 kr/ägare)</Label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="antal-agare"
                      checked={form.antalAgare === 1}
                      onChange={() => set("antalAgare", 1)}
                    />
                    1 ägare (max 50 000 kr)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="antal-agare"
                      checked={form.antalAgare === 2}
                      onChange={() => set("antalAgare", 2)}
                    />
                    2 ägare (max 100 000 kr)
                  </label>
                </div>
              </div>
              {form.inkluderaRot && (
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="rot-manuell"
                      type="checkbox"
                      checked={form.rotManuell}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setForm((f) => ({
                          ...f,
                          rotManuell: on,
                          rotManuelltBelopp: on && !f.rotManuelltBelopp
                            ? totals.rotAuto
                            : f.rotManuelltBelopp,
                        }));
                      }}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="rot-manuell" className="!m-0">
                      Justera ROT-avdraget manuellt (kunden har begränsat ROT-utrymme)
                    </Label>
                  </div>
                  {form.rotManuell && (
                    <div>
                      <Label>ROT-avdrag (kr)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={Math.min(totals.rotTak, totals.totalInkl)}
                        value={form.rotManuelltBelopp}
                        onChange={(e) =>
                          set("rotManuelltBelopp", Number(e.target.value))
                        }
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Beräknat ROT: {totals.rotAuto.toLocaleString("sv-SE")} kr · tak{" "}
                        {totals.rotTak.toLocaleString("sv-SE")} kr
                        {form.rotManuelltBelopp >
                          Math.min(totals.rotTak, totals.totalInkl) && (
                          <span className="ml-1 text-destructive">
                            – beloppet begränsas till{" "}
                            {Math.min(totals.rotTak, totals.totalInkl).toLocaleString("sv-SE")} kr
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="sm:col-span-2 rounded-md border p-3 text-sm bg-muted/30 space-y-1">
                <div className="flex justify-between">
                  <span>Arbetskostnad ex. moms</span>
                  <span>{totals.arbeteExMoms.toLocaleString("sv-SE")} kr</span>
                </div>
                <div className="flex justify-between">
                  <span>Moms {form.momsProcent} %</span>
                  <span>{totals.moms.toLocaleString("sv-SE")} kr</span>
                </div>
                <div className="flex justify-between">
                  <span>Totalt inkl. moms</span>
                  <span>{totals.totalInkl.toLocaleString("sv-SE")} kr</span>
                </div>
                {form.inkluderaRot && totals.rotBelopp > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>
                        ROT-avdrag {rotEtikett}
                        {totals.rotKapad && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (kapat till tak {totals.rotTak.toLocaleString("sv-SE")} kr)
                          </span>
                        )}
                      </span>
                      <span>−{totals.rotBelopp.toLocaleString("sv-SE")} kr</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Att betala efter ROT</span>
                      <span>{totals.attBetala.toLocaleString("sv-SE")} kr</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Övriga noteringar</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="En punkt per rad – renderas som punktlista."
                value={form.noteringarText}
                onChange={(e) => set("noteringarText", e.target.value)}
              />
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Övriga villkor</CardTitle>
              <Button size="sm" onClick={addVillkor}>
                <Plus className="mr-1 h-4 w-4" /> Lägg till villkor
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.villkor.map((v, i) => (
                <div key={i} className="space-y-1 border-l-2 border-muted pl-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Rubrik (t.ex. 1.1 Offertens giltighet)"
                      value={v.rubrik}
                      onChange={(e) => updateVillkor(i, { rubrik: e.target.value })}
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeVillkor(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Brödtext"
                    value={v.brodtext}
                    onChange={(e) => updateVillkor(i, { brodtext: e.target.value })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= KALKYL ============= */}
        <TabsContent value="kalkyl" className="mt-4">
          <QuickPriceCalculator onSaved={() => void loadDrafts()} />
        </TabsContent>
      </Tabs>

      <SelectCustomerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={applyCustomer}
      />

      <SignAndSendDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        pdfBase64={lastPdf?.base64 ?? null}
        offerNumber={lastPdf?.offertnr ?? form.offertnr}
        customerName={form.kundNamn}
        customerEmail={form.mail}
        leadId={form.leadId}
        totalAmount={totals.attBetala}
        onCreated={loadSignings}
      />

      {signings.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Signeringar</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <ul className="divide-y divide-border">
              {signings.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <div className="min-w-[180px] flex-1">
                    <span className="font-medium">{s.offer_number}</span>{" "}
                    <span className="text-muted-foreground">· {s.customer_name}</span>
                  </div>
                  <Badge variant={s.status === "signed" ? "default" : "secondary"}>
                    {s.status === "signed"
                      ? "Signerad av kund"
                      : s.status === "viewed"
                        ? "Öppnad av kund"
                        : s.status === "cancelled"
                          ? "Avbruten"
                          : "Väntar"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/signera/${s.token}`,
                      );
                      toast.success("Länk kopierad");
                    }}
                  >
                    Kopiera länk
                  </Button>
                  {s.status !== "signed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await callResendSigning({ data: { id: s.id } });
                          toast.success("Påminnelse skickad");
                          void loadSignings();
                        } catch (e: any) {
                          toast.error(e?.message ?? "Kunde inte skicka");
                        }
                      }}
                    >
                      <Send className="mr-1 h-3.5 w-3.5" />
                      Skicka igen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const res = await callSigningPdf({
                          data: { id: s.id, signed: s.status === "signed" },
                        });
                        window.open(res.url, "_blank", "noopener,noreferrer");
                      } catch {
                        toast.error("Kunde inte öppna PDF");
                      }
                    }}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    PDF
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
