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
  head: () => ({ meta: [{ title: "Leads – Sälj tak" }] }),
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
  const [maxBuildYear, setMaxBuildYear] = useState(1986);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [onlyWithPermit, setOnlyWithPermit] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [activeJobType, setActiveJobType] = useState<JobType | "all">("all");
  const [view, setView] = useState<"kanban" | "table">("kanban");

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

  const jobTypeLeads = useMemo(
    () => (activeJobType === "all" ? leads : leads.filter((l) => l.jobType === activeJobType)),
    [leads, activeJobType]
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
      if (lead.buildYear > maxBuildYear) return false;
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (onlyWithPermit && !lead.hasRoofPermit) return false;
      return true;
    });
  }, [jobTypeLeads, search, region, municipality, maxBuildYear, statusFilter, onlyWithPermit]);

  const resetFilters = () => {
    setSearch("");
    setRegion("");
    setMunicipality("");
    setMaxBuildYear(1986);
    setStatusFilter("all");
    setOnlyWithPermit(false);
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
      <div className="flex rounded-md border border-border bg-card p-0.5">
        <button
          onClick={() => setView("kanban")}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <KanbanSquare className="h-3.5 w-3.5" /> Board
        </button>
        <button
          onClick={() => setView("table")}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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

  return (
    <AppShell title="Leads" actions={headerActions}>
      <div className="mx-auto max-w-[1600px] space-y-5">
        <Tabs value={activeJobType} onValueChange={(v) => setActiveJobType(v as JobType | "all")}>
          <TabsList className="grid h-auto w-full grid-cols-4 p-1">
            <TabsTrigger value="all" className="gap-2 py-2">
              <LayoutGrid className="h-4 w-4" />
              <span>Alla</span>
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {leads.length}
              </span>
            </TabsTrigger>
            {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((jt) => {
              const Icon = JOB_TAB_ICONS[jt];
              const count = leads.filter((l) => l.jobType === jt).length;
              return (
                <TabsTrigger key={jt} value={jt} className="gap-2 py-2">
                  <Icon className="h-4 w-4" />
                  <span>{JOB_TYPE_LABELS[jt]}</span>
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <KpiCards leads={jobTypeLeads} />
        <FilterPanel
          search={search}
          onSearchChange={setSearch}
          region={region}
          onRegionChange={setRegion}
          municipality={municipality}
          onMunicipalityChange={setMunicipality}
          maxBuildYear={maxBuildYear}
          onMaxBuildYearChange={setMaxBuildYear}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onlyWithPermit={onlyWithPermit}
          onOnlyWithPermitChange={setOnlyWithPermit}
          onReset={resetFilters}
        />

        <div className="text-sm text-muted-foreground">
          {loading
            ? "Laddar..."
            : `${filteredLeads.length} av ${jobTypeLeads.length} ${
                activeJobType === "all" ? "leads" : JOB_TYPE_LABELS[activeJobType].toLowerCase()
              }`}
        </div>

        {view === "kanban" ? (
          <LeadKanban leads={filteredLeads} onSelect={setSelectedLead} onStageChange={handleStageChange} />
        ) : (
          <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
        )}
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
