import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { LeadKanban } from "@/components/LeadKanban";
import { LeadTable } from "@/components/LeadTable";
import { LeadDetail } from "@/components/LeadDetail";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchLeads, updateLeadPipelineStage } from "@/lib/leads-api";
import { waitForJobByLead, type JobWithLead } from "@/lib/jobs-api";
import { listJobs } from "@/lib/jobs.functions";
import { fetchSaljare, type Saljare } from "@/lib/saljare-api";
import type { Lead, PipelineStage, JobType } from "@/lib/types";
import { PIPELINE_STAGE_LABELS, JOB_TYPE_LABELS, JOB_TYPES, hasIncompleteBooking, leadMissingRotUnderlag } from "@/lib/types";
import { KanbanSquare, Table as TableIcon, Search, X, UserCheck, UserPlus, AlertTriangle, Calendar } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState<JobType | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [createdByFilter, setCreatedByFilter] = useState<string>("all");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [bookingSort, setBookingSort] = useState<"none" | "soonest" | "latest">(stage === "bokad" ? "soonest" : "none");
  const [saljare, setSaljare] = useState<Saljare[]>([]);
  const [jobs, setJobs] = useState<JobWithLead[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    fetchSaljare().then(setSaljare).catch(() => setSaljare([]));
  }, []);

  useEffect(() => {
    if (stage !== "pagaende") return;
    setJobsLoading(true);
    listJobs()
      .then((data) => setJobs((data ?? []).filter((j) => j.status === "pagaende")))
      .catch((err) => console.error(err))
      .finally(() => setJobsLoading(false));
  }, [stage]);

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

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = stageLeads.filter((lead) => {
      if (jobTypeFilter !== "all" && lead.jobType !== jobTypeFilter) return false;
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
      if (incompleteOnly && !hasIncompleteBooking(lead)) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.address.toLowerCase().includes(q)
      );
    });
    if (bookingSort !== "none") {
      const dir = bookingSort === "soonest" ? 1 : -1;
      filtered.sort((a, b) => {
        const ta = a.bookingDate ? new Date(a.bookingDate).getTime() : null;
        const tb = b.bookingDate ? new Date(b.bookingDate).getTime() : null;
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return (ta - tb) * dir;
      });
    }
    return filtered;
  }, [stageLeads, search, jobTypeFilter, assignedFilter, createdByFilter, incompleteOnly, bookingSort]);

  const incompleteCount = useMemo(
    () => stageLeads.filter(hasIncompleteBooking).length,
    [stageLeads]
  );

  const handleStageChange = async (leadId: string, newStage: PipelineStage) => {
    if (newStage === "bokad") {
      const lead = leads.find((l) => l.id === leadId);
      const missing = lead ? leadMissingRotUnderlag(lead) : [];
      if (missing.length > 0) {
        toast.error(`Kan inte bokas – saknas: ${missing.join(", ")}`, {
          description: "Öppna leaden och fyll i ROT-underlaget innan bokning.",
        });
        return;
      }
    }
    if (newStage === "offererad") {
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        setOfferValuesFor(lead);
        return;
      }
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipelineStage: newStage } : l)));
    const toastId = toast.loading(
      newStage === "pagaende" ? "Flyttar till Pågående…" : `Flyttar till ${PIPELINE_STAGE_LABELS[newStage]}…`
    );
    try {
      await updateLeadPipelineStage(leadId, newStage);
      if (newStage === "pagaende") {
        toast.loading("Skapar projekt under Projekt-fliken…", { id: toastId });
        const ok = await waitForJobByLead(leadId);
        if (ok) {
          toast.success("Projekt skapat under Projekt-fliken", { id: toastId });
        } else {
          toast.warning("Status uppdaterad – projektet syns inom kort", { id: toastId });
        }
      } else {
        toast.success(`Flyttad till ${PIPELINE_STAGE_LABELS[newStage]}`, { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte uppdatera status", { id: toastId });
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

  const hasActiveFilters =
    search.trim() !== "" ||
    jobTypeFilter !== "all" ||
    assignedFilter !== "all" ||
    createdByFilter !== "all" ||
    incompleteOnly;

  return (
    <AppShell title={PIPELINE_STAGE_LABELS[stage]} description={description} actions={headerActions}>
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/40">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value.slice(0, 100))}
                placeholder="Sök på namn eller adress…"
                className="pl-9"
                maxLength={100}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/60 p-0.5">
              <button
                onClick={() => setJobTypeFilter("all")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  jobTypeFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Alla jobb
              </button>
              {JOB_TYPES.map((jt) => (
                <button
                  key={jt}
                  onClick={() => setJobTypeFilter(jt)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    jobTypeFilter === jt
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {JOB_TYPE_LABELS[jt]}
                </button>
              ))}
            </div>

            <div className="relative">
              <UserCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                title="Filtrera på tilldelad säljare"
              >
                <option value="all">Tilldelad: Alla</option>
                <option value="unassigned">Otilldelade</option>
                {saljare.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={createdByFilter}
                onChange={(e) => setCreatedByFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                title="Filtrera på vem som lade in/sålde leaden"
              >
                <option value="all">Inlagd av: Alla</option>
                <option value="unknown">Okänd</option>
                {saljare.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
            </div>

            {stage === "bokad" && (
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={bookingSort}
                  onChange={(e) => setBookingSort(e.target.value as "none" | "soonest" | "latest")}
                  className="h-9 rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  title="Sortera på bokad arbetsstart"
                >
                  <option value="soonest">Närmast först</option>
                  <option value="latest">Senast först</option>
                  <option value="none">Ingen sortering</option>
                </select>
              </div>
            )}

            {stage === "bokad" && (
              <button
                onClick={() => setIncompleteOnly((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  incompleteOnly
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                }`}
                title="Visa endast bokade leads som saknar pris eller tilldelning"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Saknar info
                <span className="rounded-full bg-destructive/15 px-1.5 py-0 text-[10px] font-semibold text-destructive">
                  {incompleteCount}
                </span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setJobTypeFilter("all");
                  setAssignedFilter("all");
                  setCreatedByFilter("all");
                  setIncompleteOnly(false);
                  setBookingSort(stage === "bokad" ? "soonest" : "none");
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Återställ
              </button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card/40">
          <div className="border-b border-border/60 px-5 py-3">
            <h2 className="text-[13px] font-semibold text-foreground">{PIPELINE_STAGE_LABELS[stage]}</h2>
            <p className="text-[11.5px] text-muted-foreground">
              {loading
                ? "Laddar..."
                : `${filteredLeads.length} av ${stageLeads.length} leads`}
            </p>
          </div>
          <div className={view === "kanban" ? "p-4" : ""}>
            {view === "kanban" ? (
              <LeadKanban leads={filteredLeads} onSelect={setSelectedLead} onStageChange={handleStageChange} stages={[stage]} />
            ) : (
              <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
            )}
          </div>
        </section>

        {stage === "pagaende" && (
          <section className="rounded-xl border border-border/70 bg-card/40">
            <div className="border-b border-border/60 px-5 py-3">
              <h2 className="text-[13px] font-semibold text-foreground">Pågående projekt</h2>
              <p className="text-[11.5px] text-muted-foreground">
                {jobsLoading ? "Laddar..." : `${jobs.length} projekt`}
              </p>
            </div>
            <div className="p-4">
              {jobsLoading ? (
                <p className="text-center text-muted-foreground py-6">Laddar…</p>
              ) : jobs.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Inga pågående projekt.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kund / projekt</TableHead>
                      <TableHead>Adress</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Källa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((j) => {
                      const kundnamn = j.lead?.name ?? j.customer_name ?? "—";
                      const adress = j.property
                        ? `${j.property.address}, ${j.property.municipality}`
                        : j.address ?? "—";
                      return (
                        <TableRow key={j.id} className="cursor-pointer hover:bg-muted/40">
                          <TableCell>
                            <Link to="/jobb/$jobId" params={{ jobId: j.id }} className="font-medium hover:underline">
                              {kundnamn}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{adress}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {j.assignment_type === "underentreprenor"
                                ? "UE"
                                : j.assignment_type === "arbetsledare"
                                  ? "Arbetsledare"
                                  : "Ej tilldelad"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {j.lead_id ? "Lead" : "Manuellt"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>
        )}
      </div>

      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={load} />
      )}
    </AppShell>
  );
}
