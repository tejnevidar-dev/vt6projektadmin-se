import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import {
  getJob,
} from "@/lib/jobs.functions";
import {
  listJobMembers,
  listTimeEntries,
  listSelfChecks,
  addJobMember,
  removeJobMember,
  addTimeEntry,
  updateJobStatus,
  uploadWorkOrder,
  processWorkOrder,
  getWorkOrderSignedUrl,
  deleteWorkOrder,
  sendSelfChecksToClient,
  updateJobClientInfo,
  updateJobPrice,
  deleteSelfCheck,
  assignJobForeman,
  updateJobEstimatedHours,
  updateJobHideTimeEstimate,
  listJobEstimateAudit,
  updateJobType,
  type JobWithLead,
  type JobMember,
  type TimeEntry,
  type SelfCheck,
  type JobStatus,
  type JobEstimateAuditEntry,
} from "@/lib/jobs-api";
import { listUsersWithRole, type RoleUser } from "@/lib/leads-api";
import { SelfCheckDialog } from "@/components/SelfCheckDialog";
import { SELF_CHECK_TEMPLATES, getSelfCheckTemplateLabel, getApplicableTemplates } from "@/lib/self-check-templates";

import { WorkOrderPanel } from "@/components/WorkOrderPanel";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  UserPlus,
  Plus,
  Trash2,
  ClipboardCheck,
  FileText,
  Upload,
  Sparkles,
  ExternalLink,
  Pencil,
  Play,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jobb/$jobId")({
  component: () => (
    <RequireAuth>
      <JobDetailPage />
    </RequireAuth>
  ),
});

const STATUS_LABEL: Record<JobStatus, string> = {
  ej_paborjad: "Ej påbörjad",
  pagaende: "Pågående",
  klar: "Klar",
};

function JobDetailPage() {
  const { jobId } = useParams({ from: "/jobb/$jobId" });
  const { user } = useAuth();
  const { roles, isAdmin } = useUserRoles();
  const [job, setJob] = useState<JobWithLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<JobMember[]>([]);
  const [times, setTimes] = useState<TimeEntry[]>([]);
  const [checks, setChecks] = useState<SelfCheck[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [foremanOpen, setForemanOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateHistoryOpen, setEstimateHistoryOpen] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const j = await getJob({ data: { id: jobId } });
      setJob(j);
      if (j) {
        const [m, t, c] = await Promise.all([
          listJobMembers(jobId),
          listTimeEntries(jobId),
          listSelfChecks(jobId),
        ]);
        setMembers(m);
        setTimes(t);
        setChecks(c);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [jobId]);

  const isOwner = !!job && user?.id === job.assigned_to;
  const canInvite = isAdmin || isOwner;
  const isUE = job?.assignment_type === "underentreprenor";
  // Hantverkare/arbetsledare logs time. UE doesn't (fixed price).
  const canLogTime =
    !!job &&
    !isUE &&
    (isOwner || members.some((m) => m.user_id === user?.id));

  async function handleStatus(next: JobStatus) {
    if (!job) return;
    if (next === "klar") {
      const submittedKeys = new Set(
        checks.filter((c) => c.completed_at).map((c) => c.template_key),
      );
      const applicable = getApplicableTemplates(job.lead?.job_type);
      const missing = applicable.filter((t) => !submittedKeys.has(t.key));
      if (missing.length > 0) {
        toast.error(
          `Kan inte avsluta: egenkontroll saknas för ${missing.map((m) => m.name).join(", ")}. Alla egenkontroller måste vara inlämnade innan projektet kan markeras som klart och timmar registreras.`,
        );
        return;
      }
    }
    try {
      await updateJobStatus(job.id, next);
      toast.success("Status uppdaterad");

      // Auto-send self-checks to client when project marked as klar
      if (next === "klar" && job.client_email && !job.self_checks_emailed_at) {
        try {
          const res = await sendSelfChecksToClient(job.id);
          toast.success(`Egenkontroller mejlade till ${res.to} (${res.count} st)`);
        } catch (e: any) {
          toast.error(`Status uppdaterad, men kunde inte mejla beställaren: ${e.message ?? ""}`);
        }
      } else if (next === "klar" && !job.client_email) {
        toast.message("Ingen beställarmejl angiven – egenkontroller skickades inte automatiskt");
      }

      void reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }


  if (loading) {
    return (
      <AppShell title="Projekt">
        <p className="text-muted-foreground">Laddar…</p>
      </AppShell>
    );
  }
  if (!job) {
    return (
      <AppShell title="Projekt">
        <p className="text-muted-foreground">Projektet hittades inte eller så har du inte åtkomst.</p>
        <Link to="/jobb" className="mt-4 inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Link>
      </AppShell>
    );
  }

  const titleName = job.lead?.name ?? job.customer_name ?? "Projekt";
  const descAddr = job.property
    ? `${job.property.address}, ${job.property.municipality}`
    : job.address ?? undefined;

  // Your role label (the role of the logged-in user on this project)
  const ROLE_LABEL: Record<string, string> = {
    admin: "Admin",
    saljare: "Säljare",
    arbetsledare: "Arbetsledare",
    hantverkare: "Hantverkare",
    underentreprenor: "Underentreprenör",
    viewer: "Tittare",
  };
  const priorityRoles = ["admin", "arbetsledare", "underentreprenor", "hantverkare", "saljare", "viewer"];
  const myRole = priorityRoles.find((r) => roles.includes(r as any)) ?? "—";
  const myRoleLabel = ROLE_LABEL[myRole] ?? myRole;

  // Hours budget: 600 kr/h. Price source: job.fixed_price (UE) or lead.price.
  const HOURLY_RATE = 600;
  const projectPrice = job.fixed_price ?? job.lead?.price ?? null;
  const estimatedHours =
    job.estimated_hours ?? (projectPrice != null ? projectPrice / HOURLY_RATE : null);
  const loggedHours = times
    .filter((t) => t.status !== "rejected")
    .reduce((sum, t) => sum + Number(t.hours || 0), 0);
  const remainingHours = estimatedHours != null ? estimatedHours - loggedHours : null;

  return (
    <AppShell
      title={titleName}
      description={descAddr}
      meta={
        <>
          <span>Din roll: <strong className="text-foreground">{myRoleLabel}</strong></span>
          <span>Status: <strong className="text-foreground">{STATUS_LABEL[job.status]}</strong></span>
          {isAdmin && (
            <span className="inline-flex items-center gap-1">
              Uppdragsgivare: <strong className="text-foreground">{job.client_company ?? "—"}</strong>
              {job.client_email && <span className="text-muted-foreground">({job.client_email})</span>}
              <Button size="icon" variant="ghost" className="h-5 w-5 ml-1" onClick={() => setClientOpen(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center gap-1">
              Pris: <strong className="text-foreground">{projectPrice != null ? `${Number(projectPrice).toLocaleString("sv-SE")} kr` : "—"}</strong>
              <Button size="icon" variant="ghost" className="h-5 w-5 ml-1" onClick={() => setPriceOpen(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </span>
          )}
          {isAdmin && job.self_checks_emailed_at && job.self_checks_emailed_to && (
            <span>Mejlat: <strong className="text-foreground">{new Date(job.self_checks_emailed_at).toLocaleDateString("sv-SE")} till {job.self_checks_emailed_to}</strong></span>
          )}
        </>
      }
      actions={
        <div className="flex flex-wrap gap-2 items-center">
          <Link to="/jobb" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Alla projekt
          </Link>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setForemanOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Tilldela arbetsledare
            </Button>
          )}
          {isAdmin && job.status === "ej_paborjad" && (
            <Button size="sm" onClick={() => handleStatus("pagaende")}>
              <Play className="mr-1.5 h-4 w-4" /> Starta projekt
            </Button>
          )}
          {isAdmin && job.status === "pagaende" && (
            <Button size="sm" onClick={() => handleStatus("klar")}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Markera som klar
            </Button>
          )}
          {isAdmin && job.status === "klar" && (
            <Button size="sm" variant="outline" onClick={() => handleStatus("pagaende")}>
              Återöppna
            </Button>
          )}
          {isAdmin && (
            <Select value={job.status} onValueChange={(v) => handleStatus(v as JobStatus)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ej_paborjad">Ej påbörjad</SelectItem>
                <SelectItem value="pagaende">Pågående</SelectItem>
                <SelectItem value="klar">Klar</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Uppskattade timmar</div>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  title={job.hide_time_estimate ? "Visa tidsuppskattning" : "Dölj tidsuppskattning"}
                  onClick={async () => {
                    try {
                      await updateJobHideTimeEstimate(job.id, !job.hide_time_estimate);
                      toast.success(job.hide_time_estimate ? "Tidsuppskattning visas nu" : "Tidsuppskattning dold");
                      void reload();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  {job.hide_time_estimate ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEstimateOpen(true)} title="Redigera tidsuppskattning">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEstimateHistoryOpen(true)} title="Historik">
                  <History className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="text-lg font-semibold text-foreground">
            {estimatedHours != null ? `${estimatedHours.toFixed(1)} h` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {job.hide_time_estimate && isAdmin ? "Dold för hantverkare/arbetsledare" : "Baserat på 600 kr/h"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Loggade timmar</div>
          <div className="text-lg font-semibold text-foreground">{loggedHours.toFixed(1)} h</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Timmar kvar</div>
          <div className={`text-lg font-semibold ${remainingHours != null && remainingHours < 0 ? "text-destructive" : "text-foreground"}`}>
            {remainingHours != null ? `${remainingHours.toFixed(1)} h` : "—"}
          </div>
        </div>
      </div>

      <Tabs defaultValue={job.work_order_summary ? "workorder" : "members"}>
        <TabsList>
          <TabsTrigger value="workorder">
            <FileText className="mr-1.5 h-4 w-4" /> Arbetsorder
          </TabsTrigger>
          <TabsTrigger value="members">Hantverkare ({members.length})</TabsTrigger>
          {!isUE && <TabsTrigger value="time">Timmar ({times.length})</TabsTrigger>}
          <TabsTrigger value="checks">Egenkontroller ({checks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="workorder" className="mt-4">
          <WorkOrderPanel
            job={job}
            canManage={isAdmin || isOwner}
            onChanged={reload}
          />
        </TabsContent>



        <TabsContent value="members" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              Inbjudna hantverkare som kan rapportera timmar och fylla i egenkontroller på detta projekt.
            </p>
            {canInvite && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-1.5 h-4 w-4" /> Bjud in
              </Button>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {members.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Inga hantverkare inbjudna än.
              </div>
            )}
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium text-sm">{m.profile?.display_name ?? m.profile?.email ?? m.user_id.slice(0, 8)}</div>
                  {m.profile?.email && <div className="text-xs text-muted-foreground">{m.profile.email}</div>}
                </div>
                {canInvite && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Ta bort från projektet?")) return;
                      try {
                        await removeJobMember(m.id);
                        toast.success("Borttagen");
                        void reload();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {!isUE && (
          <TabsContent value="time" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                Timmar rapporterade på detta projekt. Godkänns av arbetsledare innan löneutbetalning.
              </p>
              {canLogTime && (
                <Button size="sm" onClick={() => setTimeOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Logga timmar
                </Button>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {times.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Inga timmar loggade än.
                </div>
              )}
              {times.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div className="font-medium">{t.work_date} — {t.hours} h</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                  <Badge variant={t.status === "approved" ? "default" : t.status === "rejected" ? "destructive" : "secondary"}>
                    {t.status === "approved" ? "Godkänd" : t.status === "rejected" ? "Avvisad" : "Väntar"}
                  </Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="checks" className="mt-4">
          <ChecksTab
            jobId={job.id}
            jobType={job.job_type ?? job.lead?.job_type ?? undefined}
            isAdmin={isAdmin}
            checks={checks}
            currentUserId={user?.id ?? null}
            canCreate={isOwner || isAdmin || members.some((m) => m.user_id === user?.id)}
            onChanged={reload}
          />
        </TabsContent>
      </Tabs>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        existingUserIds={members.map((m) => m.user_id)}
        onPick={async (userId) => {
          try {
            await addJobMember(job.id, userId);
            toast.success("Inbjuden");
            setInviteOpen(false);
            void reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
      <ForemanDialog
        open={foremanOpen}
        onOpenChange={setForemanOpen}
        currentUserId={job.assigned_to}
        onPick={async (userId) => {
          try {
            await assignJobForeman(job.id, userId);
            toast.success("Arbetsledare tilldelad");
            setForemanOpen(false);
            void reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
      <TimeDialog
        open={timeOpen}
        onOpenChange={setTimeOpen}
        onSubmit={async (work_date, hours, description) => {
          try {
            await addTimeEntry({ job_id: job.id, work_date, hours, description });
            toast.success("Timmar loggade");
            setTimeOpen(false);
            void reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
      <ClientInfoDialog
        open={clientOpen}
        onOpenChange={setClientOpen}
        initial={{
          client_company: job.client_company,
          client_contact_name: job.client_contact_name,
          client_email: job.client_email,
        }}
        onSubmit={async (info) => {
          try {
            await updateJobClientInfo(job.id, info);
            toast.success("Beställaruppgifter uppdaterade");
            setClientOpen(false);
            void reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
      <PriceDialog
        open={priceOpen}
        onOpenChange={setPriceOpen}
        initialPrice={projectPrice}
        onSubmit={async (price) => {
          try {
            await updateJobPrice(job.id, price, job.lead_id ?? null);
            toast.success("Pris uppdaterat");
            setPriceOpen(false);
            void reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
      <EstimateDialog
        open={estimateOpen}
        onOpenChange={setEstimateOpen}
        initialHours={job.estimated_hours}
        onSubmit={async (hours) => {
          try {
            await updateJobEstimatedHours(job.id, hours);
            toast.success("Tidsuppskattning uppdaterad");
            setEstimateOpen(false);
            void reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
      <EstimateHistoryDialog
        open={estimateHistoryOpen}
        onOpenChange={setEstimateHistoryOpen}
        jobId={job.id}
      />
    </AppShell>
  );
}

function EstimateHistoryDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
}) {
  const [entries, setEntries] = useState<JobEstimateAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listJobEstimateAudit(jobId)
      .then(setEntries)
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, jobId]);
  function describe(e: JobEstimateAuditEntry) {
    if (e.action === "hide") return "Dolde tidsuppskattning";
    if (e.action === "show") return "Visade tidsuppskattning";
    const oldV = e.old_value != null ? `${Number(e.old_value).toFixed(1)} h` : "auto";
    const newV = e.new_value != null ? `${Number(e.new_value).toFixed(1)} h` : "auto";
    return `Ändrade tidsuppskattning: ${oldV} → ${newV}`;
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historik – tidsuppskattning</DialogTitle>
        </DialogHeader>
        <div className="py-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Laddar…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga ändringar registrerade ännu.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="py-2">
                  <div className="text-sm text-foreground">{describe(e)}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.user?.display_name || e.user?.email || "Okänd användare"} ·{" "}
                    {new Date(e.created_at).toLocaleString("sv-SE")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Stäng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PriceDialog({
  open,
  onOpenChange,
  initialPrice,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPrice: number | null;
  onSubmit: (price: number | null) => void | Promise<void>;
}) {
  const [value, setValue] = useState<string>(initialPrice != null ? String(initialPrice) : "");
  useEffect(() => {
    if (open) setValue(initialPrice != null ? String(initialPrice) : "");
  }, [open, initialPrice]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uppdatera pris</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="job-price">Pris (kr)</Label>
          <Input
            id="job-price"
            type="number"
            min="0"
            step="100"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="t.ex. 85000"
          />
          <p className="text-xs text-muted-foreground">
            Påverkar uppskattade timmar (600 kr/h) och fast pris för UE.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button
            onClick={() => onSubmit(value.trim() === "" ? null : Number(value))}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EstimateDialog({
  open,
  onOpenChange,
  initialHours,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialHours: number | null;
  onSubmit: (hours: number | null) => void | Promise<void>;
}) {
  const [value, setValue] = useState<string>(initialHours != null ? String(initialHours) : "");
  useEffect(() => {
    if (open) setValue(initialHours != null ? String(initialHours) : "");
  }, [open, initialHours]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redigera tidsuppskattning</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="job-estimate">Uppskattade timmar</Label>
          <Input
            id="job-estimate"
            type="number"
            min="0"
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="t.ex. 120"
          />
          <p className="text-xs text-muted-foreground">
            Om du lämnar fältet tomt beräknas timmar automatiskt från priset (600 kr/h).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button
            onClick={() => onSubmit(value.trim() === "" ? null : Number(value))}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  existingUserIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingUserIds: string[];
  onPick: (userId: string) => void;
}) {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      listUsersWithRole("hantverkare"),
      listUsersWithRole("arbetsledare"),
    ])
      .then(([h, a]) => {
        const map = new Map<string, RoleUser>();
        for (const u of [...h, ...a]) map.set(u.id, u);
        setUsers(Array.from(map.values()));
      })
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  const candidates = users.filter((u) => !existingUserIds.includes(u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bjud in hantverkare</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {!loading && candidates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ingen tillgänglig personal. Bjud in personal via Personal-sidan och be dem logga in minst en gång.
            </p>
          )}
          {candidates.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u.id)}
              className="w-full text-left rounded-md border border-border p-3 hover:bg-muted/40 transition"
            >
              <div className="font-medium text-sm">{u.display_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimeDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (work_date: string, hours: number, description?: string) => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("8");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setHours("8");
      setDesc("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Logga timmar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Datum</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Antal timmar</Label>
            <Input type="number" step="0.25" min="0.25" max="24" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div>
            <Label>Beskrivning (valfri)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Vad gjordes?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button
            onClick={() => {
              const h = parseFloat(hours);
              if (!isFinite(h) || h <= 0) {
                toast.error("Ange ett giltigt antal timmar");
                return;
              }
              onSubmit(date, h, desc || undefined);
            }}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientInfoDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: { client_company: string | null; client_contact_name: string | null; client_email: string | null };
  onSubmit: (info: { client_company: string | null; client_contact_name: string | null; client_email: string | null }) => void;
}) {
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open) {
      setCompany(initial.client_company ?? "");
      setContact(initial.client_contact_name ?? "");
      setEmail(initial.client_email ?? "");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redigera beställaruppgifter</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Företagsnamn</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="t.ex. Roslagstak AB" />
            <p className="mt-1 text-xs text-muted-foreground">Visas som "Hej [Företagsnamn]!" i mejlet.</p>
          </div>
          <div>
            <Label>Kontaktperson</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div>
            <Label>E-postadress</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bestallare@foretag.se" />
            <p className="mt-1 text-xs text-muted-foreground">Egenkontrollerna mejlas hit när projektet markeras klart.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button
            onClick={() =>
              onSubmit({
                client_company: company.trim() || null,
                client_contact_name: contact.trim() || null,
                client_email: email.trim() || null,
              })
            }
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecksTab({
  jobId,
  jobType,
  checks,
  currentUserId,
  canCreate,
  isAdmin,
  onChanged,
}: {
  jobId: string;
  jobType?: string;
  checks: SelfCheck[];
  currentUserId: string | null;
  canCreate: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const applicableTemplates = useMemo(() => getApplicableTemplates(jobType), [jobType]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SelfCheck | null>(null);
  const [newTemplateKey, setNewTemplateKey] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>(() => applicableTemplates[0]?.key ?? "");

  useEffect(() => {
    if (activeTab && !applicableTemplates.some((t) => t.key === activeTab)) {
      setActiveTab(applicableTemplates[0]?.key ?? "");
    }
  }, [applicableTemplates, activeTab]);

  function openNewForTemplate(key: string) {
    setEditing(null);
    setNewTemplateKey(key);
    setDialogOpen(true);
  }
  function openExisting(c: SelfCheck) {
    setEditing(c);
    setNewTemplateKey(undefined);
    setDialogOpen(true);
  }

  const submittedKeys = new Set(checks.filter((c) => c.completed_at).map((c) => c.template_key));
  const missingCount = applicableTemplates.filter((t) => !submittedKeys.has(t.key)).length;

  return (
    <>
      <div className="mb-3 space-y-2">
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-sm">
            <Label className="text-xs font-medium">Typ av arbete:</Label>
            <Select
              value={jobType ?? "none"}
              onValueChange={async (v) => {
                try {
                  await updateJobType(jobId, v === "none" ? null : v);
                  toast.success("Typ av arbete uppdaterad");
                  onChanged();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              <SelectTrigger className="h-8 w-[220px]">
                <SelectValue placeholder="Välj typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Alla mallar</SelectItem>
                <SelectItem value="roof_replacement">Takbyte</SelectItem>
                <SelectItem value="roof_cleaning">Taktvätt</SelectItem>
                <SelectItem value="light_roof_work">Lättare takarbeten</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Styr vilka egenkontrollmallar som visas nedan.
            </span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Varje moment har en egen flik. Alla moment måste vara inlämnade innan projektet kan
          markeras som klart och timmar registreras.
        </p>
        {missingCount > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {missingCount} moment saknar inlämnad egenkontroll.
          </div>
        )}
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto">
          {applicableTemplates.map((t) => {
            const tplChecks = checks.filter((c) => c.template_key === t.key);
            const submitted = tplChecks.some((c) => c.completed_at);
            return (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                {t.name}
                {submitted ? (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {applicableTemplates.map((t) => {
          const tplChecks = checks.filter((c) => c.template_key === t.key);
          const hasSubmitted = tplChecks.some((c) => c.completed_at);
          return (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {canCreate && (
                  <Button size="sm" onClick={() => openNewForTemplate(t.key)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    {hasSubmitted ? "Ny" : "Komplettera"}
                  </Button>
                )}
              </div>

              {(() => {
                const submittedChecks = tplChecks.filter((c) => c.completed_at);
                const isFieldAttached = (label: string, type: string) => {
                  for (const c of submittedChecks) {
                    const v = (c.data as Record<string, unknown> | null)?.[label];
                    if (type === "checkbox") {
                      if (v === true) return true;
                    } else {
                      if (typeof v === "string" && v.trim().length > 0) return true;
                    }
                  }
                  return false;
                };
                return (
                  <div className="rounded-lg border border-border bg-card divide-y divide-border">
                    {t.fields.map((f) => {
                      const attached = isFieldAttached(f.label, f.type);
                      return (
                        <div
                          key={f.label}
                          className="flex items-start justify-between gap-3 p-3"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-sm">{f.label}</div>
                            {f.instruction && (
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                {f.instruction}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {attached ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Egenkontroll bifogad
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                Saknar egenkontroll
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {tplChecks.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Inlämnade egenkontroller
                  </div>
                  <div className="rounded-lg border border-border bg-card divide-y divide-border">
                    {tplChecks.map((c) => {
                      const isDraft = !c.completed_at;
                      const isMine = c.user_id === currentUserId;
                      const canEdit = isDraft && (isMine || isAdmin);
                      const canDelete = isAdmin || (isDraft && isMine);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/30 transition cursor-pointer"
                          onClick={() => openExisting(c)}
                        >
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(c.completed_at ?? c.created_at).toLocaleString("sv-SE")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.reviewed_at ? (
                              <Badge variant="default">Granskad</Badge>
                            ) : c.completed_at ? (
                              <Badge variant="secondary">Inlämnad</Badge>
                            ) : (
                              <Badge variant="outline">Utkast</Badge>
                            )}
                            {canDelete && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm("Ta bort egenkontrollen?")) return;
                                  try {
                                    await deleteSelfCheck(c.id);
                                    toast.success("Borttagen");
                                    onChanged();
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            {!canEdit && !canDelete && (
                              <span className="text-xs text-muted-foreground">Visa</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <SelfCheckDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobId={jobId}
        existing={editing}
        initialTemplateKey={newTemplateKey}
        lockTemplate={!!newTemplateKey}
        onSaved={onChanged}
      />
    </>
  );
}

function ForemanDialog({
  open,
  onOpenChange,
  currentUserId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string | null;
  onPick: (userId: string) => void;
}) {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    import("@/lib/employees-api")
      .then(({ listEmployees }) => listEmployees())
      .then((emps) =>
        setUsers(
          emps
            .filter((e) => e.active && !!e.user_id && e.employment_type !== "underentreprenor")
            .map((e) => ({ id: e.user_id!, display_name: e.full_name ?? null, email: e.email ?? "" }))
        )
      )
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tilldela arbetsledare</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {!loading && users.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Inga medarbetare med inloggning hittades. Bjud in personal via Personal-sidan.
            </p>
          )}
          {users.map((u) => {
            const isCurrent = u.id === currentUserId;
            return (
              <button
                key={u.id}
                disabled={isCurrent}
                onClick={() => onPick(u.id)}
                className="w-full text-left rounded-md border border-border p-3 hover:bg-muted/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-sm">
                  {u.display_name ?? u.email}
                  {isCurrent && <span className="ml-2 text-xs text-muted-foreground">(nuvarande)</span>}
                </div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
