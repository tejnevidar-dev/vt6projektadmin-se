import { useState } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setLeadCustomerPaid } from "@/lib/leads-api";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";

/** Kunden har betalat: styr kassamålet och morgonrapportens "betalda jobb". Bara admin/ekonomi. */
export function CustomerPaidCard({ lead, onUpdated }: { lead: Lead; onUpdated?: () => void }) {
  const [amount, setAmount] = useState<string>(lead.price != null ? String(Math.round(lead.price)) : "");
  const [saving, setSaving] = useState(false);
  const paid = !!lead.customerPaidAt;

  const save = async (next: boolean) => {
    const n = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (next && (!Number.isFinite(n) || n <= 0)) return toast.error("Ange betalt belopp i kr");
    setSaving(true);
    try {
      await setLeadCustomerPaid(lead.id, next, next ? n : null);
      toast.success(next ? "Markerad som betald" : "Betalning återställd");
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte spara (bara admin/ekonomi får markera betalt)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("space-y-2 rounded-lg border p-3", paid ? "border-success/40 bg-success/10" : "border-border bg-muted/40")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Banknote className="h-3.5 w-3.5" />
          Kundbetalning
        </span>
        <span className="text-sm font-semibold text-card-foreground">
          {paid
            ? `Betald ${new Date(lead.customerPaidAt as string).toLocaleDateString("sv-SE")}`
            : "Ej betald"}
        </span>
      </div>
      {paid ? (
        <>
          <p className="text-xs text-muted-foreground">
            Betalt belopp: {Math.round(lead.customerPaidAmount ?? 0).toLocaleString("sv-SE")} kr
          </p>
          <Button variant="outline" className="w-full" disabled={saving} onClick={() => save(false)}>
            Ångra betalning
          </Button>
        </>
      ) : (
        <>
          <Label className="text-xs text-muted-foreground">Betalt belopp (kr)</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="t.ex. 145000" />
          <Button className="w-full" disabled={saving} onClick={() => save(true)}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Markera som betald
          </Button>
        </>
      )}
    </div>
  );
}
