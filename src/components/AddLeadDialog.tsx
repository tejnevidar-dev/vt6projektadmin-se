import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLead } from "@/lib/leads-api";
import type { LeadStatus, LeadSource } from "@/lib/types";

interface AddLeadDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddLeadDialog({ open, onClose, onAdded }: AddLeadDialogProps) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    municipality: "",
    region: "",
    buildYear: "",
    roofType: "Betongpannor",
    age: "",
    status: "cold" as LeadStatus,
    source: "telemarketing" as LeadSource,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addLead({
        name: form.name,
        phone: form.phone,
        address: form.address,
        municipality: form.municipality,
        region: form.region,
        buildYear: Number(form.buildYear),
        roofType: form.roofType,
        age: Number(form.age),
        status: form.status,
        source: form.source,
        notes: form.notes,
      });
      onAdded();
      onClose();
    } catch (err) {
      console.error("Failed to add lead:", err);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-card-foreground">Lägg till lead</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Namn *</label>
              <Input required value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefon *</label>
              <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="070-123 45 67" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Adress *</label>
            <Input required value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Kommun</label>
              <Input value={form.municipality} onChange={(e) => update("municipality", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Län</label>
              <Input value={form.region} onChange={(e) => update("region", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Byggnadsår</label>
              <Input type="number" value={form.buildYear} onChange={(e) => update("buildYear", e.target.value)} placeholder="1975" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Taktyp</label>
              <select
                value={form.roofType}
                onChange={(e) => update("roofType", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Betongpannor</option>
                <option>Tegelpannor</option>
                <option>Plåttak</option>
                <option>Eternit</option>
                <option>Papp</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Ålder (person)</label>
              <Input type="number" value={form.age} onChange={(e) => update("age", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="cold">Kall</option>
                <option value="warm">Varm</option>
                <option value="hot">Het</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Källa</label>
              <select
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="telemarketing">Telemarketing</option>
                <option value="field">Fältsälj</option>
                <option value="scan">Byggnadsscanning</option>
                <option value="referral">Referens</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Anteckningar</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Sparar..." : "Lägg till"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Avbryt
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
