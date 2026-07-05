import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type Employee,
  type EmploymentType,
} from "@/lib/employees-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/personal")({
  component: PersonalPage,
  head: () => ({ meta: [{ title: "Personal – admin.vt6" }] }),
});

function PersonalPage() {
  return (
    <RequireAuth>
      <PersonalInner />
    </RequireAuth>
  );
}

function PersonalInner() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  useEffect(() => {
    if (rolesLoading) return;
    if (!isAdmin) {
      navigate({ to: "/dashboard" });
      return;
    }
    void load();
  }, [isAdmin, rolesLoading]);

  async function load() {
    setLoading(true);
    try {
      setEmployees(await listEmployees());
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda personal");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(emp: Employee) {
    setEditing(emp);
    setDialogOpen(true);
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`Ta bort ${emp.full_name}?`)) return;
    try {
      await deleteEmployee(emp.id);
      toast.success("Borttagen");
      void load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const counts = {
    total: employees.length,
    active: employees.filter((e) => e.active).length,
    ue: employees.filter((e) => e.employment_type === "underentreprenor").length,
  };

  return (
    <AppShell
      title="Personal"
      description="Anställda, underentreprenörer, timlöner och lönejusteringar."
      meta={
        <>
          <span>Totalt: <strong className="text-foreground">{counts.total}</strong></span>
          <span>Aktiva: <strong className="text-foreground">{counts.active}</strong></span>
          <span>UE: <strong className="text-foreground">{counts.ue}</strong></span>
        </>
      }
      actions={
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Lägg till
        </Button>
      }
    >
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Namn</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Timlön / Månadslön</TableHead>
              <TableHead>Företag</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Laddar…</TableCell></TableRow>
            )}
            {!loading && employees.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                Ingen personal tillagd än. Klicka <strong>Lägg till</strong> för att börja.
              </TableCell></TableRow>
            )}
            {employees.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.full_name}</TableCell>
                <TableCell>
                  <EmploymentBadge type={e.employment_type} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.email}
                  {e.phone && <div>{e.phone}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {e.employment_type === "underentreprenor" ? (
                    <span className="text-muted-foreground">Fast pris per jobb</span>
                  ) : e.employment_type === "fast" ? (
                    e.monthly_salary ? `${e.monthly_salary.toLocaleString("sv-SE")} kr/mån` : "—"
                  ) : (
                    e.hourly_rate ? `${e.hourly_rate.toLocaleString("sv-SE")} kr/h` : "—"
                  )}
                </TableCell>
                <TableCell className="text-sm">{e.company_name ?? "—"}</TableCell>
                <TableCell>
                  {e.active
                    ? <Badge variant="secondary">Aktiv</Badge>
                    : <Badge variant="outline">Inaktiv</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(e)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        onSaved={() => { setDialogOpen(false); void load(); }}
      />
    </AppShell>
  );
}

function EmploymentBadge({ type }: { type: EmploymentType }) {
  const map: Record<EmploymentType, { label: string; cls: string }> = {
    timanstalld: { label: "Timanställd", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
    fast: { label: "Fast", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    underentreprenor: { label: "UE", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  };
  const m = map[type];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        employee ?? {
          full_name: "",
          email: "",
          phone: "",
          employment_type: "timanstalld",
          active: true,
        }
      );
    }
  }, [open, employee]);

  function set<K extends keyof Employee>(k: K, v: Employee[K] | null) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.full_name?.trim()) {
      toast.error("Namn krävs");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        personal_number: form.personal_number || null,
        employment_type: form.employment_type ?? "timanstalld",
        hourly_rate: form.hourly_rate ?? null,
        monthly_salary: form.monthly_salary ?? null,
        company_name: form.company_name || null,
        org_number: form.org_number || null,
        active: form.active ?? true,
        notes: form.notes || null,
      };
      if (employee) {
        await updateEmployee(employee.id, payload);
        toast.success("Sparad");
      } else {
        await createEmployee(payload);
        toast.success("Tillagd");
        if (payload.email && payload.active) {
          const role =
            payload.employment_type === "underentreprenor"
              ? "underentreprenor"
              : "hantverkare";
          try {
            const { sendEmployeeInvite } = await import("@/lib/employee-invite.functions");
            const res = await sendEmployeeInvite({
              data: {
                email: payload.email,
                role,
                displayName: payload.full_name,
                redirectTo: `${window.location.origin}/accept-invite`,
              },
            });
            if (res?.alreadyRegistered) {
              toast.info("E-posten är redan registrerad – ingen ny inbjudan skickad");
            } else {
              toast.success("Inbjudningsmail skickat");
            }
          } catch (e: any) {
            toast.error(`Personalen skapades men inbjudan misslyckades: ${e.message ?? e}`);
          }
        }
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  }

  const type = (form.employment_type ?? "timanstalld") as EmploymentType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? "Redigera anställd" : "Ny anställd"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Fullständigt namn *</Label>
              <Input value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div>
              <Label>E-post</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Anställningstyp</Label>
              <Select value={type} onValueChange={(v) => set("employment_type", v as EmploymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="timanstalld">Timanställd (timlön)</SelectItem>
                  <SelectItem value="fast">Fast anställd (månadslön)</SelectItem>
                  <SelectItem value="underentreprenor">Underentreprenör (fast pris per jobb)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "timanstalld" && (
              <div>
                <Label>Timlön (kr/h)</Label>
                <Input
                  type="number"
                  value={form.hourly_rate ?? ""}
                  onChange={(e) => set("hourly_rate", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            )}
            {type === "fast" && (
              <div>
                <Label>Månadslön (kr)</Label>
                <Input
                  type="number"
                  value={form.monthly_salary ?? ""}
                  onChange={(e) => set("monthly_salary", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            )}

            {type === "underentreprenor" && (
              <>
                <div>
                  <Label>Företagsnamn</Label>
                  <Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
                </div>
                <div>
                  <Label>Org.nr</Label>
                  <Input value={form.org_number ?? ""} onChange={(e) => set("org_number", e.target.value)} />
                </div>
              </>
            )}

            {type !== "underentreprenor" && (
              <div className="col-span-2">
                <Label>Personnummer</Label>
                <Input value={form.personal_number ?? ""} onChange={(e) => set("personal_number", e.target.value)} />
              </div>
            )}

            <div className="col-span-2">
              <Label>Anteckningar</Label>
              <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <Label>Aktiv</Label>
              <Switch checked={form.active ?? true} onCheckedChange={(v) => set("active", v)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Sparar…" : "Spara"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
