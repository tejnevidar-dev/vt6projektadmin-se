import { useState } from "react";
import { CheckCircle2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Lead } from "@/lib/types";
import { setLeadOfferAccepted } from "@/lib/leads-api";

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  lead: Lead;
  onUpdated?: () => void;
}

/** Registrerar datumet då kunden godkände offerten – styr all säljstatistik. */
export function OfferAcceptedCard({ lead, onUpdated }: Props) {
  const accepted = !!lead.offerAcceptedAt;
  const [date, setDate] = useState(
    lead.offerAcceptedAt ? new Date(lead.offerAcceptedAt).toISOString().slice(0, 10) : today(),
  );
  const [saving, setSaving] = useState(false);

  const save = async (value: boolean) => {
    setSaving(true);
    try {
      await setLeadOfferAccepted(lead.id, value, value ? date : null);
      toast.success(value ? "Offert registrerad som godkänd" : "Godkännande borttaget");
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        {accepted ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Handshake className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-card-foreground">Godkänd offert</span>
      </div>

      {accepted ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Kunden godkände offerten{" "}
            <span className="font-medium text-card-foreground">
              {new Date(lead.offerAcceptedAt as string).toLocaleDateString("sv-SE")}
            </span>
            . Affären räknas i säljstatistiken det datumet.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`acc-${lead.id}`} className="text-xs">Justera datum</Label>
              <Input
                id={`acc-${lead.id}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => save(true)}>
              Spara datum
            </Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => save(false)}>
              Ta bort
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Registrera när kunden godkände offerten – då räknas affären som såld, oberoende av när
            jobbet utförs.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`acc-${lead.id}`} className="text-xs">Datum</Label>
              <Input
                id={`acc-${lead.id}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <Button size="sm" disabled={saving} onClick={() => save(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Kund har godkänt offert
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
