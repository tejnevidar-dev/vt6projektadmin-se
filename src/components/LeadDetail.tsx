import { useState } from "react";
import { X, Phone, MapPin, Calendar, Home, User, FileText, MessageSquare, Pencil, Save, ArrowRight, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { updateLead, updateLeadPipelineStage, deleteLead } from "@/lib/leads-api";
import type { Lead, LeadStatus, JobType } from "@/lib/types";
import { REGIONS, MUNICIPALITIES, JOB_TYPES, JOB_TYPE_LABELS, NEXT_PIPELINE_STAGE, PIPELINE_ACTION_LABELS, PIPELINE_STAGE_LABELS } from "@/lib/types";

interface LeadDetailProps {
  lead: Lead;
  onClose: () => void;
  onUpdated?: () => void;
}

const statusLabels: Record<string, string> = {
  cold: "Kall",
  warm: "Varm",
  hot: "Het",
  customer: "Kund",
  lost: "Förlorad",
};

const sourceLabels: Record<string, string> = {
  field: "Fältsälj",
  telemarketing: "Telemarketing",
  scan: "Byggnadsscanning",
  referral: "Referens",
  csv_import: "CSV-import",
};

export function LeadDetail({ lead, onClose, onUpdated }: LeadDetailProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone,
    address: lead.address,
    municipality: lead.municipality,
    region: lead.region,
    buildYear: lead.buildYear,
    roofType: lead.roofType,
    age: lead.age,
    status: lead.status as LeadStatus,
    jobType: lead.jobType as JobType,
    notes: lead.notes,
  });

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLead({
        id: lead.id,
        propertyId: lead.propertyId,
        ...form,
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error("Failed to update lead:", err);
    } finally {
      setSaving(false);
    }
  };

  const municipalities = form.region ? MUNICIPALITIES[form.region] || [] : [];

  if (editing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-start justify-between">
            <h2 className="text-xl font-bold text-card-foreground">Redigera lead</h2>
            <button onClick={() => setEditing(false)} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            <Field label="Namn">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Telefon">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Ålder">
              <Input type="number" value={form.age} onChange={(e) => set("age", parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Adress">
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Region">
                <Select value={form.region} onValueChange={(v) => { set("region", v); set("municipality", ""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Kommun">
                <Select value={form.municipality} onValueChange={(v) => set("municipality", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {municipalities.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Byggnadsår">
                <Input type="number" value={form.buildYear} onChange={(e) => set("buildYear", parseInt(e.target.value) || 0)} />
              </Field>
              <Field label="Taktyp">
                <Input value={form.roofType} onChange={(e) => set("roofType", e.target.value)} />
              </Field>
            </div>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Jobbtyp">
              <Select value={form.jobType} onValueChange={(v) => set("jobType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((jt) => <SelectItem key={jt} value={jt}>{JOB_TYPE_LABELS[jt]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Anteckningar">
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </Field>
          </div>

          <div className="mt-6 flex gap-3">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Sparar..." : "Spara"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-card-foreground">{lead.name}</h2>
            <p className="text-sm text-muted-foreground">{lead.age} år · {sourceLabels[lead.source]}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow icon={Phone} label="Telefon">
              <a href={`tel:${lead.phone.replace(/[\s-]/g, "")}`} className="text-primary hover:underline">{lead.phone}</a>
            </InfoRow>
            <InfoRow icon={User} label="Status">
              <span className="font-medium">{statusLabels[lead.status]}</span>
            </InfoRow>
          </div>

          <InfoRow icon={MapPin} label="Adress"><span>{lead.address}</span></InfoRow>

          <div className="grid grid-cols-3 gap-4">
            <InfoRow icon={Calendar} label="Byggnadsår"><span className="font-medium">{lead.buildYear}</span></InfoRow>
            <InfoRow icon={Home} label="Taktyp"><span>{lead.roofType}</span></InfoRow>
            <InfoRow icon={Home} label="Takålder">
              <span className={`font-medium ${lead.roofAge > 40 ? "text-destructive" : ""}`}>{lead.roofAge} år</span>
            </InfoRow>
          </div>

          {lead.hasRoofPermit && (
            <div className="rounded-lg bg-warning/10 p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-warning-foreground" />
                <span className="text-sm font-medium text-warning-foreground">Bygglov ansökt (takarbete)</span>
              </div>
            </div>
          )}

          {lead.notes && (
            <div className="rounded-lg bg-muted p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Anteckningar</span>
              </div>
              <p className="text-sm text-card-foreground">{lead.notes}</p>
            </div>
          )}

          {lead.lastContact && (
            <p className="text-xs text-muted-foreground">Senast kontaktad: {lead.lastContact}</p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pipeline-status</span>
              <span className="text-sm font-semibold text-card-foreground">{PIPELINE_STAGE_LABELS[lead.pipelineStage]}</span>
            </div>
            {(() => {
              const next = NEXT_PIPELINE_STAGE[lead.pipelineStage];
              const isDone = lead.pipelineStage === "slutford";
              return (
                <Button
                  className="w-full"
                  variant={isDone ? "outline" : "default"}
                  disabled={!next || saving}
                  onClick={async () => {
                    if (!next) return;
                    setSaving(true);
                    try {
                      await updateLeadPipelineStage(lead.id, next);
                      onUpdated?.();
                      onClose();
                    } catch (err) {
                      console.error("Failed to update pipeline stage:", err);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {isDone ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {PIPELINE_ACTION_LABELS[lead.pipelineStage]}
                </Button>
              );
            })()}
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" asChild>
              <a href={`tel:${lead.phone.replace(/[\s-]/g, "")}`}>
                <Phone className="mr-2 h-4 w-4" />
                Ring
              </a>
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Redigera
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm text-card-foreground">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
