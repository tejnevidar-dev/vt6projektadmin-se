import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarIcon, CheckCircle, ExternalLink, Landmark, Receipt } from "lucide-react";
import { setLeadInvoiced, setLeadRotPaid } from "@/lib/leads-api";
import { isRotApplicationDue, type Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  lead: Lead;
  onUpdated?: () => void;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Faktura- och ROT-status för slutförda jobb. */
export function InvoiceRotPanel({ lead, onUpdated }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dueDate, setDueDate] = useState<Date>(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [saving, setSaving] = useState(false);

  if (lead.pipelineStage !== "slutford") return null;

  const rotDue = isRotApplicationDue(lead);
  const hasRot = lead.rotEligible && (lead.rotAmount ?? 0) > 0;

  const confirmInvoiced = async () => {
    setSaving(true);
    try {
      await setLeadInvoiced(lead.id, true, toIsoDate(dueDate));
      toast.success("Markerad som fakturerad");
      setDialogOpen(false);
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte spara fakturan");
    } finally {
      setSaving(false);
    }
  };

  const undoInvoiced = async () => {
    setSaving(true);
    try {
      await setLeadInvoiced(lead.id, false);
      toast.success("Fakturering återställd");
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte återställa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "space-y-2 rounded-lg border p-3",
          lead.invoiced ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            Fakturering
          </span>
          <span className="text-sm font-semibold text-card-foreground">
            {lead.invoiced ? "Fakturerad" : "Ej fakturerad"}
          </span>
        </div>
        {lead.invoiced && lead.invoiceDueDate && (
          <p className="text-xs text-muted-foreground">
            Förfallodatum: {new Date(`${lead.invoiceDueDate}T00:00:00`).toLocaleDateString("sv-SE")}
          </p>
        )}
        {lead.invoiced ? (
          <Button variant="outline" className="w-full" disabled={saving} onClick={undoInvoiced}>
            Ångra fakturering
          </Button>
        ) : (
          <Button className="w-full" onClick={() => setDialogOpen(true)}>
            <Receipt className="mr-2 h-4 w-4" />
            Markera som fakturerad
          </Button>
        )}
      </div>

      {hasRot && (
        <div
          className={cn(
            "space-y-2 rounded-lg border p-3",
            lead.rotPaid
              ? "border-success/40 bg-success/10"
              : rotDue
                ? "border-warning/60 bg-warning/15"
                : "border-border bg-muted/40",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" />
              ROT-avdrag
            </span>
            <span className="text-sm font-semibold text-card-foreground">
              {lead.rotAmount?.toLocaleString("sv-SE")} kr
            </span>
          </div>
          {!lead.rotPaid && (
            <p className="text-xs text-muted-foreground">
              {rotDue
                ? "Redo att ansöka hos Skatteverket."
                : lead.invoiced
                  ? "Ansökan blir aktuell 1 dag efter fakturans förfallodatum."
                  : "Markera fakturan som skickad för att starta ROT-bevakningen."}
            </p>
          )}
          <Button variant="outline" className="w-full" asChild>
            <a
              href="https://www7.skatteverket.se/portal/rotrut/begar-utbetalning/rot/kopare"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Begär ROT hos Skatteverket
            </a>
          </Button>
          <Button
            variant={lead.rotPaid ? "default" : "outline"}
            className={cn("w-full", lead.rotPaid ? "bg-success text-success-foreground hover:bg-success/90" : "")}
            onClick={async () => {
              try {
                await setLeadRotPaid(lead.id, !lead.rotPaid);
                onUpdated?.();
              } catch (err) {
                console.error("Failed to toggle rot applied:", err);
              }
            }}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {lead.rotPaid ? "ROT ansökt ✓" : "Markera ROT som ansökt"}
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fakturerad</DialogTitle>
            <DialogDescription>
              Ange fakturans förfallodatum – ekonomi kan då ansöka om ROT dagen efter förfallodatumet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Förfallodatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dueDate, "PPP", { locale: sv })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(d) => d && setDueDate(d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Avbryt
            </Button>
            <Button onClick={confirmInvoiced} disabled={saving}>
              {saving ? "Sparar…" : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
