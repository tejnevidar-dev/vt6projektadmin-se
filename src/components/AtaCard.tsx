import { useCallback, useEffect, useState } from "react";
import {
  approveAta,
  createAta,
  getAtaApprovalThreshold,
  listJobAtas,
  rejectAta,
  type Ata,
  type AtaApprovalStatus,
} from "@/lib/atas-api";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  isAdmin: boolean;
  /** Arbetsledare/admin/säljare tilldelad jobbet -- får skapa ÄTA. */
  canCreate: boolean;
  /** UE: ÄTA-begäran kräver alltid godkännande, oavsett belopp. */
  forceApproval?: boolean;
}

const STATUS_LABEL: Record<AtaApprovalStatus, string> = {
  none: "Ingen åtgärd krävs",
  pending: "Väntar på godkännande",
  approved: "Godkänd",
  rejected: "Avslagen",
};

const STATUS_VARIANT: Record<AtaApprovalStatus, "default" | "secondary" | "destructive" | "outline"> = {
  none: "outline",
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export function AtaCard({ jobId, isAdmin, canCreate, forceApproval }: Props) {
  const [atas, setAtas] = useState<Ata[]>([]);
  const [threshold, setThreshold] = useState(10000);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amount: "", description: "" });

  const load = useCallback(async () => {
    try {
      const [list, t] = await Promise.all([listJobAtas(jobId), getAtaApprovalThreshold()]);
      setAtas(list);
      setThreshold(t);
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda ÄTA:er");
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Ange ett belopp");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Beskriv vad ÄTA:n gäller");
      return;
    }
    setBusy(true);
    try {
      await createAta({ jobId, totalAmount: amount, description: form.description, forceApproval });
      toast.success(
        amount > threshold ? "ÄTA skapad – väntar på godkännande" : "ÄTA skapad",
      );
      setOpen(false);
      setForm({ amount: "", description: "" });
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte skapa ÄTA");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveAta(id);
      toast.success("ÄTA godkänd");
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte godkänna");
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectAta(id);
      toast.success("ÄTA avslagen");
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte avslå");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ändrings- och tilläggsarbeten för detta jobb. Belopp över {kr(threshold)} kräver godkännande.
        </p>
        {canCreate && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Ny ÄTA
          </Button>
        )}
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {atas.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Inga ÄTA:er skapade än.</div>
        )}
        {atas.map((ata) => (
          <div key={ata.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium">
                {ata.ata_number ?? "ÄTA"} — {kr(ata.total_amount)}
              </div>
              {ata.description && <div className="text-xs text-muted-foreground">{ata.description}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[ata.approval_status]}>{STATUS_LABEL[ata.approval_status]}</Badge>
              {isAdmin && ata.approval_status === "pending" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleApprove(ata.id)}>
                    Godkänn
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleReject(ata.id)}>
                    Avslå
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
            <DialogTitle>Ny ÄTA</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Belopp *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Beskrivning *</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Vad gäller tillägget/ändringen?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Sparar…" : "Skapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
