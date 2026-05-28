import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, RotateCcw, UserCheck, UserPlus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REGIONS, MUNICIPALITIES, type LeadStatus } from "@/lib/types";
import { fetchSaljare, type Saljare } from "@/lib/saljare-api";

interface FilterPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  region: string;
  onRegionChange: (v: string) => void;
  municipality: string;
  onMunicipalityChange: (v: string) => void;
  statusFilter: LeadStatus | "all";
  onStatusFilterChange: (v: LeadStatus | "all") => void;
  assignedFilter?: string; // user_id | "all" | "unassigned"
  onAssignedFilterChange?: (v: string) => void;
  createdByFilter?: string;
  onCreatedByFilterChange?: (v: string) => void;
  onReset: () => void;
}

export function FilterPanel({
  search,
  onSearchChange,
  region,
  onRegionChange,
  municipality,
  onMunicipalityChange,
  statusFilter,
  onStatusFilterChange,
  assignedFilter = "all",
  onAssignedFilterChange,
  createdByFilter = "all",
  onCreatedByFilterChange,
  onReset,
}: FilterPanelProps) {
  const municipalities = region ? MUNICIPALITIES[region] || [] : [];
  const [saljare, setSaljare] = useState<Saljare[]>([]);

  useEffect(() => {
    fetchSaljare().then(setSaljare).catch(() => setSaljare([]));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-card-foreground">Filter & Sök</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök namn, adress, telefon..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={region}
          onChange={(e) => {
            onRegionChange(e.target.value);
            onMunicipalityChange("");
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Alla län</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          value={municipality}
          onChange={(e) => onMunicipalityChange(e.target.value)}
          disabled={!region}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Alla kommuner</option>
          {municipalities.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as LeadStatus | "all")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Alla statusar</option>
          <option value="cold">Kall</option>
          <option value="warm">Varm</option>
          <option value="hot">Het</option>
          <option value="customer">Kund</option>
          <option value="lost">Förlorad</option>
        </select>

        {onAssignedFilterChange && (
          <div className="relative">
            <UserCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={assignedFilter}
              onChange={(e) => onAssignedFilterChange(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              title="Filtrera på tilldelad säljare"
            >
              <option value="all">Tilldelad: Alla</option>
              <option value="unassigned">Otilldelade</option>
              {saljare.map((s) => (
                <option key={s.id} value={s.id}>Tilldelad: {s.display_name}</option>
              ))}
            </select>
          </div>
        )}

        {onCreatedByFilterChange && (
          <div className="relative">
            <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={createdByFilter}
              onChange={(e) => onCreatedByFilterChange(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              title="Filtrera på vem som lade in/sålde leaden"
            >
              <option value="all">Inlagd av: Alla</option>
              <option value="unknown">Okänd skapare</option>
              {saljare.map((s) => (
                <option key={s.id} value={s.id}>Inlagd av: {s.display_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center">
        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
          <RotateCcw className="mr-1 h-3 w-3" />
          Rensa filter
        </Button>
      </div>
    </div>
  );
}
