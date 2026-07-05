import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save, FileText, Loader2, Plus, Trash2, ExternalLink, Download } from "lucide-react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchActivePriceList } from "@/lib/price-list-api";
import {
  fetchCalculationForLead,
  upsertCalculation,
  fetchOffersForLead,
  updateOfferStatus,
  type OfferRow,
} from "@/lib/calculations-api";
import { getOfferPdfSignedUrl } from "@/lib/leads-api";
import { generateOffer } from "@/lib/offers.functions";
import { computeCalc, formatSek, type CalcInput, type PlatItem, type TillaggRow, type PriceRow } from "@/lib/calc-engine";
import { useUserRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/kalkyl/$leadId")({
  component: () => (
    <RequireAuth>
      <KalkylPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Kalkyl & offert – admin.vt6" }] }),
});

function KalkylPage() {
  const { leadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSaljare, loading: rolesLoading } = useUserRoles();
  const canUse = isAdmin || isSaljare;

  const { data: lead } = useQuery({
    queryKey: ["lead-min", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, property:properties(address, municipality)")
        .eq("id", leadId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: priceRows = [], isLoading: pricesLoading } = useQuery({
    queryKey: ["price-list-active"],
    queryFn: fetchActivePriceList,
  });

  const { data: existing, isLoading: calcLoading } = useQuery({
    queryKey: ["calculation", leadId],
    queryFn: () => fetchCalculationForLead(leadId),
  });

  const { data: offers = [], refetch: refetchOffers } = useQuery({
    queryKey: ["offers", leadId],
    queryFn: () => fetchOffersForLead(leadId),
  });

  // Form state
  const [calc, setCalc] = useState<CalcInput>({
    roofAreaKvm: 0,
    materialKey: null,
    ranndalarMeter: 0,
    platItems: [],
    tillagg: [],
    arbeteTimmar: 0,
    arbeteTimpris: 650,
    marginalProcent: 15,
    rotAvdrag: true,
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (existing) {
      setCalc({
        roofAreaKvm: Number(existing.roof_area_kvm),
        materialKey: existing.material_key,
        ranndalarMeter: Number(existing.ranndalar_meter),
        platItems: (existing.plat_items ?? []) as PlatItem[],
        tillagg: (existing.tillagg ?? []) as TillaggRow[],
        arbeteTimmar: Number(existing.arbete_timmar),
        arbeteTimpris: Number(existing.arbete_timpris),
        marginalProcent: Number(existing.marginal_procent),
        rotAvdrag: Boolean(existing.rot_avdrag),
      });
      setNotes(existing.notes ?? "");
    }
  }, [existing]);

  const materialRows = priceRows.filter((r) => r.category === "material");
  const platRows = priceRows.filter((r) => r.category === "plat" && r.key !== "ranndalar_meter");

  const result = useMemo(() => computeCalc(calc, priceRows as PriceRow[]), [calc, priceRows]);

  const saveMutation = useMutation({
    mutationFn: () => upsertCalculation({ leadId, calc, result, notes }),
    onSuccess: () => {
      toast.success("Kalkyl sparad");
      qc.invalidateQueries({ queryKey: ["calculation", leadId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Kunde inte spara"),
  });

  const generateFn = useServerFn(generateOffer);
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Spara först
      await upsertCalculation({ leadId, calc, result, notes });
      return generateFn({ data: { leadId } });
    },
    onSuccess: async (out) => {
      toast.success(`Offert v${out.version} skapad`);
      await refetchOffers();
      if (out.signedUrl) window.open(out.signedUrl, "_blank", "noopener,noreferrer");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Kunde inte skapa offert"),
  });

  const togglePlat = (key: string, checked: boolean) => {
    setCalc((c) => {
      const others = c.platItems.filter((p) => p.key !== key);
      return checked ? { ...c, platItems: [...others, { key, quantity: 1 }] } : { ...c, platItems: others };
    });
  };
  const setPlatQty = (key: string, quantity: number) => {
    setCalc((c) => ({
      ...c,
      platItems: c.platItems.map((p) => (p.key === key ? { ...p, quantity } : p)),
    }));
  };
  const addTillagg = () => setCalc((c) => ({ ...c, tillagg: [...c.tillagg, { label: "", quantity: 1, unit_price: 0 }] }));
  const updateTillagg = (i: number, patch: Partial<TillaggRow>) =>
    setCalc((c) => ({ ...c, tillagg: c.tillagg.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));
  const removeTillagg = (i: number) =>
    setCalc((c) => ({ ...c, tillagg: c.tillagg.filter((_, idx) => idx !== i) }));

  if (rolesLoading || pricesLoading || calcLoading) {
    return (
      <AppShell title="Kalkyl & offert">
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Laddar…</div>
      </AppShell>
    );
  }

  if (!canUse) {
    return (
      <AppShell title="Kalkyl & offert">
        <p className="text-sm text-muted-foreground">Du saknar behörighet att skapa kalkyler och offerter.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={lead ? `Kalkyl – ${lead.name}` : "Kalkyl & offert"}
      description={lead?.property?.address ?? undefined}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/leads" })}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Tillbaka
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Vänster: input */}
        <div className="space-y-6">
          {/* Tak & material */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">Takyta & material</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Takyta (kvm)</Label>
                <Input type="number" min={0} value={calc.roofAreaKvm || ""} onChange={(e) => setCalc({ ...calc, roofAreaKvm: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Material</Label>
                <Select value={calc.materialKey ?? ""} onValueChange={(v) => setCalc({ ...calc, materialKey: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Välj material" /></SelectTrigger>
                  <SelectContent>
                    {materialRows.map((r) => (
                      <SelectItem key={r.id} value={r.key}>{r.label} – {formatSek(r.unit_price)}/{r.unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Plåtarbeten */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">Plåtarbeten</h3>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Ränndalar (meter)</Label>
                <Input type="number" min={0} value={calc.ranndalarMeter || ""} onChange={(e) => setCalc({ ...calc, ranndalarMeter: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              {platRows.map((r) => {
                const item = calc.platItems.find((p) => p.key === r.key);
                const active = Boolean(item);
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                    <Switch checked={active} onCheckedChange={(v) => togglePlat(r.key, v)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{formatSek(r.unit_price)} / {r.unit}</div>
                    </div>
                    {active && (
                      <Input
                        type="number"
                        min={1}
                        className="w-24"
                        value={item?.quantity ?? 1}
                        onChange={(e) => setPlatQty(r.key, Number(e.target.value) || 1)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tillägg */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Extra rader</h3>
              <Button size="sm" variant="outline" onClick={addTillagg}><Plus className="mr-1 h-3.5 w-3.5" /> Lägg till</Button>
            </div>
            {calc.tillagg.length === 0 ? (
              <p className="text-xs text-muted-foreground">Använd för unika tillägg som inte finns i prislistan.</p>
            ) : (
              <div className="space-y-2">
                {calc.tillagg.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_100px_auto] gap-2">
                    <Input placeholder="Beskrivning" value={t.label} onChange={(e) => updateTillagg(i, { label: e.target.value })} />
                    <Input type="number" min={0} placeholder="Antal" value={t.quantity || ""} onChange={(e) => updateTillagg(i, { quantity: Number(e.target.value) || 0 })} />
                    <Input type="number" min={0} placeholder="À-pris" value={t.unit_price || ""} onChange={(e) => updateTillagg(i, { unit_price: Number(e.target.value) || 0 })} />
                    <Button size="icon" variant="ghost" onClick={() => removeTillagg(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Arbete + marginal */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">Arbete & marginal</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Arbetstimmar</Label>
                <Input type="number" min={0} value={calc.arbeteTimmar || ""} onChange={(e) => setCalc({ ...calc, arbeteTimmar: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Timpris (kr)</Label>
                <Input type="number" min={0} value={calc.arbeteTimpris || ""} onChange={(e) => setCalc({ ...calc, arbeteTimpris: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <Label>Marginal / påslag</Label>
                <span className="text-sm font-medium">{calc.marginalProcent}%</span>
              </div>
              <Slider min={0} max={50} step={1} value={[calc.marginalProcent]} onValueChange={(v) => setCalc({ ...calc, marginalProcent: v[0] })} />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
              <Switch checked={calc.rotAvdrag} onCheckedChange={(v) => setCalc({ ...calc, rotAvdrag: v })} />
              <div className="flex-1 text-sm">
                <div className="font-medium">ROT-avdrag</div>
                <div className="text-xs text-muted-foreground">30 % av arbetskostnaden inkl. moms</div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <Label>Interna anteckningar</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Syns bara internt, inte i offerten" />
          </section>
        </div>

        {/* Höger: totaler (sticky) */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Sammanställning</h3>
            <div className="space-y-1.5 text-sm">
              {result.materialSum > 0 && <RowSum label="Material" value={result.materialSum} />}
              {result.platSum > 0 && <RowSum label="Plåt" value={result.platSum} />}
              {result.tillaggSum > 0 && <RowSum label="Tillägg" value={result.tillaggSum} />}
              {result.arbeteSum > 0 && <RowSum label="Arbete" value={result.arbeteSum} />}
              <div className="my-2 border-t border-border" />
              <RowSum label="Delsumma" value={result.subtotalPreMargin} />
              {result.marginalAmount > 0 && <RowSum label={`Marginal (${calc.marginalProcent}%)`} value={result.marginalAmount} muted />}
              <RowSum label="Exkl. moms" value={result.subtotal} />
              <RowSum label="Moms 25 %" value={result.moms} muted />
              <div className="my-2 border-t border-border" />
              <RowSum label="Totalt inkl. moms" value={result.total} bold />
              {result.rotBelopp > 0 && (
                <>
                  <RowSum label="ROT-avdrag" value={-result.rotBelopp} muted />
                  <div className="my-2 border-t border-border" />
                  <RowSum label="Att betala" value={result.attBetala} bold big />
                </>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Spara kalkyl
              </Button>
              <Button className="w-full" variant="default" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || result.subtotal <= 0}>
                {generateMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                Generera offert PDF
              </Button>
            </div>
          </div>

          {offers.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Offerter</h3>
              <div className="space-y-2">
                {offers.map((o) => <OfferItem key={o.id} offer={o} onChanged={refetchOffers} />)}
              </div>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function RowSum({ label, value, muted, bold, big }: { label: string; value: number; muted?: boolean; bold?: boolean; big?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""} ${bold ? "font-semibold" : ""} ${big ? "text-base" : ""}`}>
      <span>{label}</span>
      <span>{formatSek(value)}</span>
    </div>
  );
}

const STATUS_LABEL: Record<OfferRow["status"], string> = {
  draft: "Utkast",
  skickad: "Skickad",
  accepterad: "Accepterad",
  avvisad: "Avvisad",
};

function OfferItem({ offer, onChanged }: { offer: OfferRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const openPdf = async () => {
    setBusy(true);
    try {
      const url = await getOfferPdfSignedUrl(offer.pdf_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte öppna PDF");
    } finally { setBusy(false); }
  };
  const setStatus = async (s: OfferRow["status"]) => {
    setBusy(true);
    try { await updateOfferStatus(offer.id, s); toast.success("Status uppdaterad"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Fel"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Offert v{offer.version}</div>
          <div className="text-xs text-muted-foreground">{formatSek(Number(offer.total_amount))} · {new Date(offer.created_at).toLocaleDateString("sv-SE")}</div>
        </div>
        <Badge variant="outline">{STATUS_LABEL[offer.status]}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={openPdf} disabled={busy}><ExternalLink className="mr-1 h-3 w-3" /> Öppna</Button>
        {offer.status === "draft" && <Button size="sm" variant="outline" onClick={() => setStatus("skickad")} disabled={busy}>Markera skickad</Button>}
        {offer.status !== "accepterad" && offer.status !== "avvisad" && (
          <>
            <Button size="sm" variant="outline" onClick={() => setStatus("accepterad")} disabled={busy}>Accepterad</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus("avvisad")} disabled={busy}>Avvisad</Button>
          </>
        )}
      </div>
    </div>
  );
}
