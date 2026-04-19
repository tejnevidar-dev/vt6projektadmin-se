import { useState, useMemo } from "react";
import { Sparkles, ArrowLeft, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIONS, MUNICIPALITIES } from "@/lib/types";

interface AiGenerateLeadsDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AiGenerateLeadsDialog({ open, onClose }: AiGenerateLeadsDialogProps) {
  const [region, setRegion] = useState<string>("");
  const [municipality, setMunicipality] = useState<string>("");
  const [count, setCount] = useState<number>(10);

  const municipalities = useMemo(() => (region ? MUNICIPALITIES[region] ?? [] : []), [region]);

  const reset = () => {
    setRegion("");
    setMunicipality("");
    setCount(10);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canGenerate = Boolean(region && municipality && count > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-generera leads
          </DialogTitle>
          <DialogDescription>
            Välj län och kommun för att hämta kontaktuppgifter till villaägare i området.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Län</label>
            <Select
              value={region}
              onValueChange={(v) => {
                setRegion(v);
                setMunicipality("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj län" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Kommun</label>
            <Select value={municipality} onValueChange={setMunicipality} disabled={!region}>
              <SelectTrigger>
                <SelectValue placeholder={region ? "Välj kommun" : "Välj län först"} />
              </SelectTrigger>
              <SelectContent>
                {municipalities.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {region && municipalities.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Inga kommuner registrerade för {region} ännu.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Antal leads att generera
              <span className="ml-1 text-xs font-normal text-muted-foreground">(max 500)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  setCount(Math.max(1, Math.min(500, n)));
                }}
                className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="range"
                min={1}
                max={500}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[10, 50, 100, 250, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                    count === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div className="text-card-foreground/80">
              <p className="font-medium">Datakälla saknas</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Inkoppling mot extern persondata-API (t.ex. Roaring) krävs för att hämta riktiga
                villaägare. UI:t är klart — anslut datakälla för att aktivera generering.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={handleClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Avbryt
          </Button>
          <Button disabled={!canGenerate} title="Datakälla ej ansluten">
            <Sparkles className="mr-2 h-4 w-4" />
            Generera {count} leads
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
