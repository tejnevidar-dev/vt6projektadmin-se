import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Home, Upload, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCards } from "@/components/KpiCards";
import { FilterPanel } from "@/components/FilterPanel";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { fetchLeads } from "@/lib/leads-api";
import { useAuth } from "@/hooks/use-auth";
import type { Lead, LeadStatus } from "@/lib/types";

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
              <h1 className="text-lg font-bold text-foreground">Sälj tak</h1>
              <p className="text-xs text-muted-foreground">Säljpanel leads</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCsvDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              CSV-import
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ny lead
            </Button>
          </div>
        </div>
      </header>

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
            {loading ? "Laddar..." : `${filteredLeads.length} av ${leads.length} leads`}
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
      />
      <CsvImportDialog
        open={showCsvDialog}
        onClose={() => setShowCsvDialog(false)}
        onImported={loadLeads}
      />
    </div>
  );
}
