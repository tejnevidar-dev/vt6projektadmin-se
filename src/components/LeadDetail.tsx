import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Phone, MapPin, Calendar as CalendarIcon, Home, User, FileText, MessageSquare, Pencil, Save, ArrowRight, ArrowLeft, CheckCircle2, Trash2, FileSignature, ExternalLink, CheckCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { updateLead, updateLeadPipelineStage, updateLeadBooking, deleteLead, setLeadNeedsOffer, setLeadRotPaid, setLeadContactPerson } from "@/lib/leads-api";
import { fetchSaljare, type Saljare } from "@/lib/saljare-api";
import { useEffect } from "react";
import { waitForJobByLead } from "@/lib/jobs-api";
import { BookingDateDialog } from "@/components/BookingDateDialog";
import { OfferPdfCard } from "@/components/OfferPdfCard";
import { LeadDocumentsCard } from "@/components/LeadDocumentsCard";
import type { Lead, LeadStatus, JobType } from "@/lib/types";
import { REGIONS, MUNICIPALITIES, JOB_TYPES, JOB_TYPE_LABELS, NEXT_PIPELINE_STAGE, PREVIOUS_PIPELINE_STAGE, PIPELINE_ACTION_LABELS, PIPELINE_BACK_LABELS, PIPELINE_STAGE_LABELS } from "@/lib/types";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookingFor, setBookingFor] = useState<null | { from: Lead["pipelineStage"] }>(null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLead(lead.id);
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error("Failed to delete lead:", err);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };
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
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  if (!portalRoot) return null;

  if (editing) {
    return createPortal(
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
      </div>,
      portalRoot
    );
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-l border-border bg-card shadow-2xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-card-foreground">{lead.name}</h2>
            <p className="text-sm text-muted-foreground">{lead.age} år · {sourceLabels[lead.source]}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="shrink-0"
            aria-label="Stäng"
          >
            <X className="mr-1 h-4 w-4" />
            Stäng
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              <InfoRow icon={Phone} label="Telefon">
                <a href={`tel:${lead.phone.replace(/[\s-]/g, "")}`} className="text-primary hover:underline">{lead.phone}</a>
              </InfoRow>
              <InfoRow icon={User} label="Status">
                <span className="font-medium">{statusLabels[lead.status]}</span>
              </InfoRow>
            </div>

            <InfoRow icon={MapPin} label="Adress"><span>{lead.address}</span></InfoRow>

            <div className="grid grid-cols-3 gap-4">
              <InfoRow icon={CalendarIcon} label="Byggnadsår"><span className="font-medium">{lead.buildYear}</span></InfoRow>
              <InfoRow icon={Home} label="Taktyp"><span>{lead.roofType}</span></InfoRow>
              <InfoRow icon={Home} label="Takålder">
                <span className={`font-medium ${lead.roofAge > 40 ? "text-destructive" : ""}`}>{lead.roofAge} år</span>
              </InfoRow>
            </div>

            {!(lead.pipelineStage === "bokad" || lead.pipelineStage === "pagaende" || lead.pipelineStage === "slutford") && (
              <ContactPersonSection lead={lead} onSaved={onUpdated} />
            )}

            {(lead.pipelineStage === "bokad" || lead.pipelineStage === "pagaende" || lead.pipelineStage === "slutford") && (
              <BookingSection lead={lead} onSaved={onUpdated} />
            )}

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
        </div>

        {/* Sticky footer with actions */}
        <div className="shrink-0 border-t border-border bg-card/95 px-6 py-4 backdrop-blur space-y-3">
          {lead.pipelineStage === "offererad" && (
            <OfferPdfCard leadId={lead.id} offerPdfPath={lead.offerPdfPath} onChanged={onUpdated} />
          )}
          {lead.pipelineStage === "slutford" && (lead.rotAmount ?? 0) > 0 && (
            <div className={cn(
              "rounded-lg border p-3 space-y-2",
              lead.rotPaid ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">ROT-avdrag</span>
                <span className="text-sm font-semibold text-card-foreground">{lead.rotAmount?.toLocaleString("sv-SE")} kr</span>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <a
                  href="https://www7.skatteverket.se/portal/rotrut/begar-utbetalning/rot/kopare"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Begär ROT hos Skatteverket
                </a>
              </Button>
              <Button
                variant={lead.rotPaid ? "default" : "outline"}
                className={cn(
                  "w-full",
                  lead.rotPaid ? "bg-success text-success-foreground hover:bg-success/90" : ""
                )}
                onClick={async () => {
                  try {
                    await setLeadRotPaid(lead.id, !lead.rotPaid);
                    onUpdated?.();
                  } catch (err) {
                    console.error("Failed to toggle rot paid:", err);
                  }
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {lead.rotPaid ? "ROT begärd ✓" : "Markera ROT som begärd"}
              </Button>
            </div>
          )}
          <LeadDocumentsCard leadId={lead.id} />
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pipeline-status</span>
              <span className="text-sm font-semibold text-card-foreground">{PIPELINE_STAGE_LABELS[lead.pipelineStage]}</span>
            </div>
            {(() => {
              const next = NEXT_PIPELINE_STAGE[lead.pipelineStage];
              const prev = PREVIOUS_PIPELINE_STAGE[lead.pipelineStage];
              const isDone = lead.pipelineStage === "slutford";
              const move = async (target: typeof next) => {
                if (!target) return;
                if (target === "bokad") {
                  setBookingFor({ from: lead.pipelineStage });
                  return;
                }
                setSaving(true);
                const toastId = toast.loading(
                  target === "pagaende" ? "Flyttar till Pågående…" : `Flyttar till ${PIPELINE_STAGE_LABELS[target]}…`
                );
                try {
                  await updateLeadPipelineStage(lead.id, target, lead.pipelineStage);
                  if (target === "pagaende") {
                    toast.loading("Skapar projekt under Projekt-fliken…", { id: toastId });
                    const ok = await waitForJobByLead(lead.id);
                    if (ok) {
                      toast.success("Projekt skapat under Projekt-fliken", { id: toastId });
                    } else {
                      toast.warning("Status uppdaterad – projektet syns inom kort", { id: toastId });
                    }
                  } else {
                    toast.success(`Flyttad till ${PIPELINE_STAGE_LABELS[target]}`, { id: toastId });
                  }
                  onUpdated?.();
                  onClose();
                } catch (err) {
                  console.error("Failed to update pipeline stage:", err);
                  toast.error("Kunde inte uppdatera status", { id: toastId });
                } finally {
                  setSaving(false);
                }
              };
              return (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant={isDone ? "outline" : "default"}
                    disabled={!next || saving}
                    onClick={() => move(next)}
                  >
                    {isDone ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    {PIPELINE_ACTION_LABELS[lead.pipelineStage]}
                  </Button>
                  {prev && (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={saving}
                      onClick={() => move(prev)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {PIPELINE_BACK_LABELS[lead.pipelineStage]}
                    </Button>
                  )}
                </div>
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
          <Button
            variant="outline"
            className={cn(
              "w-full",
              lead.needsOffer
                ? "border-warning bg-warning/15 text-warning-foreground hover:bg-warning/25"
                : ""
            )}
            onClick={async () => {
              try {
                await setLeadNeedsOffer(lead.id, !lead.needsOffer);
                onUpdated?.();
              } catch (err) {
                console.error("Failed to toggle needs offer:", err);
              }
            }}
          >
            <FileSignature className="mr-2 h-4 w-4" />
            {lead.needsOffer ? "Avmarkera Att offertera" : "Markera som Att offertera"}
          </Button>
          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Ta bort lead
          </Button>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort {lead.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Detta tar bort leaden permanent. Åtgärden kan inte ångras.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Tar bort..." : "Ta bort"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <BookingDateDialog
          open={bookingFor !== null}
          leadName={lead.name}
          initialDate={lead.bookingDate}
          initialPrice={lead.price}
          initialRotAmount={lead.rotAmount}
          initialAssignmentType={(lead.assignmentType as "none" | "subcontractor" | "foreman" | null) ?? "none"}
          initialSubcontractorName={lead.subcontractorName}
          initialSubcontractorPrice={lead.subcontractorPrice}
          initialForemanName={lead.foremanName}
          initialForemanUserId={lead.assignedTo}
          onCancel={() => setBookingFor(null)}
          onConfirm={async (details) => {
            try {
              await updateLeadPipelineStage(lead.id, "bokad", bookingFor?.from, {
                bookingDate: details.isoDate,
                price: details.price,
                rotAmount: details.rotAmount,
                assignmentType: details.assignmentType,
                subcontractorName: details.subcontractorName,
                subcontractorPrice: details.subcontractorPrice,
                foremanName: details.foremanName,
                foremanUserId: details.foremanUserId,
              });
              onUpdated?.();
              setBookingFor(null);
              onClose();
            } catch (err) {
              console.error("Failed to book lead:", err);
            }
          }}
        />

      </div>
    </>,
    portalRoot
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

function BookingSection({ lead, onSaved }: { lead: Lead; onSaved?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialDate = lead.bookingDate ? new Date(lead.bookingDate) : null;
  const [date, setDate] = useState<Date | undefined>(initialDate ?? undefined);
  const [time, setTime] = useState<string>(initialDate ? format(initialDate, "HH:mm") : "08:00");
  const [price, setPrice] = useState<string>(lead.price != null ? String(lead.price) : "");
  const [rotAmount, setRotAmount] = useState<string>(lead.rotAmount != null ? String(lead.rotAmount) : "");
  const [subName, setSubName] = useState<string>(lead.subcontractorName ?? "");

  const reset = () => {
    setDate(initialDate ?? undefined);
    setTime(initialDate ? format(initialDate, "HH:mm") : "08:00");
    setPrice(lead.price != null ? String(lead.price) : "");
    setRotAmount(lead.rotAmount != null ? String(lead.rotAmount) : "");
    setSubName(lead.subcontractorName ?? "");
  };

  const priceNum = price.trim() === "" ? null : Number(price);
  const rotNum = rotAmount.trim() === "" ? null : Number(rotAmount);
  const customerPrice = priceNum != null ? priceNum - (rotNum ?? 0) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      let bookingDate: string | null = null;
      if (date) {
        const [h, m] = time.split(":").map((v) => parseInt(v) || 0);
        const merged = new Date(date);
        merged.setHours(h, m, 0, 0);
        bookingDate = merged.toISOString();
      }
      const trimmedSub = subName.trim();
      await updateLeadBooking(lead.id, {
        bookingDate,
        price: priceNum,
        rotAmount: rotNum,
        subcontractorName: trimmedSub === "" ? null : trimmedSub,
        assignmentType: trimmedSub === "" ? "none" : "subcontractor",
      });
      onSaved?.();
      setEditing(false);
    } catch (err) {
      console.error("Failed to save booking:", err);
    } finally {
      setSaving(false);
    }
  };


  if (!editing) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-warning-foreground">Bokning</div>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3 w-3" /> Redigera
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow icon={CalendarIcon} label="Bokad arbetsstart">
            <span className="font-medium">
              {lead.bookingDate
                ? new Date(lead.bookingDate).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })
                : <span className="text-muted-foreground">Ej satt</span>}
            </span>
          </InfoRow>
          <InfoRow icon={FileText} label="Pris">
            <span className="font-medium">
              {lead.price != null
                ? `${lead.price.toLocaleString("sv-SE")} kr`
                : <span className="text-muted-foreground">Ej satt</span>}
            </span>
          </InfoRow>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow icon={FileText} label="ROT att begära">
            <span className="font-medium text-warning-foreground">
              {lead.rotAmount != null
                ? `${lead.rotAmount.toLocaleString("sv-SE")} kr`
                : <span className="text-muted-foreground">Ej satt</span>}
            </span>
          </InfoRow>
          <InfoRow icon={FileText} label="Pris för kund">
            <span className="font-semibold">
              {lead.price != null
                ? `${(lead.price - (lead.rotAmount ?? 0)).toLocaleString("sv-SE")} kr`
                : <span className="text-muted-foreground">Ej satt</span>}
            </span>
          </InfoRow>
        </div>

        <InfoRow icon={User} label="Tilldelad underentreprenör">
          <span className="font-medium">
            {lead.subcontractorName
              ? lead.subcontractorName
              : <span className="text-muted-foreground">Ingen tilldelad</span>}
          </span>
        </InfoRow>
        {lead.foremanName && (
          <InfoRow icon={User} label="Arbetsledare">
            <span>{lead.foremanName}</span>
          </InfoRow>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-warning-foreground">Redigera bokning</div>
      <Field label="Bokad arbetsstart">
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1 justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "d MMM yyyy", { locale: sv }) : "Välj datum"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                locale={sv}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-28"
          />
          {date && (
            <Button type="button" size="icon" variant="ghost" onClick={() => setDate(undefined)} title="Rensa">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pris (kr)">
          <Input
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="t.ex. 150000"
          />
        </Field>
        <Field label="ROT att begära (kr)">
          <Input
            type="number"
            inputMode="numeric"
            value={rotAmount}
            onChange={(e) => setRotAmount(e.target.value)}
            placeholder="t.ex. 45000"
          />
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
        <span className="text-muted-foreground">Pris för kund</span>
        <span className="font-semibold text-card-foreground">
          {customerPrice != null ? `${customerPrice.toLocaleString("sv-SE")} kr` : "—"}
        </span>
      </div>

      <Field label="Tilldelad underentreprenör">
        <Input
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
          placeholder="Namn på underentreprenör"
          maxLength={120}
        />
      </Field>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Sparar..." : "Spara"}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => { reset(); setEditing(false); }} disabled={saving}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

function ContactPersonSection({ lead, onSaved }: { lead: Lead; onSaved?: () => void }) {
  const [options, setOptions] = useState<Saljare[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState<string>(lead.contactPersonId ?? "");

  useEffect(() => {
    setLoading(true);
    fetchSaljare()
      .then((data) => setOptions(data))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setValue(lead.contactPersonId ?? "");
  }, [lead.contactPersonId]);

  const current = options.find((o) => o.id === lead.contactPersonId);

  const handleChange = async (next: string) => {
    const nextId = next === "__none__" ? null : next;
    setValue(next === "__none__" ? "" : next);
    setSaving(true);
    try {
      const name = options.find((o) => o.id === nextId)?.display_name;
      await setLeadContactPerson(lead.id, nextId, name);
      toast.success(nextId ? "Kontaktperson uppdaterad" : "Kontaktperson borttagen");
      onSaved?.();
    } catch (err) {
      console.error("Failed to set contact person:", err);
      toast.error("Kunde inte uppdatera kontaktperson");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Säljare / kontaktperson
        </span>
      </div>
      <Select value={value || "__none__"} onValueChange={handleChange} disabled={saving || loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Laddar…" : "Välj kontaktperson"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Ingen tilldelad</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current && (
        <p className="text-xs text-muted-foreground">Ansvarig: {current.display_name}</p>
      )}
    </div>
  );
}
