import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import {
  listJobs,
  createManualJob,
  type JobWithLead,
  type JobStatus,
  type JobAssignmentType,
} from "@/lib/jobs-api";
import { listEmployees, type Employee } from "@/lib/employees-api";
import { useUserRoles } from "@/hooks/use-role";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jobb")({
  component: () => (
    <RequireAuth>
      <JobsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Jobb – admin.vt6" }] }),
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
  const title = isHantverkare ? "Mina jobb" : "Jobb";

  return (
    <AppShell
      title={title}
      description={
        isAdmin
          ? "Alla aktiva jobb. Skapas automatiskt från bokade leads eller läggs in manuellt."
          : "Jobb du är tilldelad eller inbjuden till."
      }
      meta={<span>Totalt: <strong className="text-foreground">{jobs.length}</strong></span>}
      actions={
        isAdmin ? (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Lägg till jobb
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
                  Inga jobb än. Boka ett lead eller lägg in ett jobb manuellt.
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
                    {j.lead_id ? "Lead" : j.client_company ? `UE åt ${j.client_company}` : "Manuellt"}
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [assignmentType, setAssignmentType] = useState<JobAssignmentType>("arbetsledare");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setClientCompany("");
    setFixedPrice("");
    setNotes("");
    setAssignedTo("");
    setAssignmentType("arbetsledare");
    listEmployees()
      .then(setEmployees)
      .catch((e) => toast.error(e.message));
  }, [open]);

  // Only employees with a linked user_id can own a job
  const candidates = employees.filter((e) => e.active && !!e.user_id);

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
    try {
      const id = await createManualJob({
        assigned_to: assignedTo,
        assignment_type: assignmentType,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        address: address.trim() || undefined,
        client_company: clientCompany.trim() || undefined,
        fixed_price:
          assignmentType === "underentreprenor" && fixedPrice
            ? Number(fixedPrice)
            : null,
        notes: notes.trim() || undefined,
      });
      toast.success("Jobb skapat");
      onOpenChange(false);
      onCreated();
      router.navigate({ to: "/jobb/$jobId", params: { jobId: id } });
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte skapa jobb");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lägg till jobb manuellt</DialogTitle>
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
          <div>
            <Label>Uppdragsgivare (om vi är UE åt annan aktör)</Label>
            <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="t.ex. Takbolaget AB" />
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
                  <SelectItem value="arbetsledare">Arbetsledare (timpris)</SelectItem>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sparar…" : "Skapa jobb"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
