import { useState } from "react";
import { Phone, MapPin, Calendar, FileText, ChevronRight, Hammer, Droplets, Wrench, Flame, Trash2, ArrowRight, UserPlus } from "lucide-react";
import type { Lead, LeadStatus, JobType, PipelineStage } from "@/lib/types";
import { JOB_TYPE_LABELS, PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/lib/types";
import { scoreLabel } from "@/lib/lead-scoring";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bulkUpdateStage, bulkDelete, bulkAssign } from "@/lib/leads-api";
import { fetchSaljare, type Saljare } from "@/lib/saljare-api";
import { useEffect } from "react";

interface LeadTableProps {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  selectedId?: string | null;
  onBulkActionDone?: () => void;
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

export function LeadTable({ leads, onSelect, selectedId, onBulkActionDone }: LeadTableProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saljare, setSaljare] = useState<Saljare[]>([]);

  useEffect(() => {
    fetchSaljare().then(setSaljare).catch(() => setSaljare([]));
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allChecked = leads.length > 0 && leads.every((l) => checked.has(l.id));
  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(leads.map((l) => l.id)));
  };

  const ids = Array.from(checked);

  const handleBulkStage = async (stage: PipelineStage) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await bulkUpdateStage(ids, stage);
      setChecked(new Set());
      onBulkActionDone?.();
    } finally {
      setBusy(false);
    }
  };
  const handleBulkAssign = async (userId: string) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const assignee = saljare.find((s) => s.id === userId);
      await bulkAssign(ids, userId === "__none" ? null : userId, assignee?.display_name);
      setChecked(new Set());
      onBulkActionDone?.();
    } finally {
      setBusy(false);
    }
  };
  const handleBulkDelete = async () => {
    if (ids.length === 0) return;
    if (!confirm(`Ta bort ${ids.length} leads permanent?`)) return;
    setBusy(true);
    try {
      await bulkDelete(ids);
      setChecked(new Set());
      onBulkActionDone?.();
    } finally {
      setBusy(false);
    }
  };

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
    <div className="space-y-3">
      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{checked.size} valda</span>
          <Select disabled={busy} onValueChange={(v) => handleBulkStage(v as PipelineStage)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Flytta till…" /></SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  <ArrowRight className="mr-1 inline h-3 w-3" /> {PIPELINE_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select disabled={busy} onValueChange={handleBulkAssign}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Tilldela till…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Ingen</SelectItem>
              {saljare.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <UserPlus className="mr-1 inline h-3 w-3" /> {s.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={busy} onClick={handleBulkDelete} className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10">
            <Trash2 className="mr-1 h-3 w-3" /> Ta bort
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())} className="ml-auto h-8">Avmarkera</Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-3">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Markera alla" />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Namn</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Score</th>
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
                const isSelected = selectedId === lead.id;
                const isChecked = checked.has(lead.id);
                const score = scoreLabel(lead.score);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelect(lead)}
                    aria-selected={isSelected}
                    className={`cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30 ${
                      isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40 hover:bg-primary/15" : ""
                    } ${isChecked ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isChecked} onCheckedChange={() => toggle(lead.id)} aria-label={`Markera ${lead.name}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-card-foreground">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.age} år</p>
                        </div>
                        {(() => {
                          const jt = jobTypeConfig[lead.jobType];
                          const Icon = jt.icon;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${jt.className}`}
                              title={JOB_TYPE_LABELS[lead.jobType]}
                            >
                              <Icon className="h-3 w-3" />
                              <span className="hidden sm:inline">{JOB_TYPE_LABELS[lead.jobType]}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${score.className}`} title={`${lead.score}/100`}>
                        <Flame className="h-3 w-3" />
                        {lead.score}
                      </span>
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
    </div>
  );
}
