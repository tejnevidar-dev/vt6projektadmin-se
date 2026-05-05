import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Home, Upload, LogOut, Hammer, Droplets, Wrench, LayoutGrid, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KpiCards } from "@/components/KpiCards";
import { FilterPanel } from "@/components/FilterPanel";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { AiGenerateLeadsDialog } from "@/components/AiGenerateLeadsDialog";
import { NewLeadChoiceDialog } from "@/components/NewLeadChoiceDialog";
import { fetchLeads } from "@/lib/leads-api";
import { useAuth } from "@/hooks/use-auth";
import type { Lead, LeadStatus, JobType, PipelineStage } from "@/lib/types";
import { JOB_TYPE_LABELS, PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/lib/types";

const JOB_TAB_ICONS: Record<JobType, typeof Hammer> = {
  roof_replacement: Hammer,
  roof_cleaning: Droplets,
  light_roof_work: Wrench,
};

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Säljpanel – Leads" },
      { name: "description", content: "Säljpanel för takfirmor – hantera leads, filtrera byggnader och hitta kunder." },
    ],
  }),
});

function Dashboard() {
  const { isAuthenticated, loading: authLoading, signOut, user } = useAuth();
  const navigate = useNavigate();
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
  const [pipelineView, setPipelineView] = useState<PipelineStage>("saljpanel");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

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

  const stageLeads = useMemo(
    () => leads.filter((l) => l.pipelineStage === pipelineView),
    [leads, pipelineView]
  );

  const jobTypeLeads = useMemo(
    () => (activeJobType === "all" ? stageLeads : stageLeads.filter((l) => l.jobType === activeJobType)),
    [stageLeads, activeJobType]
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Säljpanel </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {PIPELINE_STAGE_LABELS[pipelineView]}
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {stageLeads.length}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {PIPELINE_STAGES.map((stage) => {
                  const count = leads.filter((l) => l.pipelineStage === stage).length;
                  const active = stage === pipelineView;
                  return (
                    <DropdownMenuItem
                      key={stage}
                      onClick={() => setPipelineView(stage)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2">
                        {active ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="w-3.5" />}
                        {PIPELINE_STAGE_LABELS[stage]}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setShowCsvDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              CSV-import
            </Button>
            <Button onClick={() => setShowChoiceDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ny lead
            </Button>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Logga ut">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <Tabs value={activeJobType} onValueChange={(v) => setActiveJobType(v as JobType | "all")}>
          <TabsList className="grid h-auto w-full grid-cols-4 p-1">
            <TabsTrigger value="all" className="gap-2 py-2">
              <LayoutGrid className="h-4 w-4" />
              <span>Alla</span>
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground data-[state=active]:bg-primary/10">
                {stageLeads.length}
              </span>
            </TabsTrigger>
            {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((jt) => {
              const Icon = JOB_TAB_ICONS[jt];
              const count = stageLeads.filter((l) => l.jobType === jt).length;
              return (
                <TabsTrigger key={jt} value={jt} className="gap-2 py-2">
                  <Icon className="h-4 w-4" />
                  <span>{JOB_TYPE_LABELS[jt]}</span>
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground data-[state=active]:bg-primary/10">
                    {count}
                  </span>
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Laddar..."
              : `${filteredLeads.length} av ${jobTypeLeads.length} ${
                  activeJobType === "all" ? "leads" : JOB_TYPE_LABELS[activeJobType].toLowerCase()
                }`}
          </p>
        </div>
        <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
      </main>

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
      <AiGenerateLeadsDialog
        open={showAiDialog}
        onClose={() => setShowAiDialog(false)}
        onCreated={loadLeads}
      />
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
    </div>
  );
}
