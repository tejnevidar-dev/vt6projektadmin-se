import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  type JobWithLead,
  type JobMember,
  type TimeEntry,
  type SelfCheck,
  type JobStatus,
} from "@/lib/jobs-api";
import { listUsersWithRole, type RoleUser } from "@/lib/leads-api";
import { SelfCheckDialog } from "@/components/SelfCheckDialog";
import { SELF_CHECK_TEMPLATES, getSelfCheckTemplateLabel } from "@/lib/self-check-templates";

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
      const missing = SELF_CHECK_TEMPLATES.filter((t) => !submittedKeys.has(t.key));
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
          <div className="text-xs text-muted-foreground">Uppskattade timmar</div>
          <div className="text-lg font-semibold text-foreground">
            {estimatedHours != null ? `${estimatedHours.toFixed(1)} h` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">Baserat på 600 kr/h</div>
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
            checks={checks}
            currentUserId={user?.id ?? null}
            canCreate={isOwner || isAdmin || members.some((m) => m.user_id === user?.id)}
            isAdmin={isAdmin}
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
    </AppShell>
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
  checks,
  currentUserId,
  canCreate,
  isAdmin,
  onChanged,
}: {
  jobId: string;
  checks: SelfCheck[];
  currentUserId: string | null;
  canCreate: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SelfCheck | null>(null);
  const [newTemplateKey, setNewTemplateKey] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>(SELF_CHECK_TEMPLATES[0].key);

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
  const missingCount = SELF_CHECK_TEMPLATES.filter((t) => !submittedKeys.has(t.key)).length;

  return (
    <>
      <div className="mb-3 space-y-2">
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
          {SELF_CHECK_TEMPLATES.map((t) => {
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

        {SELF_CHECK_TEMPLATES.map((t) => {
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

              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {tplChecks.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <ClipboardCheck className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                    Ingen egenkontroll inlämnad för {t.name} än.
                  </div>
                )}
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
    listUsersWithRole("arbetsledare")
      .then(setUsers)
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
              Inga arbetsledare registrerade. Bjud in personal med rollen "arbetsledare" via Personal-sidan.
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
