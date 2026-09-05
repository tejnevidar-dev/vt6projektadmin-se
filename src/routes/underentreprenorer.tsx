import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import {
  DOC_TYPE_LABEL,
  createSubcontractor,
  deleteSubcontractor,
  deleteSubcontractorDocument,
  expiryWarnings,
  getDocumentUrl,
  getMySubcontractor,
  listAllInvoices,
  listSubcontractorDocuments,
  listSubcontractors,
  updateSubcontractor,
  uploadSubcontractorDocument,
  type Subcontractor,
  type SubcontractorDocType,
  type SubcontractorDocument,
  type SubcontractorInvoice,
} from "@/lib/subcontractors-api";
import { kr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/underentreprenorer")({
  component: () => (
    <RequireAuth>
      <SubcontractorsPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Underentreprenörer – admin.vt6" },
      {
        name: "description",
        content: "Register över underentreprenörer med avtal, F-skatt och fakturor.",
      },
      { property: "og:title", content: "Underentreprenörer – admin.vt6" },
      {
        property: "og:description",
        content: "Håll koll på UE-företag, dokument och fakturor per projekt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMPTY: Partial<Subcontractor> = {
  company_name: "",
  org_number: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  bankgiro: "",
  plusgiro: "",
  payment_terms_days: 30,
  payment_reference: "",
  f_skatt: false,
  agreement_signed_at: "",
  active: true,
  notes: "",
};

function SubcontractorsPage() {
  const { user } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [rows, setRows] = useState<Subcontractor[]>([]);
  const [invoices, setInvoices] = useState<SubcontractorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Subcontractor> | null>(null);
  const [docsFor, setDocsFor] = useState<Subcontractor | null>(null);

  const reload = useCallback(async () => {
    if (rolesLoading) return;
    setLoading(true);
    try {
      if (isAdmin) {
        const [list, inv] = await Promise.all([listSubcontractors(), listAllInvoices()]);
        setRows(list);
        setInvoices(inv);
      } else if (user) {
        const mine = await getMySubcontractor(user.id);
        setRows(mine ? [mine] : []);
        setInvoices(await listAllInvoices());
      }
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda underentreprenörer");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, rolesLoading, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!editing?.company_name?.trim()) {
      toast.error("Företagsnamn krävs");
      return;
    }
    const payload = {
      company_name: editing.company_name.trim(),
      org_number: editing.org_number || null,
      contact_name: editing.contact_name || null,
      email: editing.email || null,
      phone: editing.phone || null,
      address: editing.address || null,
      bankgiro: editing.bankgiro || null,
      plusgiro: editing.plusgiro || null,
      payment_terms_days: editing.payment_terms_days ?? null,
      payment_reference: editing.payment_reference || null,
      f_skatt: !!editing.f_skatt,
      agreement_signed_at: editing.agreement_signed_at || null,
      active: editing.active !== false,
      notes: editing.notes || null,
    };
    try {
      if (editing.id) await updateSubcontractor(editing.id, payload);
      else await createSubcontractor(payload);
      toast.success("Sparat");
      setEditOpen(false);
      setEditing(null);
      void reload();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte spara");
    }
  }

  const invoiceTotals = (scId: string) => {
    const own = invoices.filter((i) => i.subcontractor_id === scId && i.status !== "avvisad");
    return {
      count: own.length,
      sum: own.reduce((s, i) => s + (i.amount ?? 0), 0),
      pending: own.filter((i) => i.status === "mottagen").length,
    };
  };

  return (
    <AppShell
      title="Underentreprenörer"
      description={
        isAdmin
          ? "Register över UE-företag med avtal, F-skatt och fakturor."
          : "Din företagsinformation och dina dokument."
      }
      meta={<span>Totalt: <strong className="text-foreground">{rows.length}</strong></span>}
      actions={
        isAdmin ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing({ ...EMPTY });
              setEditOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Lägg till underentreprenör
          </Button>
        ) : undefined
      }
    >
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Företag</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Org.nr</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fakturerat</TableHead>
              <TableHead className="text-right">Åtgärd</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Laddar…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {isAdmin
                    ? "Inga underentreprenörer inlagda än."
                    : "Din firma är inte upplagd än – be en administratör lägga in den."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((sc) => {
              const warnings = expiryWarnings(sc);
              const t = invoiceTotals(sc.id);
              return (
                <TableRow key={sc.id}>
                  <TableCell>
                    <div className="font-medium">{sc.company_name}</div>
                    {sc.address && (
                      <div className="text-xs text-muted-foreground">{sc.address}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{sc.contact_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[sc.phone, sc.email].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{sc.org_number ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {!sc.active && <Badge variant="secondary">Inaktiv</Badge>}
                      {warnings.length === 0 ? (
                        <Badge>Komplett</Badge>
                      ) : (
                        warnings.map((w) => (
                          <Badge key={w} variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> {w}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.count === 0 ? (
                      "—"
                    ) : (
                      <>
                        {kr(t.sum)}
                        <div className="text-xs text-muted-foreground">
                          {t.count} faktura(or){t.pending ? ` · ${t.pending} väntar` : ""}
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDocsFor(sc)}>
                      <FileText className="mr-1.5 h-4 w-4" /> Dokument
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing({ ...sc });
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm(`Ta bort ${sc.company_name}?`)) return;
                            try {
                              await deleteSubcontractor(sc.id);
                              toast.success("Borttagen");
                              void reload();
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Redigera underentreprenör" : "Ny underentreprenör"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Företagsnamn *</Label>
                <Input
                  value={editing.company_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, company_name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Org.nr</Label>
                  <Input
                    value={editing.org_number ?? ""}
                    onChange={(e) => setEditing({ ...editing, org_number: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Kontaktperson</Label>
                  <Input
                    value={editing.contact_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>E-post</Label>
                  <Input
                    type="email"
                    value={editing.email ?? ""}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Telefon</Label>
                  <Input
                    value={editing.phone ?? ""}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Adress</Label>
                <Input
                  value={editing.address ?? ""}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:max-w-[50%]">
                <Label>Avtal tecknat</Label>
                <Input
                  type="date"
                  value={editing.agreement_signed_at ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, agreement_signed_at: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={!!editing.f_skatt}
                    onCheckedChange={(v) => setEditing({ ...editing, f_skatt: v })}
                  />
                  Godkänd för F-skatt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.active !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                  />
                  Aktiv
                </label>
              </div>
              <div className="grid gap-1.5">
                <Label>Anteckningar</Label>
                <Textarea
                  rows={3}
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={save}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentsDialog
        subcontractor={docsFor}
        canUpload={isAdmin || docsFor?.user_id === user?.id}
        userId={user?.id ?? null}
        onClose={() => setDocsFor(null)}
      />
    </AppShell>
  );
}

function DocumentsDialog({
  subcontractor,
  canUpload,
  userId,
  onClose,
}: {
  subcontractor: Subcontractor | null;
  canUpload: boolean;
  userId: string | null;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<SubcontractorDocument[]>([]);
  const [docType, setDocType] = useState<SubcontractorDocType>("avtal");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!subcontractor) return;
    try {
      setDocs(await listSubcontractorDocuments(subcontractor.id));
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [subcontractor?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(file: File | undefined) {
    if (!file || !subcontractor || !userId) return;
    setBusy(true);
    try {
      await uploadSubcontractorDocument({
        subcontractorId: subcontractor.id,
        file,
        docType,
        validUntil: validUntil || null,
        userId,
      });
      toast.success("Dokument uppladdat");
      setValidUntil("");
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda upp");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!subcontractor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dokument – {subcontractor?.company_name}</DialogTitle>
        </DialogHeader>

        {canUpload && (
          <div className="grid gap-3 rounded-lg border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Typ</Label>
                <Select value={docType} onValueChange={(v) => setDocType(v as SubcontractorDocType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABEL)
                      .filter(([k]) => k !== "forsakring")
                      .map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Giltigt t.o.m.</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted/40">
              <Upload className="h-4 w-4" />
              {busy ? "Laddar upp…" : "Välj fil"}
              <input
                type="file"
                className="hidden"
                disabled={busy}
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
          </div>
        )}

        <div className="divide-y divide-border rounded-lg border border-border">
          {docs.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Inga dokument uppladdade än.
            </div>
          )}
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{d.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}
                  {d.valid_until ? ` · giltigt t.o.m. ${d.valid_until}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      window.open(await getDocumentUrl(d.file_path), "_blank");
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  Öppna
                </Button>
                {canUpload && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Ta bort dokumentet?")) return;
                      try {
                        await deleteSubcontractorDocument(d);
                        void load();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
