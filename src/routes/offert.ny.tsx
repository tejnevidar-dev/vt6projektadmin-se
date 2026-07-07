import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, FileDown, Loader2 } from "lucide-react";
import {
  generateManualOffer,
  type OfferInput,
  type OfferRow,
  type OfferVillkorSektion,
} from "@/lib/offer-manual.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/offert/ny")({
  head: () => ({
    meta: [{ title: "Ny offert – RoslagsTak" }],
  }),
  component: OffertNyPage,
});

const STANDARD_INTRO = "Vi tackar för er förfrågan och offererar enligt följande:";

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

function OffertNyPage() {
  const navigate = useNavigate();
  const call = useServerFn(generateManualOffer);
  const [loading, setLoading] = useState(false);

  // Meta
  const [offertnr, setOffertnr] = useState(
    `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const [offertdatum, setOffertdatum] = useState(todayISO());
  const [giltigTom, setGiltigTom] = useState(plusDaysISO(30));
  const [betalningsvillkor, setBetalningsvillkor] = useState("10 dagar netto");

  // Kund
  const [kundNamn, setKundNamn] = useState("");
  const [objektadress, setObjektadress] = useState("");
  const [telefon, setTelefon] = useState("");
  const [mail, setMail] = useState("");
  const [fastighetsbeteckning, setFastighetsbeteckning] = useState("");

  // Intro
  const [intro, setIntro] = useState(STANDARD_INTRO);

  // Rader
  const [rader, setRader] = useState<OfferRow[]>([{ radnr: 10, beskrivning: "" }]);
  const addRad = () =>
    setRader((rs) => [...rs, { radnr: (rs[rs.length - 1]?.radnr ?? 0) + 10, beskrivning: "" }]);
  const removeRad = (i: number) =>
    setRader((rs) => rs.filter((_, idx) => idx !== i));
  const updateRad = (i: number, patch: Partial<OfferRow>) =>
    setRader((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const renumberRader = () =>
    setRader((rs) => rs.map((r, i) => ({ ...r, radnr: (i + 1) * 10 })));

  // Belopp
  const [entreprenadpris, setEntreprenadpris] = useState<number>(0);
  const [materialkostnad, setMaterialkostnad] = useState<number>(0);
  const [momsProcent, setMomsProcent] = useState<number>(25);
  const [rotBelopp, setRotBelopp] = useState<number>(0);
  const [rotEtikett, setRotEtikett] = useState<string>("");

  const totals = useMemo(() => {
    const moms = Math.round((entreprenadpris * momsProcent) / 100);
    const totalInkl = entreprenadpris + moms;
    const attBetala = totalInkl - rotBelopp;
    return { moms, totalInkl, attBetala };
  }, [entreprenadpris, momsProcent, rotBelopp]);

  // Noteringar
  const [noteringarText, setNoteringarText] = useState("");
  // Villkor
  const [villkor, setVillkor] = useState<OfferVillkorSektion[]>(STANDARD_VILLKOR);
  const addVillkor = () =>
    setVillkor((v) => [...v, { rubrik: "", brodtext: "" }]);
  const updateVillkor = (i: number, patch: Partial<OfferVillkorSektion>) =>
    setVillkor((v) => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeVillkor = (i: number) =>
    setVillkor((v) => v.filter((_, idx) => idx !== i));

  const handleGenerate = async () => {
    if (!kundNamn.trim()) {
      toast.error("Ange kundnamn");
      return;
    }
    const cleanRader = rader
      .filter((r) => r.beskrivning.trim())
      .map((r) => ({ radnr: r.radnr, beskrivning: r.beskrivning.trim() }));
    if (cleanRader.length === 0) {
      toast.error("Lägg till minst en rad med beskrivning");
      return;
    }
    const noteringarArr = noteringarText
      .split(/\n+/)
      .map((n) => n.trim())
      .filter(Boolean);
    const payload: OfferInput = {
      offertnr,
      offertdatum,
      giltigTom,
      betalningsvillkor,
      kundNamn,
      objektadress,
      telefon,
      mail,
      fastighetsbeteckning,
      intro,
      rader: cleanRader,
      entreprenadprisExklMoms: entreprenadpris,
      materialkostnad,
      momsProcent,
      rotBelopp,
      rotEtikett: rotEtikett.trim(),
      noteringar: noteringarArr,
      villkor: villkor.filter((v) => v.rubrik.trim() || v.brodtext.trim()),
    };
    setLoading(true);
    try {
      const res = await call({ data: payload });
      // Decode base64 → blob → download
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
      toast.success("Offert genererad");
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte generera offert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="Ny offert"
      description="Fyll i uppgifter och generera en PDF-offert enligt RoslagsTaks mall."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            Avbryt
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Offertuppgifter</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Offertnr</Label>
              <Input value={offertnr} onChange={(e) => setOffertnr(e.target.value)} />
            </div>
            <div>
              <Label>Betalningsvillkor</Label>
              <Input
                value={betalningsvillkor}
                onChange={(e) => setBetalningsvillkor(e.target.value)}
              />
            </div>
            <div>
              <Label>Offertdatum</Label>
              <Input
                type="date"
                value={offertdatum}
                onChange={(e) => setOffertdatum(e.target.value)}
              />
            </div>
            <div>
              <Label>Giltig tom</Label>
              <Input type="date" value={giltigTom} onChange={(e) => setGiltigTom(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kund</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Namn</Label>
              <Input value={kundNamn} onChange={(e) => setKundNamn(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Objektadress</Label>
              <Input value={objektadress} onChange={(e) => setObjektadress(e.target.value)} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={telefon} onChange={(e) => setTelefon(e.target.value)} />
            </div>
            <div>
              <Label>Mail</Label>
              <Input value={mail} onChange={(e) => setMail(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Fastighetsbeteckning</Label>
              <Input
                value={fastighetsbeteckning}
                onChange={(e) => setFastighetsbeteckning(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Specifikation (rader)</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={renumberRader}>
              Numrera om
            </Button>
            <Button size="sm" onClick={addRad}>
              <Plus className="mr-1 h-4 w-4" /> Lägg till rad
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2">
            <Label>Introduktionstext</Label>
            <Input value={intro} onChange={(e) => setIntro(e.target.value)} />
          </div>
          <div className="space-y-2">
            {rader.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <Input
                  className="w-20"
                  type="number"
                  value={r.radnr}
                  onChange={(e) => updateRad(i, { radnr: Number(e.target.value) })}
                />
                <Textarea
                  className="flex-1 min-h-[38px]"
                  rows={1}
                  placeholder="Beskrivning av arbetet"
                  value={r.beskrivning}
                  onChange={(e) => updateRad(i, { beskrivning: e.target.value })}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeRad(i)}
                  disabled={rader.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Belopp</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Entreprenadpris exkl. moms (kr)</Label>
            <Input
              type="number"
              value={entreprenadpris}
              onChange={(e) => setEntreprenadpris(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Materialkostnad (kr)</Label>
            <Input
              type="number"
              value={materialkostnad}
              onChange={(e) => setMaterialkostnad(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Moms %</Label>
            <Input
              type="number"
              value={momsProcent}
              onChange={(e) => setMomsProcent(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>ROT-avdrag (kr) – 0 om ej tillämpligt</Label>
            <Input
              type="number"
              value={rotBelopp}
              onChange={(e) => setRotBelopp(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>ROT-etikett (t.ex. "(2 ägare)")</Label>
            <Input
              placeholder="(2 ägare)"
              value={rotEtikett}
              onChange={(e) => setRotEtikett(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 rounded-md border p-3 text-sm bg-muted/30">
            <div className="flex justify-between">
              <span>Moms {momsProcent} %</span>
              <span>{totals.moms.toLocaleString("sv-SE")} kr</span>
            </div>
            <div className="flex justify-between">
              <span>Totalt inkl. moms</span>
              <span>{totals.totalInkl.toLocaleString("sv-SE")} kr</span>
            </div>
            {rotBelopp > 0 && (
              <div className="flex justify-between font-semibold">
                <span>Att betala efter ROT</span>
                <span>{totals.attBetala.toLocaleString("sv-SE")} kr</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Övriga noteringar</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            placeholder="En punkt per rad – renderas som punktlista."
            value={noteringarText}
            onChange={(e) => setNoteringarText(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card className="mt-4 mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Övriga villkor</CardTitle>
          <Button size="sm" onClick={addVillkor}>
            <Plus className="mr-1 h-4 w-4" /> Lägg till villkor
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {villkor.map((v, i) => (
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
    </AppShell>
  );
}
