import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarCheck } from "lucide-react";

interface Props {
  open: boolean;
  leadName?: string;
  initialDate?: string | null;
  onCancel: () => void;
  onConfirm: (isoDate: string) => void | Promise<void>;
}

function toLocalInput(value?: string | null): string {
  const d = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingDateDialog({ open, leadName, initialDate, onCancel, onConfirm }: Props) {
  const [value, setValue] = useState<string>(toLocalInput(initialDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(toLocalInput(initialDate));
      setSaving(false);
    }
  }, [open, initialDate]);

  const submit = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await onConfirm(new Date(value).toISOString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-warning" />
            Boka möte
          </DialogTitle>
          <DialogDescription>
            {leadName ? `Välj datum och tid för mötet med ${leadName}.` : "Välj datum och tid för mötet."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="booking-date">Datum & tid</Label>
          <Input
            id="booking-date"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
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
