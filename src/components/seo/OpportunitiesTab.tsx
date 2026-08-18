import { useMemo, useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpportunityItem } from "@/lib/seo/types";
import { CsvButton, Empty, Panel, ScoreDot } from "./shared";

const PRIORITY_LABEL: Record<OpportunityItem["priority"], string> = {
  critical: "Kritisk",
  high: "Hög",
  medium: "Medel",
  low: "Låg",
};

export function OpportunitiesTab({
  items,
  onCreateTask,
  creating,
}: {
  items: OpportunityItem[];
  onCreateTask: (o: OpportunityItem) => void;
  creating: boolean;
}) {
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");

  const categories = useMemo(() => ["all", ...new Set(items.map((i) => i.category))], [items]);
  const rows = items.filter(
    (i) => (category === "all" || i.category === category) && (!q || `${i.title} ${i.keywords.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <Panel
      title="SEO Opportunity Engine"
      description="Prioriterade åtgärder rangordnade efter potentiell trafik, närhet till topp 3, sökintention och svårighetsgrad"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Sök…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-40" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "Alla kategorier" : c}</SelectItem>)}
            </SelectContent>
          </Select>
          <CsvButton filename="seo-mojligheter.csv" rows={rows as unknown as Record<string, unknown>[]} />
        </div>
      }
    >
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li key={o.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScoreDot score={o.score} />
                    <span className="font-semibold">{o.title}</span>
                    <Badge variant="outline">{o.category}</Badge>
                    <Badge variant="outline">{PRIORITY_LABEL[o.priority]}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Varför: </span>{o.why}</p>
                  <p className="mt-1 text-sm"><span className="font-medium">Åtgärd: </span>{o.action}</p>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>{o.currentData}</span>
                    <span>Förväntad effekt: {o.expectedEffect}</span>
                    <span>Svårighet {o.difficulty}/100 · Effekt {o.impact}/100</span>
                  </div>
                  {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">{o.url}</a>}
                  {o.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {o.keywords.map((k) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => onCreateTask(o)} disabled={creating}>
                  <Plus className="mr-1 h-4 w-4" />Lägg till uppgift
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty><Target className="mx-auto mb-2 h-5 w-5" />Inga möjligheter matchar filtret.</Empty>
      )}
    </Panel>
  );
}
