import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Upload, Hammer, Droplets, Wrench, LayoutGrid, KanbanSquare, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { KpiCards } from "@/components/KpiCards";
import { FilterPanel } from "@/components/FilterPanel";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { AiGenerateLeadsDialog } from "@/components/AiGenerateLeadsDialog";
import { NewLeadChoiceDialog } from "@/components/NewLeadChoiceDialog";
import { LeadKanban } from "@/components/LeadKanban";
import { fetchLeads, updateLeadPipelineStage } from "@/lib/leads-api";
import type { Lead, LeadStatus, JobType } from "@/lib/types";
import { JOB_TYPE_LABELS } from "@/lib/types";

const JOB_TAB_ICONS: Record<JobType, typeof Hammer> = {
  roof_replacement: Hammer,
  roof_cleaning: Droplets,
  light_roof_work: Wrench,
};

export const Route = createFileRoute("/leads")({
  component: LeadsPage,
  head: () => ({ meta: [{ title: "Leads" }] }),
});

function LeadsPage() {
  return (
    <RequireAuth>
      <LeadsContent />
    </RequireAuth>
  );
}

function LeadsContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [createdByFilter, setCreatedByFilter] = useState<string>("all");
  const [needsOfferFilter, setNeedsOfferFilter] = useState<"all" | "yes" | "no">("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [activeJobType, setActiveJobType] = useState<JobType | "all">("all");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [activePipeline, setActivePipeline] = useState<"inkommande_webb" | "saljpanel">("inkommande_webb");

  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const activeLeads = useMemo(
    () => leads.filter((l) => l.pipelineStage === "inkommande_webb" || l.pipelineStage === "saljpanel"),
    [leads]
  );

  const jobTypeLeads = useMemo(
    () => (activeJobType === "all" ? activeLeads : activeLeads.filter((l) => l.jobType === activeJobType)),
    [activeLeads, activeJobType]
  );

  const filteredLeads = useMemo(() => {
    return jobTypeLeads.filter((lead) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          lead.name.toLowerCase().includes(q) ||
          lead.phone.includes(q) ||
          lead.address.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (region && lead.region !== region) return false;
      if (municipality && lead.municipality !== municipality) return false;
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
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
      if (needsOfferFilter === "yes" && !lead.needsOffer) return false;
      if (needsOfferFilter === "no" && lead.needsOffer) return false;
      return true;
    });
  }, [jobTypeLeads, search, region, municipality, statusFilter, assignedFilter, createdByFilter, needsOfferFilter]);

  const resetFilters = () => {
    setSearch("");
    setRegion("");
    setMunicipality("");
    setStatusFilter("all");
    setAssignedFilter("all");
    setCreatedByFilter("all");
    setNeedsOfferFilter("all");
  };

  const handleStageChange = async (leadId: string, stage: Lead["pipelineStage"]) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipelineStage: stage } : l)));
    try {
      await updateLeadPipelineStage(leadId, stage);
    } catch (err) {
      console.error(err);
      loadLeads();
    }
  };

  const headerActions = (
    <>
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
      <Button variant="outline" size="sm" onClick={() => setShowCsvDialog(true)}>
        <Upload className="mr-2 h-4 w-4" /> CSV
      </Button>
      <Button size="sm" onClick={() => setShowChoiceDialog(true)}>
        <Plus className="mr-2 h-4 w-4" /> Ny lead
      </Button>
    </>
  );

  const tabs = (
    <Tabs value={activeJobType} onValueChange={(v) => setActiveJobType(v as JobType | "all")}>
      <TabsList className="h-auto gap-1 rounded-none border-b border-border/60 bg-transparent p-0">
        <TabsTrigger
          value="all"
          className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
        >
          <LayoutGrid className="h-4 w-4" />
          <span>Alla</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{activeLeads.length}</span>
        </TabsTrigger>
        {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((jt) => {
          const Icon = JOB_TAB_ICONS[jt];
          const count = activeLeads.filter((l) => l.jobType === jt).length;
          return (
            <TabsTrigger
              key={jt}
              value={jt}
              className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Icon className="h-4 w-4" />
              <span>{JOB_TYPE_LABELS[jt]}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{count}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );

  const meta = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Totalt</span>
        <span className="font-medium tabular-nums text-foreground">{activeLeads.length}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Visar</span>
        <span className="font-medium tabular-nums text-foreground">{filteredLeads.length}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Vy</span>
        <span className="font-medium text-foreground">{view === "kanban" ? "Kanban-board" : "Tabell"}</span>
      </span>
    </>
  );

  return (
    <AppShell
      title="Leads"
      description="Hantera inkommande och pågående leads. Drag-and-drop mellan pipeline-steg eller bläddra som tabell."
      meta={meta}
      actions={headerActions}
      tabs={tabs}
    >
      <div className="space-y-6">
        <KpiCards leads={jobTypeLeads} />

        <section className="rounded-xl border border-border/70 bg-card/40 shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)]">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-foreground">Filter</h2>
              <p className="text-[11.5px] text-muted-foreground">Förfina listan med region, kommun, status och fastighetsdata</p>
            </div>
          </div>
          <div className="p-5">
            <FilterPanel
              search={search}
              onSearchChange={setSearch}
              region={region}
              onRegionChange={setRegion}
              municipality={municipality}
              onMunicipalityChange={setMunicipality}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              assignedFilter={assignedFilter}
              onAssignedFilterChange={setAssignedFilter}
              createdByFilter={createdByFilter}
              onCreatedByFilterChange={setCreatedByFilter}
              needsOfferFilter={needsOfferFilter}
              onNeedsOfferFilterChange={setNeedsOfferFilter}
              onReset={resetFilters}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-foreground">
                {view === "kanban" ? "Pipeline" : "Lead-tabell"}
              </h2>
              <p className="text-[11.5px] text-muted-foreground">
                {loading
                  ? "Laddar leads..."
                  : `${filteredLeads.filter((l) => l.pipelineStage === activePipeline).length} av ${jobTypeLeads.filter((l) => l.pipelineStage === activePipeline).length} ${
                      activeJobType === "all" ? "leads" : JOB_TYPE_LABELS[activeJobType].toLowerCase()
                    }`}
              </p>
            </div>
            <div className="flex rounded-md border border-border bg-card/60 p-0.5">
              {(["inkommande_webb", "saljpanel"] as const).map((stage) => {
                const count = jobTypeLeads.filter((l) => l.pipelineStage === stage).length;
                const label = stage === "inkommande_webb" ? "Inkommande webb" : "admin.vt6 leads";
                const active = activePipeline === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => setActivePipeline(stage)}
                    className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
                      active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={view === "kanban" ? "p-4" : ""}>
            {view === "kanban" ? (
              <LeadKanban
                leads={filteredLeads.filter((l) => l.pipelineStage === activePipeline)}
                onSelect={setSelectedLead}
                onStageChange={handleStageChange}
                stages={[activePipeline]}
              />
            ) : (
              <LeadTable leads={filteredLeads.filter((l) => l.pipelineStage === activePipeline)} onSelect={setSelectedLead} />
            )}
          </div>
        </section>
      </div>

      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={loadLeads} />
      )}
      <AddLeadDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={loadLeads}
        defaultJobType={activeJobType === "all" ? "roof_replacement" : activeJobType}
      />
      <CsvImportDialog
        open={showCsvDialog}
        onClose={() => setShowCsvDialog(false)}
        onImported={loadLeads}
        jobType={activeJobType === "all" ? "roof_replacement" : activeJobType}
      />
      <AiGenerateLeadsDialog open={showAiDialog} onClose={() => setShowAiDialog(false)} onCreated={loadLeads} />
      <NewLeadChoiceDialog
        open={showChoiceDialog}
        onClose={() => setShowChoiceDialog(false)}
        onChooseAi={() => {
          setShowChoiceDialog(false);
          setShowAiDialog(true);
        }}
        onChooseManual={() => {
          setShowChoiceDialog(false);
          setShowAddDialog(true);
        }}
      />
    </AppShell>
  );
}
