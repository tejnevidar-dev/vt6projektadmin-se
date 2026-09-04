import { useCallback, useEffect, useState } from "react";
import {
  INVOICE_STATUS_LABEL,
  deleteInvoice,
  getDocumentUrl,
  invoiceSummary,
  listJobInvoices,
  setInvoiceStatus,
  submitInvoice,
  type InvoiceStatus,
  type SubcontractorInvoice,
} from "@/lib/subcontractors-api";
import { kr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { listSubcontractors, type Subcontractor } from "@/lib/subcontractors-api";
import { updateJobSubcontractor } from "@/lib/jobs-api";
import { toast } from "sonner";

interface Props {
  jobId: string;
  subcontractorId: string | null;
  /** Avtalat fastpris för underentreprenören. */
  agreedPrice: number | null;
  /** Admin ser belopp och kan godkänna. */
  isAdmin: boolean;
  /** Inloggad användare får skicka in faktura (tilldelad UE eller admin). */
  canSubmit: boolean;
  userId: string | null;
  /** Anropas när projektet kopplas till ett annat UE-företag. */
  onLinked?: () => void;
}

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  mottagen: "secondary",
  godkand: "default",
  avvisad: "destructive",
  betald: "outline",
};

export function SubcontractorInvoicesCard({
  jobId,
  subcontractorId,
  agreedPrice,
  isAdmin,
  canSubmit,
  userId,
  onLinked,
}: Props) {
  const [companies, setCompanies] = useState<Subcontractor[]>([]);
  const [linked, setLinked] = useState<string | null>(subcontractorId);
  const [invoices, setInvoices] = useState<SubcontractorInvoice[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    amount: "",
    vatAmount: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      setInvoices(await listJobInvoices(jobId));
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda fakturor");
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setLinked(subcontractorId);
  }, [subcontractorId]);

  useEffect(() => {
    if (!isAdmin) return;
    listSubcontractors()
      .then((list) => setCompanies(list.filter((c) => c.active)))
      .catch(() => setCompanies([]));
  }, [isAdmin]);

  const sum = invoiceSummary(agreedPrice, invoices);

  async function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Ange ett belopp");
      return;
    }
    if (!userId) return;
    setBusy(true);
    try {
      await submitInvoice({
        jobId,
        subcontractorId: linked,
        userId,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        amount,
        vatAmount: form.vatAmount ? Number(form.vatAmount) : null,
        notes: form.notes,
        file,
      });
      toast.success("Faktura inskickad");
      setOpen(false);
      setForm({ invoiceNumber: "", invoiceDate: "", dueDate: "", amount: "", vatAmount: "", notes: "" });
      setFile(null);
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte spara fakturan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label>Underentreprenör</Label>
          <Select
            value={linked ?? "none"}
            onValueChange={async (v) => {
              const next = v === "none" ? null : v;
              try {
                await updateJobSubcontractor(jobId, next);
                setLinked(next);
                toast.success("Underentreprenör kopplad");
                onLinked?.();
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Välj företag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen vald</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryBox label="Avtalat pris" value={agreedPrice != null ? kr(agreedPrice) : "—"} />
          <SummaryBox label="Fakturerat" value={kr(sum.invoiced)} />
          <SummaryBox label="Betalt" value={kr(sum.paid)} />
          <SummaryBox
            label={sum.overInvoiced ? "Över avtalat pris" : "Kvar att fakturera"}
            value={kr(Math.abs(sum.remaining))}
            warn={sum.overInvoiced}
          />
        </div>
      )}

      {isAdmin && sum.overInvoiced && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Fakturerat belopp överstiger avtalat pris med {kr(sum.invoiced - sum.agreed)}.
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Fakturor från underentreprenören för detta projekt.
        </p>
        {canSubmit && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Ny faktura
          </Button>
        )}
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {invoices.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Inga fakturor inskickade än.
          </div>
        )}
        {invoices.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium">
                {inv.invoice_number ? `Faktura ${inv.invoice_number}` : "Faktura"} — {kr(inv.amount)}
              </div>
              <div className="text-xs text-muted-foreground">
                {[
                  inv.invoice_date ? `Datum ${inv.invoice_date}` : null,
                  inv.due_date ? `Förfaller ${inv.due_date}` : null,
                  inv.vat_amount ? `Moms ${kr(inv.vat_amount)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Ingen datuminformation"}
              </div>
              {inv.notes && <div className="text-xs text-muted-foreground">{inv.notes}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
              {inv.file_path && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      window.open(await getDocumentUrl(inv.file_path!), "_blank");
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  Öppna
                </Button>
              )}
              {isAdmin && (
                <>
                  <Select
                    value={inv.status}
                    onValueChange={async (v) => {
                      try {
                        await setInvoiceStatus(inv.id, v as InvoiceStatus, userId ?? "");
                        toast.success("Status uppdaterad");
                        void load();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABEL).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Ta bort fakturan?")) return;
                      try {
                        await deleteInvoice(inv);
                        void load();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ny faktura</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Fakturanummer</Label>
                <Input
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Belopp exkl. moms *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Moms</Label>
                <Input
                  type="number"
                  value={form.vatAmount}
                  onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Fakturadatum</Label>
                <Input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Förfallodatum</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Fakturafil (PDF/bild)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Kommentar</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Sparar…" : "Skicka in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
