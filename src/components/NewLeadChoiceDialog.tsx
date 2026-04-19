import { Sparkles, PencilLine, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface NewLeadChoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onChooseAi: () => void;
  onChooseManual: () => void;
}

export function NewLeadChoiceDialog({ open, onClose, onChooseAi, onChooseManual }: NewLeadChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ny lead</DialogTitle>
          <DialogDescription>Hur vill du skapa leaden?</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 pt-2">
          <button
            onClick={onChooseAi}
            className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-card-foreground">AI-generera</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Filtrera på län och kommun för att hämta villaägares kontaktuppgifter automatiskt.
              </p>
            </div>
          </button>

          <button
            onClick={onChooseManual}
            className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PencilLine className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-card-foreground">Fyll i manuellt</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Skriv in namn, telefon, adress och övriga uppgifter själv.
              </p>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Avbryt
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
