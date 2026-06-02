import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  listAllSelfChecks,
  markSelfCheckReviewed,
  unmarkSelfCheckReviewed,
  type SelfCheckWithContext,
} from "@/lib/jobs-api";

export const Route = createFileRoute("/egenkontroller")({
  component: () => (
    <RequireAuth>
      <EgenkontrollerPage />
    </RequireAuth>
  ),
});

function addressOf(c: SelfCheckWithContext): string {
  return c.property_address ?? c.job?.address ?? "—";
}

function EgenkontrollerPage() {
  const [items, setItems] = useState<SelfCheckWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"queue" | "all" | "instructions">("queue");
  const [reviewItem, setReviewItem] = useState<SelfCheckWithContext | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await listAllSelfChecks());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (!q) return true;
      const addr = addressOf(c).toLowerCase();
      const cust = (c.job?.customer_name ?? "").toLowerCase();
      return addr.includes(q) || cust.includes(q);
    });
  }, [items, query]);

  const queue = filtered.filter((c) => c.completed_at && !c.reviewed_at);
  const reviewed = filtered.filter((c) => c.reviewed_at);
  const inProgress = filtered.filter((c) => !c.completed_at);

  async function handleApprove() {
    if (!reviewItem) return;
    setSubmitting(true);
    try {
      await markSelfCheckReviewed(reviewItem.id, reviewNotes.trim() || undefined);
      toast.success("Egenkontroll granskad");
      setReviewItem(null);
      setReviewNotes("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReopen(id: string) {
    try {
      await unmarkSelfCheckReviewed(id);
      toast.success("Återöppnad för granskning");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <AppShell
      title="Egenkontroller"
      description="Granska och följ upp egenkontroller från hantverkare, arbetsledare och UE."
      meta={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="warning">
            <Clock className="h-3 w-3" /> {items.filter((c) => c.completed_at && !c.reviewed_at).length} att granska
          </Badge>
          <Badge tone="success">
            <CheckCircle2 className="h-3 w-3" /> {items.filter((c) => c.reviewed_at).length} granskade
          </Badge>
          <Badge tone="muted">
            <AlertCircle className="h-3 w-3" /> {items.filter((c) => !c.completed_at).length} pågående
          </Badge>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrera på adress eller kund..."
            className="pl-8"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="queue">Att granska ({queue.length})</TabsTrigger>
          <TabsTrigger value="all">Alla ({filtered.length})</TabsTrigger>
          <TabsTrigger value="instructions">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Montageinstruktioner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          {loading ? (
            <EmptyState text="Laddar..." />
          ) : queue.length === 0 ? (
            <EmptyState text="Inga egenkontroller väntar på granskning." />
          ) : (
            <ChecksTable items={queue} onReview={(c) => setReviewItem(c)} />
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-6">
          {queue.length > 0 && (
            <Section title="Att granska">
              <ChecksTable items={queue} onReview={(c) => setReviewItem(c)} />
            </Section>
          )}
          {inProgress.length > 0 && (
            <Section title="Pågående (ej inlämnade)">
              <ChecksTable items={inProgress} />
            </Section>
          )}
          {reviewed.length > 0 && (
            <Section title="Granskade">
              <ChecksTable items={reviewed} onReopen={handleReopen} />
            </Section>
          )}
          {filtered.length === 0 && !loading && (
            <EmptyState text="Inga egenkontroller matchar filtret." />
          )}
        </TabsContent>

        <TabsContent value="instructions" className="mt-4">
          <InstructionsView />
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!reviewItem}
        onOpenChange={(o) => {
          if (!o) {
            setReviewItem(null);
            setReviewNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Granska egenkontroll</DialogTitle>
          </DialogHeader>
          {reviewItem && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Adress: </span>
                <span className="font-medium">{addressOf(reviewItem)}</span>
              </div>
              {reviewItem.job?.customer_name && (
                <div>
                  <span className="text-muted-foreground">Kund: </span>
                  {reviewItem.job.customer_name}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Inlämnad: </span>
                {reviewItem.completed_at
                  ? new Date(reviewItem.completed_at).toLocaleString("sv-SE")
                  : "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Utförd av: </span>
                {reviewItem.performer?.display_name ?? reviewItem.performer?.email ?? "—"}
              </div>
              {reviewItem.data && Object.keys(reviewItem.data).length > 0 && (
                <details className="rounded border border-border bg-muted/30 p-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Visa inlämnad data
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {JSON.stringify(reviewItem.data, null, 2)}
                  </pre>
                </details>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Granskningsanteckning (valfri)
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="T.ex. OK, eller åtgärd som krävs..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewItem(null)}>
              Avbryt
            </Button>
            <Button onClick={handleApprove} disabled={submitting}>
              {submitting ? "Sparar..." : "Markera som granskad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warning" | "success" | "muted";
}) {
  const cls =
    tone === "warning"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
      : tone === "success"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}

function ChecksTable({
  items,
  onReview,
  onReopen,
}: {
  items: SelfCheckWithContext[];
  onReview?: (c: SelfCheckWithContext) => void;
  onReopen?: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Adress</th>
            <th className="px-3 py-2">Kund</th>
            <th className="px-3 py-2">Utförd av</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Datum</th>
            <th className="px-3 py-2 text-right">Åtgärd</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{addressOf(c)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {c.job?.customer_name ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {c.performer?.display_name ?? c.performer?.email ?? "—"}
              </td>
              <td className="px-3 py-2">
                {c.reviewed_at ? (
                  <Badge tone="success">
                    <CheckCircle2 className="h-3 w-3" /> Granskad
                  </Badge>
                ) : c.completed_at ? (
                  <Badge tone="warning">
                    <Clock className="h-3 w-3" /> Väntar
                  </Badge>
                ) : (
                  <Badge tone="muted">Pågående</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {(c.completed_at ?? c.created_at) &&
                  new Date(c.completed_at ?? c.created_at).toLocaleDateString("sv-SE")}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  {c.job && (
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/jobb/$jobId" params={{ jobId: c.job.id }}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                  {onReview && c.completed_at && !c.reviewed_at && (
                    <Button size="sm" onClick={() => onReview(c)}>
                      Granska
                    </Button>
                  )}
                  {onReopen && c.reviewed_at && (
                    <Button size="sm" variant="outline" onClick={() => onReopen(c.id)}>
                      Återöppna
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstructionsView() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <BookOpen className="h-4 w-4" />
          Montageinstruktioner
        </div>
        <p>
          Här samlar vi instruktioner för varje moment i mallarna. Texten fyller ni i löpande –
          det som skrivs här visas också inne i egenkontrollerna på respektive projekt.
          Bilduppladdning sker inte här, utan på projektets egenkontroll-flik där varje moment
          har sin egen plats för bilder.
        </p>
      </div>

      {SELF_CHECK_TEMPLATES.map((tpl) => (
        <div key={tpl.key} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold">{tpl.name}</h3>
              <span className="text-xs text-muted-foreground">
                {tpl.sentToClient ? "Skickas till beställaren" : "Intern – endast för oss"}
              </span>
            </div>
            {tpl.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
            )}
            {tpl.videoUrl && (
              <a
                href={tpl.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Video className="h-3.5 w-3.5" />
                {tpl.videoLabel ?? "Se instruktionsvideo"}
              </a>
            )}
          </div>

          {tpl.instructions && (
            <div className="border-b border-border bg-primary/5 px-4 py-3 text-sm leading-relaxed">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Övergripande instruktion
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{tpl.instructions}</p>
            </div>
          )}

          <ul className="divide-y divide-border">
            {tpl.fields.map((f) => (
              <li key={f.label} className="px-4 py-3">
                <div className="text-sm font-medium">{f.label}</div>
                {f.instruction ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {f.instruction}
                  </p>
                ) : (
                  <p className="mt-1 text-xs italic text-muted-foreground/70">
                    Instruktion kommer här – fyll i senare.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
