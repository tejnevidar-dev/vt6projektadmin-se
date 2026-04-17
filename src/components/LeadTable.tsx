import { Phone, MapPin, Calendar, FileText, ChevronRight, Hammer, Droplets, Wrench } from "lucide-react";
import type { Lead, LeadStatus, JobType } from "@/lib/types";
import { JOB_TYPE_LABELS } from "@/lib/types";

interface LeadTableProps {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  cold: { label: "Kall", className: "bg-secondary text-secondary-foreground" },
  warm: { label: "Varm", className: "bg-accent/20 text-accent-foreground" },
  hot: { label: "Het", className: "bg-destructive/15 text-destructive" },
  customer: { label: "Kund", className: "bg-success/15 text-success" },
  lost: { label: "Förlorad", className: "bg-muted text-muted-foreground" },
};

const jobTypeConfig: Record<JobType, { className: string; icon: typeof Hammer }> = {
  roof_replacement: { className: "bg-primary/15 text-primary", icon: Hammer },
  roof_cleaning: { className: "bg-info/15 text-info", icon: Droplets },
  light_roof_work: { className: "bg-accent/20 text-accent-foreground", icon: Wrench },
};

export function LeadTable({ leads, onSelect }: LeadTableProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Inga leads matchar dina filter</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Prova att ändra filtren ovan</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Namn</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Telefon</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Adress</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Byggnadsår</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Takålder</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Bygglov</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const status = statusConfig[lead.status];
              return (
                <tr
                  key={lead.id}
                  onClick={() => onSelect(lead)}
                  className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-card-foreground">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.age} år</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`tel:${lead.phone.replace(/[\s-]/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {lead.phone}
                    </a>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="max-w-[200px] truncate">{lead.address}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {lead.buildYear}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className={`font-medium ${lead.roofAge > 40 ? "text-destructive" : "text-muted-foreground"}`}>
                      {lead.roofAge} år
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {lead.hasRoofPermit && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                        <FileText className="h-3 w-3" />
                        Ja
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
