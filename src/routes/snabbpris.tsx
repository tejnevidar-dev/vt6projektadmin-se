import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Home, Droplets, User, FileDown, RotateCcw, Check } from "lucide-react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SelectCustomerDialog, type CustomerPick } from "@/components/SelectCustomerDialog";
import { createDraft } from "@/lib/offer-drafts";
import { supabase } from "@/integrations/supabase/client";
import {
  computeQuickPrice,
  emptyQuickInput,
  fetchQuickPriceItems,
  fetchQuickPriceSettings,
  formatKr,
  type QuickPriceInput,
  type QuickService,
} from "@/lib/quick-price";

export const Route = createFileRoute("/snabbpris")({
  component: () => (
    <RequireAuth>
      <SnabbprisPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Snabbpris – takbyte & taktvätt | admin.vt6" },
      {
        name: "description",
        content:
          "Räkna fram pris för takbyte och taktvätt direkt på plats – ange takyta, våningar och tillval så får du pris med ROT.",
      },
      { property: "og:title", content: "Snabbpris – takbyte & taktvätt" },
      {
        property: "og:description",
        content: "Generera pris på plats utan kalkylkompetens: takyta, tillval och ROT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SnabbprisPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState<QuickPriceInput>(() => emptyQuickInput("takbyte"));
  const [customer, setCustomer] = useState<CustomerPick | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["quick-price-items"],
    queryFn: fetchQuickPriceItems,
  });
  const { data: settings } = useQuery({
    queryKey: ["quick-price-settings"],
    queryFn: fetchQuickPriceSettings,
  });

  const set = <K extends keyof QuickPriceInput>(k: K, v: QuickPriceInput[K]) =>
    setInput((f) => ({ ...f, [k]: v }));

  const forService = (kind: string) =>
    items.filter((i) => i.is_active && i.service === input.service && i.kind === kind);

  const materials = forService("material");
  const arbeten = forService("arbete");
  const svarigheter = forService("svarighet");
  const tillvalItems = forService("tillval");

  // Sätt förval när prislistan laddats / tjänst byts
  useEffect(() => {
    if (isLoading) return;
    setInput((f) => ({
      ...f,
      materialKey:
        f.materialKey && materials.some((m) => m.key === f.materialKey)
          ? f.materialKey
          : (materials[0]?.key ?? null),
      arbeteKey:
        f.arbeteKey && arbeten.some((m) => m.key === f.arbeteKey)
          ? f.arbeteKey
          : (arbeten[0]?.key ?? null),
      svarighetKey:
        f.svarighetKey && svarigheter.some((m) => m.key === f.svarighetKey)
          ? f.svarighetKey
          : (svarigheter[0]?.key ?? null),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, input.service, items.length]);

  const result = useMemo(
    () => computeQuickPrice(input, items, settings ?? {
      id: 1, moms_procent: 25, rot_procent: 30, rot_tak_per_agare: 50000, taktvatt_min_pris: 12000,
    }),
    [input, items, settings],
  );

  const switchService = (service: QuickService) => {
    setInput({ ...emptyQuickInput(service), rot: input.rot, antalAgare: input.antalAgare });
  };

  const toggleTillval = (key: string, on: boolean, unit: string) => {
    setInput((f) => {
      const next = { ...f.tillval };
      if (on) next[key] = unit === "st" ? 1 : 1;
      else delete next[key];
      return { ...f, tillval: next };
    });
  };

  const setTillvalQty = (key: string, qty: number) =>
    setInput((f) => ({ ...f, tillval: { ...f.tillval, [key]: Math.max(1, qty) } }));

  const arbetstext = () => {
    const rows = result.lines.map((l) => `${l.label} (${l.detail})`);
    if (result.svarighetProcent > 0) {
      const s = svarigheter.find((x) => x.key === input.svarighetKey);
      rows.push(`Tillägg åtkomst/höjd: ${s?.label ?? ""} (+${result.svarighetProcent} %)`);
    }
    return rows.join("\n");
  };

  const handleSaveAndOffer = async () => {
    if (result.total <= 0) {
      toast.error("Ange takyta först");
      return;
    }
    setSaving(true);
    try {
      const serviceLabel = input.service === "takbyte" ? "Takbyte" : "Taktvätt";
      // 1. Spara ordervärde/materialkostnad på kunden om en kund är vald
      if (customer) {
        const { error } = await supabase
          .from("leads")
          .update({
            price: result.total,
            material_cost: Math.round(result.materialSum),
            rot_eligible: input.rot,
          })
          .eq("id", customer.leadId);
        if (error) throw error;
      }

      // 2. Skapa offertutkast som kan öppnas på Offert & Kalkyl
      const payload = {
        kundNamn: customer?.name ?? "",
        objektadress: customer?.address ?? "",
        telefon: customer?.phone ?? "",
        mail: customer?.email ?? "",
        fastighetsbeteckning: customer?.propertyDesignation ?? "",
        arbetstext: arbetstext(),
        rader: result.lines.map((l, i) => ({ radnr: (i + 1) * 10, beskrivning: `${l.label} – ${l.detail}` })),
        entreprenadpris: result.exMoms,
        materialkostnad: Math.round(result.materialSum),
        momsProcent: settings?.moms_procent ?? 25,
        inkluderaRot: input.rot,
        antalAgare: input.antalAgare,
        rotManuell: true,
        rotManuelltBelopp: result.rotBelopp,
        leadId: customer?.leadId ?? null,
      };
      await createDraft({
        label: `${serviceLabel} – ${customer?.name ?? `${input.areaKvm} kvm`}`,
        payload,
        leadId: customer?.leadId ?? null,
        kind: "offer",
      });
      toast.success("Sparat – utkastet finns på Offert & Kalkyl");
      navigate({ to: "/offert/ny" });
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Snabbpris"
      description="Räkna fram pris för takbyte och taktvätt direkt hos kunden – ingen kalkylvana behövs."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setInput(emptyQuickInput(input.service)); setCustomer(null); }}>
            <RotateCcw className="mr-1 h-4 w-4" /> Börja om
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <User className="mr-1 h-4 w-4" /> {customer ? "Byt kund" : "Välj kund"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* Tjänst */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">1. Vilken tjänst?</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {([
                { key: "takbyte" as const, label: "Takbyte", icon: Home },
                { key: "taktvatt" as const, label: "Taktvätt", icon: Droplets },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => switchService(key)}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
                    input.service === key
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                  {input.service === key && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Yta & utförande */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">2. Takyta och utförande</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="area">Takyta (kvm)</Label>
                <Input
                  id="area"
                  inputMode="numeric"
                  className="text-lg"
                  value={input.areaKvm || ""}
                  onChange={(e) => set("areaKvm", Number(e.target.value.replace(/\s/g, "")) || 0)}
                  placeholder="t.ex. 140"
                />
              </div>

              <div className="space-y-1">
                <Label>Antal våningar / åtkomst</Label>
                <div className="flex flex-wrap gap-2">
                  {svarigheter.map((s) => (
                    <Button
                      key={s.key}
                      type="button"
                      size="sm"
                      variant={input.svarighetKey === s.key ? "default" : "outline"}
                      onClick={() => set("svarighetKey", s.key)}
                    >
                      {s.label}
                      {s.unit_price > 0 && (
                        <span className="ml-1 text-xs opacity-70">+{s.unit_price}%</span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {materials.length > 0 && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>{input.service === "takbyte" ? "Taktyp / material" : "Tvättmetod"}</Label>
                  <div className="flex flex-wrap gap-2">
                    {materials.map((m) => (
                      <Button
                        key={m.key}
                        type="button"
                        size="sm"
                        variant={input.materialKey === m.key ? "default" : "outline"}
                        onClick={() => set("materialKey", m.key)}
                      >
                        {m.label}
                        <span className="ml-1 text-xs opacity-70">{m.unit_price} kr/kvm</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {arbeten.length > 0 && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>Arbete</Label>
                  <div className="flex flex-wrap gap-2">
                    {arbeten.map((m) => (
                      <Button
                        key={m.key}
                        type="button"
                        size="sm"
                        variant={input.arbeteKey === m.key ? "default" : "outline"}
                        onClick={() => set("arbeteKey", m.key)}
                      >
                        {m.label}
                        <span className="ml-1 text-xs opacity-70">{m.unit_price} kr/kvm</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tillval */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">3. Tillval</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {tillvalItems.map((t) => {
                const on = input.tillval[t.key] != null;
                return (
                  <div
                    key={t.key}
                    className="flex items-center gap-3 rounded-md border border-border p-3"
                  >
                    <Checkbox
                      id={`tv-${t.key}`}
                      checked={on}
                      onCheckedChange={(v) => toggleTillval(t.key, Boolean(v), t.unit)}
                    />
                    <Label htmlFor={`tv-${t.key}`} className="flex-1 cursor-pointer">
                      {t.label}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {t.unit_price} kr/{t.unit}
                      </span>
                    </Label>
                    {on && t.unit === "st" && (
                      <Input
                        className="h-8 w-16"
                        inputMode="numeric"
                        value={input.tillval[t.key]}
                        onChange={(e) => setTillvalQty(t.key, Number(e.target.value) || 1)}
                      />
                    )}
                  </div>
                );
              })}
              {tillvalItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Inga tillval upplagda.</p>
              )}
            </CardContent>
          </Card>

          {/* ROT & justering */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">4. ROT och justering</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <Switch checked={input.rot} onCheckedChange={(v) => set("rot", v)} />
                <span className="text-sm">ROT-avdrag</span>
              </div>
              <div className="space-y-1">
                <Label>Antal ägare</Label>
                <Input
                  inputMode="numeric"
                  value={input.antalAgare}
                  onChange={(e) => set("antalAgare", Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1">
                <Label>Rabatt (kr ex moms)</Label>
                <Input
                  inputMode="numeric"
                  value={input.rabatt || ""}
                  onChange={(e) => set("rabatt", Number(e.target.value.replace(/\s/g, "")) || 0)}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resultat */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pris till kund</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <div className="rounded-md bg-muted/50 p-2 text-xs">
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-muted-foreground">{customer.address}</div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Ingen kund vald ännu.</p>
              )}

              <div className="space-y-1 text-sm">
                {result.lines.map((l) => (
                  <div key={l.key} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{l.label}</span>
                    <span>{formatKr(l.amount)}</span>
                  </div>
                ))}
                {result.svarighetAmount > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      Åtkomst/höjd +{result.svarighetProcent}%
                    </span>
                    <span>{formatKr(result.svarighetAmount)}</span>
                  </div>
                )}
                {result.rabatt > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Rabatt</span>
                    <span>-{formatKr(result.rabatt)}</span>
                  </div>
                )}
              </div>

              {result.minimumApplied && (
                <Badge variant="secondary">Minimipris för taktvätt tillämpat</Badge>
              )}

              <div className="border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exkl. moms</span>
                  <span>{formatKr(result.exMoms)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moms</span>
                  <span>{formatKr(result.moms)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold">
                  <span>Totalt inkl. moms</span>
                  <span>{formatKr(result.total)}</span>
                </div>
                {input.rot && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>ROT-avdrag</span>
                    <span>-{formatKr(result.rotBelopp)}</span>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-primary/10 p-3">
                <div className="text-xs text-muted-foreground">Kunden betalar</div>
                <div className="text-2xl font-bold">{formatKr(result.attBetala)}</div>
              </div>

              <Button className="w-full" onClick={handleSaveAndOffer} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Spara på kund & skapa offert
              </Button>
              {!customer && (
                <p className="text-[11px] text-muted-foreground">
                  Utan vald kund sparas bara ett offertutkast.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SelectCustomerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(pick) => {
          setCustomer(pick);
          setPickerOpen(false);
        }}
      />
    </AppShell>
  );
}
