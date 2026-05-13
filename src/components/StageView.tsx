import { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { LeadKanban } from "@/components/LeadKanban";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";
import { Input } from "@/components/ui/input";
import { fetchLeads, updateLeadPipelineStage } from "@/lib/leads-api";
import { fetchSaljare, type Saljare } from "@/lib/saljare-api";
import type { Lead, PipelineStage, JobType } from "@/lib/types";
import { PIPELINE_STAGE_LABELS, JOB_TYPE_LABELS, JOB_TYPES } from "@/lib/types";
import { KanbanSquare, Table as TableIcon, Search, X, UserCheck, UserPlus } from "lucide-react";

interface Props {
  stage: PipelineStage;
  description?: string;
}

export function StagePage({ stage, description }: Props) {
  return (
    <RequireAuth>
      <StageContent stage={stage} description={description} />
    </RequireAuth>
  );
}

function StageContent({ stage, description }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState<JobType | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [createdByFilter, setCreatedByFilter] = useState<string>("all");
  const [saljare, setSaljare] = useState<Saljare[]>([]);

  useEffect(() => {
    fetchSaljare().then(setSaljare).catch(() => setSaljare([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stageLeads = useMemo(() => leads.filter((l) => l.pipelineStage === stage), [leads, stage]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stageLeads.filter((lead) => {
      if (jobTypeFilter !== "all" && lead.jobType !== jobTypeFilter) return false;
      if (assignedFilter !== "all") {
        if (assignedFilter === "unassigned") {
          if (lead.assignedTo) return false;
        } else if (lead.assignedTo !== assignedFilter) return false;
      }
      if (createdByFilter !== "all") {
        if (createdByFilter === "unknown") {
          if (lead.createdBy) return false;
        } else if (lead.createdBy !== createdByFilter) return false;
      }
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.address.toLowerCase().includes(q)
      );
    });
  }, [stageLeads, search, jobTypeFilter, assignedFilter, createdByFilter]);

  const handleStageChange = async (leadId: string, newStage: PipelineStage) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipelineStage: newStage } : l)));
    try {
      await updateLeadPipelineStage(leadId, newStage);
    } catch (err) {
      console.error(err);
      load();
    }
  };

  const headerActions = (
    <div className="flex rounded-md border border-border bg-card/60 p-0.5">
      <button
        onClick={() => setView("kanban")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <KanbanSquare className="h-3.5 w-3.5" /> Board
      </button>
      <button
        onClick={() => setView("table")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <TableIcon className="h-3.5 w-3.5" /> Tabell
      </button>
    </div>
  );

  const hasActiveFilters = search.trim() !== "" || jobTypeFilter !== "all";

  return (
    <AppShell title={PIPELINE_STAGE_LABELS[stage]} description={description} actions={headerActions}>
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/40">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value.slice(0, 100))}
                placeholder="Sök på namn eller adress…"
                className="pl-9"
                maxLength={100}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/60 p-0.5">
              <button
                onClick={() => setJobTypeFilter("all")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  jobTypeFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Alla jobb
              </button>
              {JOB_TYPES.map((jt) => (
                <button
                  key={jt}
                  onClick={() => setJobTypeFilter(jt)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    jobTypeFilter === jt
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {JOB_TYPE_LABELS[jt]}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setJobTypeFilter("all");
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Återställ
              </button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card/40">
          <div className="border-b border-border/60 px-5 py-3">
            <h2 className="text-[13px] font-semibold text-foreground">{PIPELINE_STAGE_LABELS[stage]}</h2>
            <p className="text-[11.5px] text-muted-foreground">
              {loading
                ? "Laddar..."
                : `${filteredLeads.length} av ${stageLeads.length} leads`}
            </p>
          </div>
          <div className={view === "kanban" ? "p-4" : ""}>
            {view === "kanban" ? (
              <LeadKanban leads={filteredLeads} onSelect={setSelectedLead} onStageChange={handleStageChange} stages={[stage]} />
            ) : (
              <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
            )}
          </div>
        </section>
      </div>

      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={load} />
      )}
    </AppShell>
  );
}
