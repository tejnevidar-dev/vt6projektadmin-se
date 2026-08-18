import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SeoTask } from "@/lib/seo/types";
import { CsvButton, Empty, Panel, ScoreDot } from "./shared";

const STATUS_LABEL: Record<SeoTask["status"], string> = {
  todo: "Att göra",
  in_progress: "Pågår",
  done: "Klar",
  ignored: "Ignorerad",
};

export function TasksTab({
  tasks,
  onUpdate,
  onDelete,
  onCreate,
  busy,
}: {
  tasks: SeoTask[];
  onUpdate: (id: string, status: SeoTask["status"]) => void;
  onDelete: (id: string) => void;
  onCreate: (title: string) => void;
  busy: boolean;
}) {
  const [filter, setFilter] = useState<string>("open");
  const [title, setTitle] = useState("");

  const rows = tasks.filter((t) =>
    filter === "all" ? true : filter === "open" ? t.status === "todo" || t.status === "in_progress" : t.status === filter,
  );

  const counts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <Panel
      title="SEO Task Center"
      description={`${counts.todo} att göra · ${counts.in_progress} pågår · ${counts.done} klara`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Ny uppgift…" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-52" />
          <Button
            size="sm"
            disabled={busy || !title.trim()}
            onClick={() => {
              onCreate(title);
              setTitle("");
            }}
          >
            Lägg till
          </Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Öppna</SelectItem>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="todo">Att göra</SelectItem>
              <SelectItem value="in_progress">Pågår</SelectItem>
              <SelectItem value="done">Klara</SelectItem>
              <SelectItem value="ignored">Ignorerade</SelectItem>
            </SelectContent>
          </Select>
          <CsvButton filename="seo-uppgifter.csv" rows={rows as unknown as Record<string, unknown>[]} />
        </div>
      }
    >
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <button
                className="mt-0.5"
                disabled={busy}
                onClick={() => onUpdate(t.id, t.status === "done" ? "todo" : "done")}
                title={t.status === "done" ? "Markera som ej klar" : "Markera som klar"}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.status === "done" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  <ScoreDot score={t.opportunity_score} />
                  <Badge variant="outline">{t.category}</Badge>
                  <Badge variant="outline">{STATUS_LABEL[t.status]}</Badge>
                </div>
                {t.problem && <p className="mt-1 text-sm text-muted-foreground">{t.problem}</p>}
                {t.recommendation && <p className="mt-1 text-sm">{t.recommendation}</p>}
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  {t.target_keyword && <span>Sökord: {t.target_keyword}</span>}
                  {t.affected_url && <a href={t.affected_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{t.affected_url}</a>}
                  {t.baseline && <span>Utgångsläge: {Object.entries(t.baseline).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>}
                  {t.completed_at && <span>Klar {new Date(t.completed_at).toLocaleDateString("sv-SE")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Select value={t.status} onValueChange={(v) => onUpdate(t.id, v as SeoTask["status"])}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as SeoTask["status"][]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)} disabled={busy}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Inga uppgifter i vyn. Lägg till från möjlighetslistan.</Empty>
      )}
    </Panel>
  );
}
