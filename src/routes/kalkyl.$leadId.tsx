import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  Trash2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { analyzeRoofImages } from "@/lib/roof-analysis.functions";
import {
  computeCalc,
  formatSek,
  type CalcInput,
  type PlatItem,
  type PriceRow,
} from "@/lib/calc-engine";
import { useUserRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/kalkyl/$leadId")({
  component: () => (
    <RequireAuth>
      <KalkylPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Kalkyl & offert – admin.vt6" }] }),
});

const DEFAULT_TIMPRIS = 650;
const DEFAULT_MARGINAL = 15;

type UploadedImage = {
  id: string;
  name: string;
  dataUrl: string;
  size: number;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Kunde inte läsa fil"));
    r.readAsDataURL(file);
  });
}

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

  const materialRows = useMemo(
    () => priceRows.filter((r) => r.category === "material"),
    [priceRows],
  );

  // ---- UI state ----
  const [materialKey, setMaterialKey] = useState<string>("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [analysis, setAnalysis] = useState<{
    roofAreaKvm: number;
    ranndalarMeter: number;
    platItems: PlatItem[];
    arbeteTimmar: number;
  }>({ roofAreaKvm: 0, ranndalarMeter: 0, platItems: [], arbeteTimmar: 0 });
  const [hydratedFromExisting, setHydratedFromExisting] = useState(false);
  const [addPlatKey, setAddPlatKey] = useState<string>("");

  const fileInput = useRef<HTMLInputElement>(null);

  // När en tidigare kalkyl finns – förifyll formuläret en gång
  useMemo(() => {
    if (existing && !hydratedFromExisting) {
      setMaterialKey(existing.material_key ?? "");
      setAnalysis({
        roofAreaKvm: Number(existing.roof_area_kvm) || 0,
        ranndalarMeter: Number(existing.ranndalar_meter) || 0,
        platItems: (existing.plat_items ?? []) as PlatItem[],
        arbeteTimmar: Number(existing.arbete_timmar) || 0,
      });
      setNotes(existing.notes ?? "");
      setHydratedFromExisting(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const calcInput: CalcInput | null = useMemo(() => {
    if (!materialKey) return null;
    return {
      roofAreaKvm: analysis.roofAreaKvm,
      materialKey,
      ranndalarMeter: analysis.ranndalarMeter,
      platItems: analysis.platItems,
      tillagg: [],
      arbeteTimmar: analysis.arbeteTimmar,
      arbeteTimpris: DEFAULT_TIMPRIS,
      marginalProcent: DEFAULT_MARGINAL,
      rotAvdrag: true,
    };
  }, [analysis, materialKey]);

  const result = useMemo(
    () => (calcInput ? computeCalc(calcInput, priceRows as PriceRow[]) : null),
    [calcInput, priceRows],
  );

  // AI-granskning: resultatet läggs i "pending"-läge – användaren måste
  // bekräfta/rätta måtten innan de tillämpas och priset räknas ut.
  const [pendingReview, setPendingReview] = useState<{
    roofAreaKvm: number;
    ranndalarMeter: number;
    platItems: PlatItem[];
    arbeteTimmar: number;
    notes: string;
  } | null>(null);

  const analyzeFn = useServerFn(analyzeRoofImages);
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!materialKey) throw new Error("Välj taktyp först");
      if (images.length === 0) throw new Error("Ladda upp minst en bild med mått");
      return analyzeFn({
        data: {
          materialKey,
          images: images.map((i) => ({ dataUrl: i.dataUrl })),
        },
      });
    },
    onSuccess: (out) => {
      setPendingReview({
        roofAreaKvm: out.roofAreaKvm,
        ranndalarMeter: out.ranndalarMeter,
        platItems: out.platItems as PlatItem[],
        arbeteTimmar: out.arbeteTimmar,
        notes: out.notes ?? "",
      });
      toast.success("AI klar – granska och rätta måtten innan du bekräftar");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "AI-analys misslyckades"),
  });

  const applyReview = async (approved: {
    roofAreaKvm: number;
    ranndalarMeter: number;
    platItems: PlatItem[];
    arbeteTimmar: number;
    notes: string;
  }) => {
    const nextAnalysis = {
      roofAreaKvm: approved.roofAreaKvm,
      ranndalarMeter: approved.ranndalarMeter,
      platItems: approved.platItems,
      arbeteTimmar: approved.arbeteTimmar,
    };
    setAnalysis(nextAnalysis);
    setNotes(approved.notes);
    setPendingReview(null);

    const nextInput: CalcInput = {
      ...nextAnalysis,
      materialKey,
      tillagg: [],
      arbeteTimpris: DEFAULT_TIMPRIS,
      marginalProcent: DEFAULT_MARGINAL,
      rotAvdrag: true,
    };
    const nextResult = computeCalc(nextInput, priceRows as PriceRow[]);
    try {
      await upsertCalculation({
        leadId,
        calc: nextInput,
        result: nextResult,
        notes: approved.notes || null,
      });
      qc.invalidateQueries({ queryKey: ["calculation", leadId] });
      toast.success(`Pris uppdaterat: ${formatSek(nextResult.total)} inkl. moms`);
    } catch (e) {
      toast.error(
        "Kunde inte spara: " + (e instanceof Error ? e.message : "okänt fel"),
      );
    }
  };



  const generateFn = useServerFn(generateOffer);
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!calcInput || !result) throw new Error("Ingen kalkyl att generera från");
      // säkerställ att senaste kalkyl är sparad
      await upsertCalculation({ leadId, calc: calcInput, result, notes });
      return generateFn({ data: { leadId } });
    },
    onSuccess: async (out) => {
      toast.success(`Offert v${out.version} skapad som draft`);
      await refetchOffers();
      if (out.signedUrl) window.open(out.signedUrl, "_blank", "noopener,noreferrer");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Kunde inte skapa offert"),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: UploadedImage[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: inte en bild`);
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name}: max 8 MB`);
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(f);
        accepted.push({
          id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          dataUrl,
          size: f.size,
        });
      } catch {
        toast.error(`Kunde inte läsa ${f.name}`);
      }
    }
    setImages((prev) => [...prev, ...accepted].slice(0, 10));
  };

  const removeImage = (id: string) =>
    setImages((prev) => prev.filter((i) => i.id !== id));

  if (rolesLoading || pricesLoading || calcLoading) {
    return (
      <AppShell title="Kalkyl & offert">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
        </div>
      </AppShell>
    );
  }

  if (!canUse) {
    return (
      <AppShell title="Kalkyl & offert">
        <p className="text-sm text-muted-foreground">
          Du saknar behörighet att skapa kalkyler och offerter.
        </p>
      </AppShell>
    );
  }

  const platLabelFor = (key: string) =>
    priceRows.find((r) => r.key === key)?.label ?? key;
  const platUnitFor = (key: string) =>
    priceRows.find((r) => r.key === key)?.unit ?? "";

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
        <div className="space-y-6">
          {/* 1. Taktyp */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-1 text-sm font-semibold">1. Välj taktyp</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              AI:n använder taktypen för att rekommendera rätt plåtdetaljer.
            </p>
            <Select value={materialKey} onValueChange={setMaterialKey}>
              <SelectTrigger>
                <SelectValue placeholder="Välj material" />
              </SelectTrigger>
              <SelectContent>
                {materialRows.map((r) => (
                  <SelectItem key={r.id} value={r.key}>
                    {r.label} – {formatSek(r.unit_price)}/{r.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* 2. Bilder */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-1 text-sm font-semibold">
              2. Ladda upp bilder med mått <span className="font-normal text-muted-foreground">(valfritt)</span>
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              AI:n tolkar måtten och förfyller formuläret nedan. Du kan även hoppa över detta steg och fylla i allt manuellt. Max 10 bilder, 8 MB per bild.
            </p>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 py-8 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-muted/40"
            >
              <Upload className="h-6 w-6" />
              <span>Klicka för att välja bilder</span>
              <span className="text-xs">eller släpp filer här</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative overflow-hidden rounded-md border border-border bg-muted/30"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="h-32 w-full object-cover"
                    />
                    <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                      <span className="truncate text-muted-foreground" title={img.name}>
                        {img.name}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removeImage(img.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="mt-4 w-full"
              onClick={() => analyzeMutation.mutate()}
              disabled={
                analyzeMutation.isPending || !materialKey || images.length === 0
              }
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Analysera bilder & räkna ut pris
            </Button>
          </section>

          {/* 3. Redigerbart formulär (förfylls av AI eller ifylls manuellt) */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">3. Mått & arbete</h3>
              <span className="text-xs text-muted-foreground">
                Redigera fritt – AI-förslagen är bara utgångsläge
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Takyta (kvm)"
                value={analysis.roofAreaKvm}
                onChange={(v) => setAnalysis((a) => ({ ...a, roofAreaKvm: v }))}
              />
              <NumberField
                label="Ränndalar (m)"
                value={analysis.ranndalarMeter}
                onChange={(v) => setAnalysis((a) => ({ ...a, ranndalarMeter: v }))}
              />
              <NumberField
                label="Arbetstimmar"
                value={analysis.arbeteTimmar}
                onChange={(v) => setAnalysis((a) => ({ ...a, arbeteTimmar: v }))}
              />
            </div>

            <div className="mt-5">
              <Label className="text-xs text-muted-foreground">Plåtdetaljer</Label>
              {analysis.platItems.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Inga plåtdetaljer valda. Lägg till nedan.
                </p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  {analysis.platItems.map((p, i) => (
                    <div
                      key={`${p.key}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-sm"
                    >
                      <span className="flex-1 truncate">{platLabelFor(p.key)}</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={p.quantity}
                        onChange={(e) => {
                          const q = Number(e.target.value) || 0;
                          setAnalysis((a) => ({
                            ...a,
                            platItems: a.platItems.map((it, idx) =>
                              idx === i ? { ...it, quantity: q } : it,
                            ),
                          }));
                        }}
                        className="h-8 w-24"
                      />
                      <span className="w-8 text-xs text-muted-foreground">
                        {platUnitFor(p.key)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() =>
                          setAnalysis((a) => ({
                            ...a,
                            platItems: a.platItems.filter((_, idx) => idx !== i),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Lägg till plåtdetalj */}
              <div className="mt-2 flex gap-2">
                <Select value={addPlatKey} onValueChange={setAddPlatKey}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Lägg till plåtdetalj…" />
                  </SelectTrigger>
                  <SelectContent>
                    {priceRows
                      .filter(
                        (r) =>
                          r.category === "plat" &&
                          r.key !== "ranndalar_meter" &&
                          !analysis.platItems.some((it) => it.key === r.key),
                      )
                      .map((r) => (
                        <SelectItem key={r.id} value={r.key}>
                          {r.label} ({formatSek(r.unit_price)}/{r.unit})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!addPlatKey}
                  onClick={() => {
                    if (!addPlatKey) return;
                    setAnalysis((a) => ({
                      ...a,
                      platItems: [...a.platItems, { key: addPlatKey, quantity: 1 }],
                    }));
                    setAddPlatKey("");
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Lägg till
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <Label className="text-xs text-muted-foreground">Anteckningar</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Interna anteckningar (fylls i av AI eller manuellt)"
              />
            </div>
          </section>
        </div>


        {/* Höger: summering + draft/offer */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Prisförslag</h3>
            {result ? (
              <div className="space-y-1.5 text-sm">
                {result.materialSum > 0 && (
                  <RowSum label="Material" value={result.materialSum} />
                )}
                {result.platSum > 0 && <RowSum label="Plåt" value={result.platSum} />}
                {result.arbeteSum > 0 && (
                  <RowSum label="Arbete" value={result.arbeteSum} />
                )}
                <div className="my-2 border-t border-border" />
                <RowSum label="Delsumma" value={result.subtotalPreMargin} />
                {result.marginalAmount > 0 && (
                  <RowSum
                    label={`Marginal (${DEFAULT_MARGINAL}%)`}
                    value={result.marginalAmount}
                    muted
                  />
                )}
                <RowSum label="Exkl. moms" value={result.subtotal} />
                <RowSum label="Moms 25 %" value={result.moms} muted />
                <div className="my-2 border-t border-border" />
                <RowSum label="Totalt inkl. moms" value={result.total} bold />
                {result.rotBelopp > 0 && (
                  <>
                    <RowSum label="ROT-avdrag" value={-result.rotBelopp} muted />
                    <div className="my-2 border-t border-border" />
                    <RowSum
                      label="Att betala"
                      value={result.attBetala}
                      bold
                      big
                    />
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Kör AI-analysen för att se prisförslag.
              </p>
            )}

            <Button
              className="mt-5 w-full"
              onClick={() => generateMutation.mutate()}
              disabled={
                generateMutation.isPending || !result || result.subtotal <= 0
              }
            >
              {generateMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              Generera offert PDF
            </Button>
          </div>

          {offers.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Offerter</h3>
              <div className="space-y-2">
                {offers.map((o) => (
                  <OfferItem key={o.id} offer={o} onChanged={refetchOffers} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function RowSum({
  label,
  value,
  muted,
  bold,
  big,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
  big?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${muted ? "text-muted-foreground" : ""} ${
        bold ? "font-semibold" : ""
      } ${big ? "text-base" : ""}`}
    >
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

function OfferItem({
  offer,
  onChanged,
}: {
  offer: OfferRow;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const openPdf = async () => {
    setBusy(true);
    try {
      const url = await getOfferPdfSignedUrl(offer.pdf_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte öppna PDF");
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (s: OfferRow["status"]) => {
    setBusy(true);
    try {
      await updateOfferStatus(offer.id, s);
      toast.success("Status uppdaterad");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Offert v{offer.version}</div>
          <div className="text-xs text-muted-foreground">
            {formatSek(Number(offer.total_amount))} ·{" "}
            {new Date(offer.created_at).toLocaleDateString("sv-SE")}
          </div>
        </div>
        <Badge variant="outline">{STATUS_LABEL[offer.status]}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={openPdf} disabled={busy}>
          <ExternalLink className="mr-1 h-3 w-3" /> Öppna
        </Button>
        {offer.status === "draft" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStatus("skickad")}
            disabled={busy}
          >
            Markera skickad
          </Button>
        )}
        {offer.status !== "accepterad" && offer.status !== "avvisad" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("accepterad")}
              disabled={busy}
            >
              Accepterad
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("avvisad")}
              disabled={busy}
            >
              Avvisad
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
