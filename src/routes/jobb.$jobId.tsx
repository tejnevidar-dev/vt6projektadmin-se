import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import {
  getJob,
  listJobMembers,
  listTimeEntries,
  listSelfChecks,
  addJobMember,
  removeJobMember,
  addTimeEntry,
  updateJobStatus,
  type JobWithLead,
  type JobMember,
  type TimeEntry,
  type SelfCheck,
  type JobStatus,
} from "@/lib/jobs-api";
import { listEmployees, type Employee } from "@/lib/employees-api";
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
import { ArrowLeft, UserPlus, Plus, Trash2, ClipboardCheck } from "lucide-react";
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
  const [timeOpen, setTimeOpen] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const j = await getJob(jobId);
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
    try {
      await updateJobStatus(job.id, next);
      toast.success("Status uppdaterad");
      void reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) {
    return (
      <AppShell title="Jobb">
        <p className="text-muted-foreground">Laddar…</p>
      </AppShell>
    );
  }
  if (!job) {
    return (
      <AppShell title="Jobb">
        <p className="text-muted-foreground">Jobbet hittades inte eller så har du inte åtkomst.</p>
        <Link to="/jobb" className="mt-4 inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Link>
      </AppShell>
    );
  }

  const titleName = job.lead?.name ?? job.customer_name ?? "Jobb";
  const descAddr = job.property
    ? `${job.property.address}, ${job.property.municipality}`
    : job.address ?? undefined;

  return (
    <AppShell
      title={titleName}
      description={descAddr}
      meta={
        <>
          <span>Typ: <strong className="text-foreground">{isUE ? "UE (fast pris)" : "Arbetsledare"}</strong></span>
          <span>Status: <strong className="text-foreground">{STATUS_LABEL[job.status]}</strong></span>
          {job.client_company && (
            <span>Uppdragsgivare: <strong className="text-foreground">{job.client_company}</strong></span>
          )}
          {isAdmin && isUE && job.fixed_price != null && (
            <span>Pris: <strong className="text-foreground">{Number(job.fixed_price).toLocaleString("sv-SE")} kr</strong></span>
          )}
        </>
      }
      actions={
        <div className="flex gap-2">
          <Link to="/jobb" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Alla jobb
          </Link>
          {(isOwner || isAdmin) && (
            <Select value={job.status} onValueChange={(v) => handleStatus(v as JobStatus)}>
              <SelectTrigger className="w-[180px]">
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
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Hantverkare ({members.length})</TabsTrigger>
          {!isUE && <TabsTrigger value="time">Timmar ({times.length})</TabsTrigger>}
          <TabsTrigger value="checks">Egenkontroller ({checks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              Inbjudna hantverkare som kan rapportera timmar och fylla i egenkontroller på detta jobb.
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
                      if (!confirm("Ta bort från jobbet?")) return;
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
                Timmar rapporterade på detta jobb. Godkänns av arbetsledare innan löneutbetalning.
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
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Egenkontroll-mall byggs senare</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Här kommer en fast checklista per jobbtyp som hantverkare måste fylla i för att timmar ska kunna godkännas.
            </p>
          </div>
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listEmployees()
      .then(setEmployees)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  // Only hantverkare/timanställda with a linked user_id can be invited
  const candidates = employees.filter(
    (e) =>
      e.active &&
      !!e.user_id &&
      !existingUserIds.includes(e.user_id) &&
      e.employment_type !== "underentreprenor"
  );

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
              Ingen tillgänglig hantverkare. Personal måste vara registrerad och inloggad minst en gång för att kunna bjudas in.
            </p>
          )}
          {candidates.map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e.user_id!)}
              className="w-full text-left rounded-md border border-border p-3 hover:bg-muted/40 transition"
            >
              <div className="font-medium text-sm">{e.full_name}</div>
              <div className="text-xs text-muted-foreground">{e.email}</div>
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
