import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCards } from "@/components/KpiCards";
import { FilterPanel } from "@/components/FilterPanel";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { mockLeads, type Lead, type LeadStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Sälj tak – Säljpanel leads" },
      { name: "description", content: "Säljpanel för takfirmor – hantera leads, filtrera byggnader och hitta kunder." },
    ],
  }),
});

function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [maxBuildYear, setMaxBuildYear] = useState(1986);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [onlyWithPermit, setOnlyWithPermit] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
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
  }, [leads, search, region, municipality, maxBuildYear, statusFilter, onlyWithPermit]);

  const resetFilters = () => {
    setSearch("");
    setRegion("");
    setMunicipality("");
    setMaxBuildYear(1986);
    setStatusFilter("all");
    setOnlyWithPermit(false);
  };

  const handleAddLead = (lead: Lead) => {
    setLeads((prev) => [lead, ...prev]);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Sälj tak</h1>
              <p className="text-xs text-muted-foreground">Säljpanel leads</p>
            </div>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Ny lead
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <KpiCards leads={leads} />
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
            {filteredLeads.length} av {leads.length} leads
          </p>
        </div>
        <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
      </main>

      {/* Dialogs */}
      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
      <AddLeadDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddLead}
      />
    </div>
  );
}
