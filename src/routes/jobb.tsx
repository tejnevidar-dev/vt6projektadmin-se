import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import {
  listJobs,
  createManualJob,
  uploadWorkOrder,
  processWorkOrder,
  type JobWithLead,
  type JobStatus,
  type JobAssignmentType,
} from "@/lib/jobs-api";
import { listEmployees, type Employee } from "@/lib/employees-api";
import { useUserRoles } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jobb")({
  component: () => (
    <RequireAuth>
      <JobsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Projekt – admin.vt6" }] }),
});

const STATUS_LABEL: Record<JobStatus, string> = {
  ej_paborjad: "Ej påbörjad",
  pagaende: "Pågående",
  klar: "Klar",
};

function JobsPage() {
  const { roles, isAdmin } = useUserRoles();
  const [jobs, setJobs] = useState<JobWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setJobs(await listJobs());
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda jobb");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const isHantverkare = roles.includes("hantverkare") && !isAdmin;
  const title = isHantverkare ? "Mina projekt" : "Projekt";

  return (
    <AppShell
      title={title}
      description={
        isAdmin
          ? "Alla aktiva projekt. Skapas automatiskt från bokade leads eller läggs in manuellt."
          : "Projekt du är tilldelad eller inbjuden till."
      }
      meta={<span>Totalt: <strong className="text-foreground">{jobs.length}</strong></span>}
      actions={
        isAdmin ? (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Lägg till projekt
          </Button>
        ) : undefined
      }
    >
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kund</TableHead>
              <TableHead>Adress</TableHead>
              <TableHead>Källa</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Laddar…
                </TableCell>
              </TableRow>
            )}
            {!loading && jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Inga projekt än. Boka ett lead eller lägg in ett projekt manuellt.
                </TableCell>
              </TableRow>
            )}
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
                  <TableCell className="text-xs text-muted-foreground">
                    {j.lead_id ? "Lead" : isAdmin && j.client_company ? `UE åt ${j.client_company}` : "Manuellt"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {j.assignment_type === "underentreprenor" ? "UE" : "Arbetsledare"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={j.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => void reload()} />
    </AppShell>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, string> = {
    ej_paborjad: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    pagaende: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    klar: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function AddJobDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [assignmentType, setAssignmentType] = useState<JobAssignmentType>("arbetsledare");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientContactName, setClientContactName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [workOrderFile, setWorkOrderFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStage, setUploadStage] = useState<"idle" | "creating" | "uploading" | "processing">("idle");

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setClientCompany("");
    setClientContactName("");
    setClientEmail("");
    setFixedPrice("");
    setNotes("");
    setAssignedTo("");
    setAssignmentType("arbetsledare");
    setWorkOrderFile(null);
    setUploadStage("idle");
    listEmployees()
      .then(setEmployees)
      .catch((e) => toast.error(e.message));
  }, [open]);



  // Only employees with a linked user_id can own a job
  const employeeCandidates = employees.filter((e) => e.active && !!e.user_id);

  // Admins can assign jobs to themselves as arbetsledare even if not in employees
  const adminSelfCandidate: Employee | null =
    isAdmin && user && !employeeCandidates.some((e) => e.user_id === user.id)
      ? {
          id: `self-${user.id}`,
          user_id: user.id,
          full_name: `${user.email ?? "Jag"} (admin)`,
          email: user.email ?? null,
          phone: null,
          personal_number: null,
          employment_type: "fast",
          hourly_rate: null,
          monthly_salary: null,
          company_name: null,
          org_number: null,
          active: true,
          notes: null,
          created_at: "",
          updated_at: "",
        }
      : null;

  const candidates: Employee[] = adminSelfCandidate
    ? [adminSelfCandidate, ...employeeCandidates]
    : employeeCandidates;

  // Auto-pick assignment_type based on employment_type when user picks an assignee
  function pickAssignee(userId: string) {
    setAssignedTo(userId);
    const emp = candidates.find((e) => e.user_id === userId);
    if (emp?.employment_type === "underentreprenor") {
      setAssignmentType("underentreprenor");
    } else {
      setAssignmentType("arbetsledare");
    }
  }

  function onPickFile(f: File | null) {
    if (!f) {
      setWorkOrderFile(null);
      return;
    }
    if (f.type && f.type !== "application/pdf") {
      toast.error("Endast PDF stöds");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error("Filen är för stor (max 15 MB)");
      return;
    }
    setWorkOrderFile(f);
  }

  async function handleSubmit() {
    if (!customerName.trim()) {
      toast.error("Ange kundnamn");
      return;
    }
    if (!assignedTo) {
      toast.error("Välj arbetsledare eller UE");
      return;
    }
    setSubmitting(true);
    setUploadStage("creating");
    try {
      const id = await createManualJob({
        assigned_to: assignedTo,
        assignment_type: assignmentType,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        address: address.trim() || undefined,
        client_company: clientCompany.trim() || undefined,
        client_contact_name: clientContactName.trim() || undefined,
        client_email: clientEmail.trim() || undefined,
        fixed_price:
          assignmentType === "underentreprenor" && fixedPrice
            ? Number(fixedPrice)
            : null,
        notes: notes.trim() || undefined,
      });


      if (workOrderFile) {
        setUploadStage("uploading");
        try {
          await uploadWorkOrder(id, workOrderFile);
          setUploadStage("processing");
          toast.success("Jobb skapat – AI tolkar arbetsordern...");
          try {
            await processWorkOrder(id);
            toast.success("AI-sammanfattning klar");
          } catch (e: any) {
            toast.error(`Jobb skapat, men AI kunde inte tolka PDF: ${e.message ?? ""}`);
          }
        } catch (e: any) {
          toast.error(`Jobb skapat, men PDF kunde inte laddas upp: ${e.message ?? ""}`);
        }
      } else {
        toast.success("Jobb skapat");
      }

      onOpenChange(false);
      onCreated();
      router.navigate({ to: "/jobb/$jobId", params: { jobId: id } });
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte skapa jobb");
    } finally {
      setSubmitting(false);
      setUploadStage("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lägg till projekt manuellt</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Kund / projekt *</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="t.ex. BRF Solrosen" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefon</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <Label>Adress</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
            <div className="text-sm font-medium">Beställare (om vi är UE)</div>
            <div>
              <Label>Företag</Label>
              <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="t.ex. Takbolaget AB" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kontaktperson</Label>
                <Input value={clientContactName} onChange={(e) => setClientContactName(e.target.value)} placeholder="Förnamn Efternamn" />
              </div>
              <div>
                <Label>E-post</Label>
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="bestallare@exempel.se" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              När projektet markeras som <strong>Klar</strong> mejlas alla egenkontroller automatiskt till beställarens e-post.
            </p>
          </div>

          <div>
            <Label>Tilldela till *</Label>
            <Select value={assignedTo} onValueChange={pickAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Välj arbetsledare eller UE" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">
                    Ingen tillgänglig personal med inloggning.
                  </div>
                )}
                {candidates.map((e) => (
                  <SelectItem key={e.id} value={e.user_id!}>
                    {e.full_name} {e.employment_type === "underentreprenor" ? "(UE)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Typ</Label>
              <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as JobAssignmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arbetsledare">Arbetsledare (timrapportering)</SelectItem>
                  <SelectItem value="underentreprenor">UE (fast pris)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignmentType === "underentreprenor" && (
              <div>
                <Label>Fast pris (kr)</Label>
                <Input
                  type="number"
                  min="0"
                  value={fixedPrice}
                  onChange={(e) => setFixedPrice(e.target.value)}
                />
              </div>
            )}
          </div>
          <div>
            <Label>Anteckningar</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label>Arbetsorder (PDF, valfritt)</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Ladda upp en PDF så tolkar AI vad som ska göras på plats och visar det för arbetsledaren/UE.
            </p>
            {workOrderFile ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-2">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{workOrderFile.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(workOrderFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setWorkOrderFile(null)}
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card p-4 text-sm text-muted-foreground hover:bg-muted/30">
                <Upload className="h-4 w-4" />
                Välj PDF-fil
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    onPickFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {uploadStage === "creating"
              ? "Skapar projekt…"
              : uploadStage === "uploading"
              ? "Laddar upp PDF…"
              : uploadStage === "processing"
              ? "AI tolkar…"
              : "Skapa projekt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
