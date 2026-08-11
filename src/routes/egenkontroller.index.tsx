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
  listSelfChecks,
  markSelfCheckReviewed,
  unmarkSelfCheckReviewed,
  type JobWithLead,
  type SelfCheck,
  type SelfCheckWithContext,
} from "@/lib/jobs-api";
import { listJobs } from "@/lib/jobs.functions";
import { SELF_CHECK_TEMPLATES } from "@/lib/self-check-templates";
import { useUserRoles } from "@/hooks/use-role";
import { SelfCheckDataView } from "@/components/SelfCheckDataView";


export const Route = createFileRoute("/egenkontroller/")({
  component: () => (
    <RequireAuth>
      <EgenkontrollerGate />
    </RequireAuth>
  ),
});

function EgenkontrollerGate() {
  const { isAdmin, loading } = useUserRoles();
  if (loading) {
    return (
      <AppShell title="Egenkontroller">
        <p className="text-sm text-muted-foreground">Laddar...</p>
      </AppShell>
    );
  }
  return isAdmin ? <AdminReviewPage /> : <CompleteSelfChecksPage />;
}

function addressOf(c: SelfCheckWithContext): string {
  return c.property_address ?? c.job?.address ?? "—";
}

/* ============================================================
   ADMIN: Granska egenkontroller (befintlig vy)
============================================================ */
function AdminReviewPage() {
  const [items, setItems] = useState<SelfCheckWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"queue" | "all">("queue");
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
      const performer = (c.performer?.display_name ?? c.performer?.email ?? "").toLowerCase();
      const offerNo = (c.offer_number ?? "").toLowerCase();
      const template = SELF_CHECK_TEMPLATES.find((t) => t.key === c.template_key)?.name.toLowerCase() ?? "";
      return (
        addr.includes(q) ||
        cust.includes(q) ||
        performer.includes(q) ||
        offerNo.includes(q) ||
        template.includes(q)
      );
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
      title="Granska egenkontroller"
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
            placeholder="Sök på namn, adress eller ärendenummer..."
            className="pl-8"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="queue">Att granska ({queue.length})</TabsTrigger>
          <TabsTrigger value="all">Alla ({filtered.length})</TabsTrigger>
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
                <div className="max-h-[45vh] overflow-y-auto rounded border border-border bg-muted/20 p-2">
                  <SelfCheckDataView
                    templateKey={reviewItem.template_key}
                    data={reviewItem.data as Record<string, any>}
                  />
                </div>
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

/* ============================================================
   HANTVERKARE / ARBETSLEDARE / UE: Komplettera egenkontroller
============================================================ */

interface JobChecksSummary {
  job: JobWithLead;
  completedKeys: Set<string>;
  inProgressKeys: Set<string>;
  missingKeys: string[];
}

function CompleteSelfChecksPage() {
  const [summaries, setSummaries] = useState<JobChecksSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const jobs = await listJobs();
      const activeJobs = jobs.filter((j) => j.status !== "klar");
      const results: JobChecksSummary[] = await Promise.all(
        activeJobs.map(async (job) => {
          const checks = await listSelfChecks(job.id);
          const completedKeys = new Set<string>();
          const inProgressKeys = new Set<string>();
          for (const c of checks) {
            if (c.completed_at) completedKeys.add(c.template_key);
            else inProgressKeys.add(c.template_key);
          }
          const missingKeys = SELF_CHECK_TEMPLATES.map((t) => t.key).filter(
            (k) => !completedKeys.has(k),
          );
          return { job, completedKeys, inProgressKeys, missingKeys };
        }),
      );
      // Sort: jobs with most missing first
      results.sort((a, b) => b.missingKeys.length - a.missingKeys.length);
      setSummaries(results);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalMissing = summaries.reduce((s, x) => s + x.missingKeys.length, 0);
  const readyToFinish = summaries.filter((s) => s.missingKeys.length === 0);

  return (
    <AppShell
      title="Komplettera egenkontroller"
      description="Här ser du vilka egenkontroller du behöver fylla i för att kunna avsluta dina aktiva projekt. Alla egenkontroller måste vara inlämnade innan projektet kan markeras som klart och dina timmar kan registreras."
      meta={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="muted">
            {summaries.length} aktiva projekt
          </Badge>
          <Badge tone="warning">
            <AlertCircle className="h-3 w-3" /> {totalMissing} egenkontroller saknas
          </Badge>
          <Badge tone="success">
            <CheckCircle2 className="h-3 w-3" /> {readyToFinish.length} redo att avslutas
          </Badge>
        </div>
      }
    >
      {loading ? (
        <EmptyState text="Laddar..." />
      ) : summaries.length === 0 ? (
        <EmptyState text="Du har inga aktiva projekt." />
      ) : (
        <div className="space-y-4">
          {summaries.map((s) => (
            <JobChecklistCard key={s.job.id} summary={s} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function JobChecklistCard({ summary }: { summary: JobChecksSummary }) {
  const { job, completedKeys, inProgressKeys, missingKeys } = summary;
  const address = job.property?.address ?? job.address ?? "—";
  const allDone = missingKeys.length === 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{address}</h3>
            {allDone ? (
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" /> Klar att avslutas
              </Badge>
            ) : (
              <Badge tone="warning">
                <AlertCircle className="h-3 w-3" /> {missingKeys.length} saknas
              </Badge>
            )}
          </div>
          {job.customer_name && (
            <p className="mt-0.5 text-xs text-muted-foreground">{job.customer_name}</p>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/jobb/$jobId" params={{ jobId: job.id }}>
            Öppna projekt <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SELF_CHECK_TEMPLATES.map((tpl) => {
          const isDone = completedKeys.has(tpl.key);
          const isStarted = inProgressKeys.has(tpl.key);
          return (
            <div
              key={tpl.key}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                isDone
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : isStarted
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-2">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : isStarted ? (
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">{tpl.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {isDone ? "Inlämnad" : isStarted ? "Påbörjad" : "Saknas"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Shared bits
============================================================ */

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
            <th className="px-3 py-2">Ärendenummer</th>
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
