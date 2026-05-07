import { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { LeadKanban } from "@/components/LeadKanban";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";
import { fetchLeads, updateLeadPipelineStage } from "@/lib/leads-api";
import type { Lead, PipelineStage } from "@/lib/types";
import { PIPELINE_STAGE_LABELS } from "@/lib/types";
import { KanbanSquare, Table as TableIcon } from "lucide-react";

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

  return (
    <AppShell title={PIPELINE_STAGE_LABELS[stage]} description={description} actions={headerActions}>
      <section className="rounded-xl border border-border/70 bg-card/40">
        <div className="border-b border-border/60 px-5 py-3">
          <h2 className="text-[13px] font-semibold text-foreground">{PIPELINE_STAGE_LABELS[stage]}</h2>
          <p className="text-[11.5px] text-muted-foreground">
            {loading ? "Laddar..." : `${stageLeads.length} leads`}
          </p>
        </div>
        <div className={view === "kanban" ? "p-4" : ""}>
          {view === "kanban" ? (
            <LeadKanban leads={stageLeads} onSelect={setSelectedLead} onStageChange={handleStageChange} stages={[stage]} />
          ) : (
            <LeadTable leads={stageLeads} onSelect={setSelectedLead} />
          )}
        </div>
      </section>

      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={load} />
      )}
    </AppShell>
  );
}
