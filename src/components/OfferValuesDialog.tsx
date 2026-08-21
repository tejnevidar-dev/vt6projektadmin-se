import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrice?: number | null;
  initialMaterialCost?: number | null;
  saving?: boolean;
  onConfirm: (values: { price: number; materialCost: number }) => void;
}

/** Fyller i ordervärde + materialkostnad när en lead markeras som "Att offertera". */
export function OfferValuesDialog({
  open,
  onOpenChange,
  initialPrice,
  initialMaterialCost,
  saving,
  onConfirm,
}: Props) {
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : "");
  const [material, setMaterial] = useState(
    initialMaterialCost != null ? String(initialMaterialCost) : "",
  );

  const p = Number(price.replace(/\s/g, "").replace(",", "."));
  const m = Number(material.replace(/\s/g, "").replace(",", "."));
  const valid = price.trim() !== "" && material.trim() !== "" && !Number.isNaN(p) && !Number.isNaN(m);
  const tb = valid ? p - m : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Markera som Att offertera</DialogTitle>
          <DialogDescription>
            Fyll i ordervärde och materialkostnad direkt – det används för ROT-underlaget och
            säljstatistiken.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="offer-price">Ordervärde (kr inkl. moms)</Label>
            <Input
              id="offer-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="t.ex. 185000"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-material">Materialkostnad (kr)</Label>
            <Input
              id="offer-material"
              inputMode="decimal"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="t.ex. 62000"
            />
          </div>
          {tb != null && (
            <p className="text-sm text-muted-foreground">
              Täckningsbidrag:{" "}
              <span className="font-medium text-card-foreground">
                {tb.toLocaleString("sv-SE")} kr
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button disabled={!valid || saving} onClick={() => onConfirm({ price: p, materialCost: m })}>
            Spara och markera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
