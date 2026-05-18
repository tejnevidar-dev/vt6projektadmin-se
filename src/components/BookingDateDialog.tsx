import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck } from "lucide-react";

export type AssignmentType = "none" | "subcontractor" | "foreman";

export interface BookingDetails {
  isoDate: string;
  price: number | null;
  assignmentType: AssignmentType;
  subcontractorName: string | null;
  subcontractorPrice: number | null;
  foremanName: string | null;
}

interface Props {
  open: boolean;
  leadName?: string;
  initialDate?: string | null;
  initialPrice?: number | null;
  initialAssignmentType?: AssignmentType;
  initialSubcontractorName?: string | null;
  initialSubcontractorPrice?: number | null;
  initialForemanName?: string | null;
  onCancel: () => void;
  onConfirm: (details: BookingDetails) => void | Promise<void>;
}

function toLocalInput(value?: string | null): string {
  const d = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingDateDialog({
  open,
  leadName,
  initialDate,
  initialPrice,
  initialAssignmentType,
  initialSubcontractorName,
  initialSubcontractorPrice,
  initialForemanName,
  onCancel,
  onConfirm,
}: Props) {
  const [value, setValue] = useState<string>(toLocalInput(initialDate));
  const [price, setPrice] = useState<string>(initialPrice != null ? String(initialPrice) : "");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(initialAssignmentType ?? "none");
  const [subName, setSubName] = useState<string>(initialSubcontractorName ?? "");
  const [subPrice, setSubPrice] = useState<string>(initialSubcontractorPrice != null ? String(initialSubcontractorPrice) : "");
  const [foremanName, setForemanName] = useState<string>(initialForemanName ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(toLocalInput(initialDate));
      setPrice(initialPrice != null ? String(initialPrice) : "");
      setAssignmentType(initialAssignmentType ?? "none");
      setSubName(initialSubcontractorName ?? "");
      setSubPrice(initialSubcontractorPrice != null ? String(initialSubcontractorPrice) : "");
      setForemanName(initialForemanName ?? "");
      setSaving(false);
    }
  }, [open, initialDate, initialPrice, initialAssignmentType, initialSubcontractorName, initialSubcontractorPrice, initialForemanName]);

  const submit = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await onConfirm({
        isoDate: new Date(value).toISOString(),
        price: price ? parseFloat(price) : null,
        assignmentType,
        subcontractorName: assignmentType === "subcontractor" ? (subName.trim() || null) : null,
        subcontractorPrice: assignmentType === "subcontractor" && subPrice ? parseFloat(subPrice) : null,
        foremanName: assignmentType === "foreman" ? (foremanName.trim() || null) : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-warning" />
            Boka möte
          </DialogTitle>
          <DialogDescription>
            {leadName ? `Fyll i bokningsinformation för ${leadName}.` : "Fyll i bokningsinformation."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="booking-date">Datum & tid</Label>
            <Input
              id="booking-date"
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-price">Pris (kr)</Label>
            <Input
              id="booking-price"
              type="number"
              min="0"
              step="100"
              placeholder="t.ex. 85000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignment-type">Tilldela</Label>
            <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as AssignmentType)}>
              <SelectTrigger id="assignment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen tilldelning ännu</SelectItem>
                <SelectItem value="subcontractor">Tilldela underentreprenör</SelectItem>
                <SelectItem value="foreman">Tilldela arbetsledare</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignmentType === "subcontractor" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="space-y-2">
                <Label htmlFor="sub-name">Underentreprenör</Label>
                <Input
                  id="sub-name"
                  placeholder="Namn på underentreprenör"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Inbjudningsfunktion för UE kommer i ett senare steg.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-price">UE Pris (kr)</Label>
                <Input
                  id="sub-price"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="t.ex. 60000"
                  value={subPrice}
                  onChange={(e) => setSubPrice(e.target.value)}
                />
              </div>
            </div>
          )}

          {assignmentType === "foreman" && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <Label htmlFor="foreman-name">Arbetsledare</Label>
              <Input
                id="foreman-name"
                placeholder="Namn på arbetsledare"
                value={foremanName}
                onChange={(e) => setForemanName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Inbjudningsfunktion för arbetsledare kommer i ett senare steg.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Avbryt</Button>
          <Button onClick={submit} disabled={!value || saving}>
            {saving ? "Sparar…" : "Bekräfta bokning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
