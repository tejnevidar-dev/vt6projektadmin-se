import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { fetchLeads } from "@/lib/leads-api";
import type { Lead, PipelineStage } from "@/lib/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, JOB_TYPE_LABELS } from "@/lib/types";
import { TrendingUp, Users, Flame, CheckCircle2, Webhook } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard – Säljpanel" }] }),
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

function DashboardContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads()
      .then(setLeads)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = leads.length;
  const hot = leads.filter((l) => l.status === "hot").length;
  const customers = leads.filter((l) => l.status === "customer").length;
  const incomingWeb = leads.filter((l) => l.pipelineStage === "inkommande_webb").length;

  const stats = [
    { label: "Totalt antal leads", value: total, icon: Users, color: "text-primary" },
    { label: "Heta leads", value: hot, icon: Flame, color: "text-destructive" },
    { label: "Kunder", value: customers, icon: CheckCircle2, color: "text-success" },
    { label: "Nya från webben", value: incomingWeb, icon: Webhook, color: "text-info" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Välkommen tillbaka</h2>
        <p className="text-sm text-muted-foreground">En översikt över din säljpipeline</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pipeline</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage) => {
              const count = leads.filter((l) => l.pipelineStage === stage).length;
              const pct = total ? (count / total) * 100 : 0;
              return (
                <div key={stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{PIPELINE_STAGE_LABELS[stage]}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Per jobbtyp</h3>
          </div>
          <div className="space-y-3">
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
                    <div className="h-full bg-chart-2 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Link to="/leads"><Button>Öppna leads</Button></Link>
        <Link to="/webhook-logs"><Button variant="outline">Visa webhook-loggar</Button></Link>
      </div>
    </div>
  );
}

// Suppress unused import warning - PipelineStage is used implicitly
type _ = PipelineStage;
