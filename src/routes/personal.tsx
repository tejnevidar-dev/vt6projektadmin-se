import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type Employee,
  type EmploymentType,
} from "@/lib/employees-api";
import { fetchSaljare, type Saljare } from "@/lib/saljare-api";
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
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshEmployeeAccount } from "@/lib/account-refresh.functions";

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

type PersonalFilter = "extern" | "intern" | "alla";

function PersonalInner() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const { side } = useWorkspace();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saljare, setSaljare] = useState<Saljare[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [dialogMode, setDialogMode] = useState<"employee" | "saljare">("employee");
  const [filter, setFilter] = useState<PersonalFilter>(side);

  // När arbetssidan ändras, uppdatera förvalt filter
  useEffect(() => {
    setFilter(side);
  }, [side]);

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
      const [emps, sls] = await Promise.all([listEmployees(), fetchSaljare()]);
      setEmployees(emps);
      setSaljare(sls);
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda personal");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setDialogMode(filter === "extern" ? "saljare" : "employee");
    setDialogOpen(true);
  }
  function openEdit(emp: Employee) {
    setEditing(emp);
    setDialogMode(
      emp.employment_type === "provisionsbaserad" || emp.employment_type === "saljare_fast"
        ? "saljare"
        : "employee"
    );
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

  async function handleRefreshAccount(email: string | null, name: string) {
    if (!email) {
      toast.error("Personen saknar e-postadress");
      return;
    }
    if (
      !confirm(
        `Skicka förnyelselänk till ${email}?\n\n${name}s aktiva sessioner loggas ut och de får fylla i uppgifter + nytt lösenord på nytt.`
      )
    )
      return;
    try {
      await refreshEmployeeAccount({
        data: {
          email,
          redirectTo: `${window.location.origin}/uppdatera-konto`,
        },
      });
      toast.success(`Förnyelselänk skickad till ${email}`);
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte skicka förnyelselänk");
    }
  }

  // Filtrera baserat på val: extern = säljare, intern = hantverkare/UE, alla = båda
  const showIntern = filter === "intern" || filter === "alla";
  const showExtern = filter === "extern" || filter === "alla";

  const SALJARE_TYPES: EmploymentType[] = ["provisionsbaserad", "saljare_fast"];

  // Intern personal = alla anställda som INTE är säljare (säljare visas under extern)
  const internEmployees = useMemo(
    () => employees.filter((e) => !SALJARE_TYPES.includes(e.employment_type)),
    [employees]
  );
  const internEmployeeEmails = useMemo(
    () => new Set(internEmployees.map((e) => e.email?.toLowerCase()).filter(Boolean) as string[]),
    [internEmployees]
  );

  // Externa säljare = registrerade säljare som inte redan visas som intern personal
  const filteredSaljare = useMemo(
    () => saljare.filter((s) => !internEmployeeEmails.has(s.email?.toLowerCase() ?? "")),
    [saljare, internEmployeeEmails]
  );

  // Säljare som bjudits in men ännu inte skapat konto visas också under extern
  const signedUpSaljareEmails = useMemo(
    () => new Set(saljare.map((s) => s.email?.toLowerCase()).filter(Boolean) as string[]),
    [saljare]
  );
  const pendingSaljare = useMemo(
    () =>
      employees.filter(
        (e) => SALJARE_TYPES.includes(e.employment_type) && !signedUpSaljareEmails.has(e.email?.toLowerCase() ?? "")
      ),
    [employees, signedUpSaljareEmails]
  );

  const counts = {
    intern: employees.length,
    extern: filteredSaljare.length,
    active: employees.filter((e) => e.active).length,
  };

  const description =
    filter === "extern"
      ? "Säljare och kontaktpersoner (extern)."
      : filter === "intern"
      ? "Hantverkare och underentreprenörer (intern)."
      : "All personal – intern och extern.";

  return (
    <AppShell
      title="Personal"
      description={description}
      meta={
        <>
          <span>Intern: <strong className="text-foreground">{counts.intern}</strong></span>
          <span>Extern: <strong className="text-foreground">{counts.extern}</strong></span>
          <span>Aktiva (intern): <strong className="text-foreground">{counts.active}</strong></span>
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as PersonalFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="extern">Extern (säljare)</SelectItem>
              <SelectItem value="intern">Intern (hantverkare)</SelectItem>
              <SelectItem value="alla">Alla</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Lägg till
          </Button>
        </div>
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
              <TableHead className="w-[140px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Laddar…</TableCell></TableRow>
            )}
            {!loading && (
              (showIntern ? employees.length : 0) + (showExtern ? filteredSaljare.length : 0) === 0
            ) && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                Ingen personal i denna vy. Byt filter eller klicka <strong>Lägg till</strong>.
              </TableCell></TableRow>
            )}
            {showIntern && employees.map((e) => (
              <TableRow key={`emp-${e.id}`}>
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
                  ) : e.employment_type === "provisionsbaserad" ? (
                    e.provision_rate ? `${e.provision_rate.toLocaleString("sv-SE")} % provision` : "—"
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
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRefreshAccount(e.email, e.full_name)}
                    title="Skicka förnyelselänk (loggar ut och låter användaren återskapa kontot)"
                    disabled={!e.email}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title="Redigera">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(e)} title="Ta bort">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {showExtern && filteredSaljare.map((s) => (
              <TableRow key={`sal-${s.id}`}>
                <TableCell className="font-medium">{s.display_name}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300">
                    Säljare
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.employment_type === "provisionsbaserad"
                    ? s.provision_rate
                      ? `${s.provision_rate.toLocaleString("sv-SE")} % provision`
                      : "—"
                    : s.employment_type === "fast"
                    ? s.monthly_salary
                      ? `${s.monthly_salary.toLocaleString("sv-SE")} kr/mån`
                      : "—"
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell><Badge variant="secondary">Aktiv</Badge></TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRefreshAccount(s.email, s.display_name)}
                    title="Skicka förnyelselänk"
                    disabled={!s.email}
                  >
                    <RefreshCw className="h-4 w-4" />
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
        mode={dialogMode}
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
    provisionsbaserad: { label: "Provisionsbaserad", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
    saljare_fast: { label: "Fast lön", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  };
  const m = map[type];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee | null;
  mode: "employee" | "saljare";
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  const isSaljare = mode === "saljare";

  useEffect(() => {
    if (open) {
      setForm(
        employee ?? {
          full_name: "",
          email: "",
          phone: "",
          employment_type: isSaljare ? "provisionsbaserad" : "timanstalld",
          active: true,
        }
      );
    }
  }, [open, employee, isSaljare]);

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
        personal_number: isSaljare ? null : form.personal_number || null,
        employment_type: form.employment_type ?? (isSaljare ? "provisionsbaserad" : "timanstalld"),
        hourly_rate: form.hourly_rate ?? null,
        monthly_salary: form.monthly_salary ?? null,
        provision_rate: form.provision_rate ?? null,
        company_name: isSaljare ? null : form.company_name || null,
        org_number: isSaljare ? null : form.org_number || null,
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
          let role: "hantverkare" | "underentreprenor" | "saljare" = "hantverkare";
          if (isSaljare) {
            role = "saljare";
          } else if (payload.employment_type === "underentreprenor") {
            role = "underentreprenor";
          }
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
            toast.error(`${isSaljare ? "Säljaren" : "Personalen"} skapades men inbjudan misslyckades: ${e.message ?? e}`);
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

  const type = (form.employment_type ?? (isSaljare ? "provisionsbaserad" : "timanstalld")) as EmploymentType;

  const title = employee
    ? isSaljare
      ? "Redigera säljare"
      : "Redigera anställd"
    : isSaljare
    ? "Ny säljare"
    : "Ny anställd";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
              <Label>Löneform</Label>
              <Select value={type} onValueChange={(v) => set("employment_type", v as EmploymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isSaljare ? (
                    <>
                      <SelectItem value="provisionsbaserad">Provisionsbaserad</SelectItem>
                      <SelectItem value="fast">Fast månadslön</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="timanstalld">Timanställd (timlön)</SelectItem>
                      <SelectItem value="fast">Fast anställd (månadslön)</SelectItem>
                      <SelectItem value="underentreprenor">Underentreprenör (fast pris per jobb)</SelectItem>
                    </>
                  )}
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
            {type === "provisionsbaserad" && (
              <div>
                <Label>Provision (%)</Label>
                <Input
                  type="number"
                  value={form.provision_rate ?? ""}
                  onChange={(e) => set("provision_rate", e.target.value ? Number(e.target.value) : null)}
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

            {!isSaljare && type !== "underentreprenor" && (
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
