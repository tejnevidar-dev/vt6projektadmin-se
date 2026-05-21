import { useEffect, useState } from "react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarCheck, CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssignmentType = "none" | "subcontractor" | "foreman";

export interface BookingDetails {
  isoDate: string;
  price: number | null;
  rotAmount: number | null;
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
  initialRotAmount?: number | null;
  initialAssignmentType?: AssignmentType;
  initialSubcontractorName?: string | null;
  initialSubcontractorPrice?: number | null;
  initialForemanName?: string | null;
  onCancel: () => void;
  onConfirm: (details: BookingDetails) => void | Promise<void>;
}

function getInitialDate(initialDate?: string | null): Date {
  return initialDate ? new Date(initialDate) : new Date(Date.now() + 60 * 60 * 1000);
}

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export function BookingDateDialog({
  open,
  leadName,
  initialDate,
  initialPrice,
  initialRotAmount,
  initialAssignmentType,
  initialSubcontractorName,
  initialSubcontractorPrice,
  initialForemanName,
  onCancel,
  onConfirm,
}: Props) {
  const initialDt = getInitialDate(initialDate);
  const [date, setDate] = useState<Date>(initialDt);
  const [time, setTime] = useState<string>(format(initialDt, "HH:mm"));
  const [price, setPrice] = useState<string>(initialPrice != null ? String(initialPrice) : "");
  const [rotAmount, setRotAmount] = useState<string>(initialRotAmount != null ? String(initialRotAmount) : "");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(initialAssignmentType ?? "none");
  const [subName, setSubName] = useState<string>(initialSubcontractorName ?? "");
  const [subPrice, setSubPrice] = useState<string>(initialSubcontractorPrice != null ? String(initialSubcontractorPrice) : "");
  const [foremanName, setForemanName] = useState<string>(initialForemanName ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const dt = getInitialDate(initialDate);
      setDate(dt);
      setTime(format(dt, "HH:mm"));
      setPrice(initialPrice != null ? String(initialPrice) : "");
      setRotAmount(initialRotAmount != null ? String(initialRotAmount) : "");
      setAssignmentType(initialAssignmentType ?? "none");
      setSubName(initialSubcontractorName ?? "");
      setSubPrice(initialSubcontractorPrice != null ? String(initialSubcontractorPrice) : "");
      setForemanName(initialForemanName ?? "");
      setSaving(false);
    }
  }, [open, initialDate, initialPrice, initialRotAmount, initialAssignmentType, initialSubcontractorName, initialSubcontractorPrice, initialForemanName]);

  const priceNum = price ? parseFloat(price) : null;
  const rotNum = rotAmount ? parseFloat(rotAmount) : null;
  const customerPrice = priceNum != null ? priceNum - (rotNum ?? 0) : null;

  const submit = async () => {
    if (!date) return;
    const [h, m] = time.split(":").map(Number);
    const iso = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).toISOString();
    setSaving(true);
    try {
      await onConfirm({
        isoDate: iso,
        price: priceNum,
        rotAmount: rotNum,
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
            <Label>Datum & tid</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal sm:w-auto",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: sv }) : <span>Välj datum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal sm:w-auto",
                      !time && "text-muted-foreground"
                    )}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {time ? time : <span>Välj tid</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="max-h-60 w-28 overflow-y-auto">
                    {TIME_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        className={cn(
                          "w-full rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                          time === t && "bg-primary text-primary-foreground hover:bg-primary"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
          <Button onClick={submit} disabled={!date || !time || saving}>
            {saving ? "Sparar…" : "Bekräfta bokning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

