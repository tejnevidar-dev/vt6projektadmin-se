import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REGIONS, MUNICIPALITIES, type LeadStatus } from "@/lib/mock-data";

interface FilterPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  region: string;
  onRegionChange: (v: string) => void;
  municipality: string;
  onMunicipalityChange: (v: string) => void;
  maxBuildYear: number;
  onMaxBuildYearChange: (v: number) => void;
  statusFilter: LeadStatus | "all";
  onStatusFilterChange: (v: LeadStatus | "all") => void;
  onlyWithPermit: boolean;
  onOnlyWithPermitChange: (v: boolean) => void;
  onReset: () => void;
}

export function FilterPanel({
  search,
  onSearchChange,
  region,
  onRegionChange,
  municipality,
  onMunicipalityChange,
  maxBuildYear,
  onMaxBuildYearChange,
  statusFilter,
  onStatusFilterChange,
  onlyWithPermit,
  onOnlyWithPermitChange,
  onReset,
}: FilterPanelProps) {
  const municipalities = region ? MUNICIPALITIES[region] || [] : [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-card-foreground">Filter & Sök</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Search */}
        <div className="relative xl:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök namn, adress, telefon..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Region */}
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

        {/* Municipality */}
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

        {/* Build year */}
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap text-xs text-muted-foreground">Byggt före</label>
          <Input
            type="number"
            value={maxBuildYear}
            onChange={(e) => onMaxBuildYearChange(Number(e.target.value))}
            min={1900}
            max={2026}
            className="w-full"
          />
        </div>

        {/* Status */}
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
      </div>

      <div className="mt-3 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyWithPermit}
            onChange={(e) => onOnlyWithPermitChange(e.target.checked)}
            className="rounded border-input accent-primary"
          />
          Har bygglov (tak)
        </label>
        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
          <RotateCcw className="mr-1 h-3 w-3" />
          Rensa filter
        </Button>
      </div>
    </div>
  );
}
