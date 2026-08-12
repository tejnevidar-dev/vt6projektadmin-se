import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setLeadEconomyNote } from "@/lib/leads-api";

interface Props {
  leadId: string;
  note: string | null;
  onUpdated?: () => void;
}

/** Fri kommentar/notering till ekonomi (t.ex. "kundens mamma ska ha ROT"). */
export function EconomyNoteCard({ leadId, note, onUpdated }: Props) {
  const [value, setValue] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(note ?? "");
  }, [note, leadId]);

  const dirty = (value.trim() || null) !== (note?.trim() || null);

  const save = async () => {
    setSaving(true);
    try {
      await setLeadEconomyNote(leadId, value);
      toast.success("Kommentar sparad");
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte spara kommentaren");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Kommentar till ekonomi</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="T.ex. kundens mamma ska nyttja ROT-avdraget, delbetalning, avvikande fakturamottagare…"
      />
      <Button size="sm" className="w-full" disabled={!dirty || saving} onClick={save}>
        {saving ? "Sparar…" : "Spara kommentar"}
      </Button>
    </div>
  );
}
