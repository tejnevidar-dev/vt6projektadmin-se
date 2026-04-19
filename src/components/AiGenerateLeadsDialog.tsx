import { useState } from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  generateRoofWashCandidates,
  createLeadsFromCandidates,
  type RoofWashCandidate,
} from "@/lib/ai-leads-api";

interface AiGenerateLeadsDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type Step = "config" | "loading" | "review" | "saving";

export function AiGenerateLeadsDialog({ open, onClose, onCreated }: AiGenerateLeadsDialogProps) {
  const [step, setStep] = useState<Step>("config");
  const [limit, setLimit] = useState<number>(10);
  const [candidates, setCandidates] = useState<RoofWashCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reset = () => {
    setStep("config");
    setCandidates([]);
    setSelected(new Set());
  };

  const handleClose = () => {
    if (step === "loading" || step === "saving") return;
    reset();
    onClose();
  };

  const handleGenerate = async () => {
    setStep("loading");
    try {
      const res = await generateRoofWashCandidates(limit);
      if (!res.candidates || res.candidates.length === 0) {
        toast.info(res.message ?? "Inga kandidater hittades");
        setStep("config");
        return;
      }
      setCandidates(res.candidates);
      setSelected(new Set(res.candidates.map((c) => c.property_id)));
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Något gick fel";
      toast.error(msg);
      setStep("config");
    }
  };

  const handleConfirm = async () => {
    const chosen = candidates.filter((c) => selected.has(c.property_id));
    if (chosen.length === 0) {
      toast.error("Välj minst en kandidat");
      return;
    }
    setStep("saving");
    try {
      const created = await createLeadsFromCandidates(chosen);
      toast.success(`${created.length} taktvätt-leads skapade`);
      onCreated();
      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kunde inte spara leads";
      toast.error(msg);
      setStep("review");
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "bg-success/10 text-success-foreground border-success/30";
    if (score >= 60) return "bg-warning/10 text-warning-foreground border-warning/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-generera taktvätt-leads
          </DialogTitle>
          <DialogDescription>
            AI analyserar fastigheter baserat på takålder, takmaterial och geografi för att hitta
            de bästa taktvätt-kandidaterna.
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Antal leads att generera</label>
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 leads</SelectItem>
                  <SelectItem value="10">10 leads</SelectItem>
                  <SelectItem value="20">20 leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Avbryt
              </Button>
              <Button onClick={handleGenerate}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generera
              </Button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI analyserar fastigheter...</p>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
              <span className="text-muted-foreground">
                {selected.size} av {candidates.length} valda
              </span>
              <div className="flex gap-2">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelected(new Set(candidates.map((c) => c.property_id)))}
                >
                  Välj alla
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelected(new Set())}
                >
                  Avmarkera alla
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {candidates.map((c) => {
                const isSelected = selected.has(c.property_id);
                return (
                  <button
                    key={c.property_id}
                    onClick={() => toggle(c.property_id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-card-foreground">
                              {c.property.address}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.property.municipality}, {c.property.region}
                              {c.property.build_year && ` · Byggt ${c.property.build_year}`}
                              {c.property.roof_type && ` · ${c.property.roof_type}`}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreColor(c.score)}`}
                          >
                            {c.score}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-card-foreground/80">{c.reason}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={handleClose}>
                <X className="mr-2 h-4 w-4" />
                Avbryt
              </Button>
              <Button onClick={handleConfirm} disabled={selected.size === 0}>
                <Check className="mr-2 h-4 w-4" />
                Skapa {selected.size} {selected.size === 1 ? "lead" : "leads"}
              </Button>
            </div>
          </>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Skapar leads...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
