import { useEffect, useState } from "react";
import { Skull } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { LOST_REASONS, LOST_REASON_LABELS, type Lead, type LostReason } from "@/lib/types";

interface Props {
  lead: Lead;
  onUpdated?: () => void;
}

/** Registrering av förlustorsak – visas när affären är förlorad. */
export function LostDealCard({ lead, onUpdated }: Props) {
  const [reason, setReason] = useState<LostReason | "">(lead.lostReason ?? "");
  const [competitor, setCompetitor] = useState(lead.lostCompetitor ?? "");
  const [note, setNote] = useState(lead.lostNote ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReason(lead.lostReason ?? "");
    setCompetitor(lead.lostCompetitor ?? "");
    setNote(lead.lostNote ?? "");
  }, [lead.id, lead.lostReason, lead.lostCompetitor, lead.lostNote]);

  const save = async () => {
    if (!reason) {
      toast.error("Välj en förlustorsak");
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from("leads") as any)
      .update({
        lost_reason: reason,
        lost_competitor: reason === "konkurrent" ? competitor.trim() || null : competitor.trim() || null,
        lost_note: note.trim() || null,
      })
      .eq("id", lead.id);
    setSaving(false);
    if (error) {
      toast.error("Kunde inte spara förlustorsak");
      return;
    }
    toast.success("Förlustorsak sparad");
    onUpdated?.();
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Skull className="h-4 w-4 text-destructive" /> Förlorad affär
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Orsak</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as LostReason)}>
            <SelectTrigger>
              <SelectValue placeholder="Välj orsak" />
            </SelectTrigger>
            <SelectContent>
              {LOST_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {LOST_REASON_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Konkurrent (om känd)</Label>
          <Input value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="T.ex. Takbolaget AB" />
        </div>
        <div className="space-y-1.5">
          <Label>Kommentar</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Vad avgjorde?" />
        </div>
        {lead.lostAt && (
          <p className="text-xs text-muted-foreground">
            Markerad som förlorad {new Date(lead.lostAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
          </p>
        )}
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Sparar…" : "Spara förlustorsak"}
        </Button>
      </CardContent>
    </Card>
  );
}
