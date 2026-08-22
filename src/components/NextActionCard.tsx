import { useState } from "react";
import { toast } from "sonner";
import { AlarmClock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setLeadNextAction } from "@/lib/leads-api";
import { nextActionState } from "@/lib/next-action";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK: { label: string; days: number }[] = [
  { label: "Idag", days: 0 },
  { label: "Imorgon", days: 1 },
  { label: "+3 dgr", days: 3 },
  { label: "+7 dgr", days: 7 },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NextActionCard({ lead, onUpdated }: { lead: Lead; onUpdated?: () => void }) {
  const [when, setWhen] = useState(toLocalInput(lead.nextActionAt));
  const [note, setNote] = useState(lead.nextActionNote ?? "");
  const [saving, setSaving] = useState(false);
  const state = nextActionState(lead);

  const save = async (isoOverride?: string | null) => {
    const iso = isoOverride !== undefined ? isoOverride : when ? new Date(when).toISOString() : null;
    setSaving(true);
    try {
      await setLeadNextAction(lead.id, iso, iso ? note.trim() || null : null);
      setWhen(toLocalInput(iso));
      if (!iso) setNote("");
      toast.success(iso ? "Nästa åtgärd sparad" : "Nästa åtgärd rensad");
      onUpdated?.();
    } catch (e) {
      toast.error("Kunde inte spara nästa åtgärd");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const quick = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    setWhen(toLocalInput(d.toISOString()));
    void save(d.toISOString());
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlarmClock className="h-4 w-4 text-muted-foreground" />
          Nästa åtgärd
        </div>
        {state && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", state.className)}>
            {state.label}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <Button key={q.label} type="button" variant="outline" size="sm" disabled={saving} onClick={() => quick(q.days)}>
            {q.label}
          </Button>
        ))}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <Input
          placeholder="Vad ska göras? T.ex. ringa om offert"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          <Check className="mr-1 h-3.5 w-3.5" /> Spara
        </Button>
        {lead.nextActionAt && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save(null)}>
            <X className="mr-1 h-3.5 w-3.5" /> Klarmarkera / rensa
          </Button>
        )}
      </div>
    </div>
  );
}
