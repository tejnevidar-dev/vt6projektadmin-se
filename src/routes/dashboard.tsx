import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { fetchLeads } from "@/lib/leads-api";
import type { Lead, PipelineStage } from "@/lib/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, JOB_TYPE_LABELS } from "@/lib/types";
import {
  Users,
  Flame,
  CheckCircle2,
  Webhook,
  Inbox,
  ClipboardList,
  CalendarCheck,
  Loader2,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Översikt – admin.vt6" }] }),
});

function DashboardPage() {
  return (
    <RequireAuth>
      <AppShell title="Översikt">
        <DashboardContent />
      </AppShell>
    </RequireAuth>
  );
}

const STAGE_ROUTES: Record<PipelineStage, string> = {
  inkommande_webb: "/leads",
  saljpanel: "/leads",
  offererad: "/offerterade",
  bokad: "/bokade",
  pagaende: "/pagaende",
  slutford: "/slutforda",
};

const STAGE_ICONS: Record<PipelineStage, typeof Inbox> = {
  inkommande_webb: Webhook,
  saljpanel: Inbox,
  offererad: ClipboardList,
  bokad: CalendarCheck,
  pagaende: Loader2,
  slutford: CheckCircle2,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nyss";
  if (m < 60) return `${m} min sedan`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h sedan`;
  const d = Math.floor(h / 24);
  return `${d}d sedan`;
}

function DashboardContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const reload = () => {
    fetchLeads()
      .then(setLeads)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const total = leads.length;
  const hot = leads.filter((l) => l.status === "hot").length;
  const customers = leads.filter((l) => l.status === "customer").length;
  const incomingWeb = leads.filter((l) => l.pipelineStage === "inkommande_webb").length;

  const sorted = useMemo(
    () => [...leads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [leads],
  );

  const byStage = useMemo(() => {
    const map: Record<PipelineStage, Lead[]> = {
      inkommande_webb: [],
      saljpanel: [],
      offererad: [],
      bokad: [],
      pagaende: [],
      slutford: [],
    };
    for (const l of sorted) map[l.pipelineStage].push(l);
    return map;
  }, [sorted]);

  const stats = [
    { label: "Totalt antal leads", value: total, icon: Users, color: "text-primary" },
    { label: "Heta leads", value: hot, icon: Flame, color: "text-destructive" },
    { label: "Kunder", value: customers, icon: CheckCircle2, color: "text-success" },
    { label: "Nya från webben", value: incomingWeb, icon: Webhook, color: "text-info" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Välkommen tillbaka</h2>
          <p className="text-sm text-muted-foreground">
            Senaste aktiviteten i varje fas av pipelinen
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/leads"><Button>Öppna leads</Button></Link>
          <Link to="/webhook-logs"><Button variant="outline">Webhook-loggar</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="mt-3 text-3xl font-bold">{loading ? "—" : s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Senaste leads
          </h3>
          <Link to="/leads" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Visa alla <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Laddar…
          </div>
        ) : (
          <LeadTable
            leads={sorted.slice(0, 8)}
            onSelect={(l) => setSelectedLead((curr) => (curr?.id === l.id ? null : l))}
            selectedId={selectedLead?.id}
          />
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Senast tillagda per kategori
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PIPELINE_STAGES.map((stage) => {
            const Icon = STAGE_ICONS[stage];
            const items = byStage[stage].slice(0, 5);
            const count = byStage[stage].length;
            return (
              <div
                key={stage}
                className="flex flex-col rounded-lg border border-border bg-card p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">{PIPELINE_STAGE_LABELS[stage]}</h4>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>

                <div className="flex-1 space-y-2">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Laddar…</p>
                  ) : items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Inga {PIPELINE_STAGE_LABELS[stage].toLowerCase()} ännu.</p>
                  ) : (
                    items.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-md border border-border/60 bg-background/50 p-3 transition-colors hover:bg-accent/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{l.name}</div>
                            {l.address && (
                              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{l.address}</span>
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(l.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {JOB_TYPE_LABELS[l.jobType]}
                          </Badge>
                          {l.status === "hot" && (
                            <Badge className="bg-destructive/15 text-destructive text-[10px]">
                              Het
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Link
                  to={STAGE_ROUTES[stage]}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Visa alla <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}

          <div className="flex flex-col rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Per jobbtyp</h4>
            </div>
            <div className="flex-1 space-y-3">
              {(Object.keys(JOB_TYPE_LABELS) as Array<keyof typeof JOB_TYPE_LABELS>).map((jt) => {
                const count = leads.filter((l) => l.jobType === jt).length;
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <div key={jt}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{JOB_TYPE_LABELS[jt]}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => {
            reload();
            setSelectedLead(null);
          }}
        />
      )}
    </div>
  );
}
