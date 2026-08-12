import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Phone, MapPin, Calendar, Hammer, Droplets, Wrench, Flame, AlertTriangle, FileSignature, Receipt, Landmark } from "lucide-react";
import type { Lead, PipelineStage, JobType, LeadStatus } from "@/lib/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, hasIncompleteBooking, isUninvoiced, isRotApplicationDue } from "@/lib/types";
import { scoreLabel } from "@/lib/lead-scoring";
import { cn } from "@/lib/utils";

const STAGE_ACCENT: Record<PipelineStage, string> = {
  inkommande_webb: "border-l-info",
  saljpanel: "border-l-primary",
  offererad: "border-l-accent",
  bokad: "border-l-warning",
  pagaende: "border-l-chart-4",
  slutford: "border-l-success",
};

const STATUS_DOT: Record<LeadStatus, string> = {
  cold: "bg-muted-foreground",
  warm: "bg-warning",
  hot: "bg-destructive",
  customer: "bg-success",
  lost: "bg-muted-foreground/40",
};

const STATUS_BADGE: Record<LeadStatus, { label: string; className: string }> = {
  cold: { label: "Kall", className: "bg-muted text-muted-foreground" },
  warm: { label: "Varm", className: "bg-warning/15 text-warning-foreground" },
  hot: { label: "Het", className: "bg-destructive/15 text-destructive" },
  customer: { label: "Kund", className: "bg-success/15 text-success" },
  lost: { label: "Förlorad", className: "bg-muted text-muted-foreground" },
};

const JOB_ICON: Record<JobType, typeof Hammer> = {
  roof_replacement: Hammer,
  roof_cleaning: Droplets,
  light_roof_work: Wrench,
};

interface Props {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onStageChange: (leadId: string, stage: PipelineStage) => void;
  stages?: PipelineStage[];
}

export function LeadKanban({ leads, onSelect, onStageChange, stages = PIPELINE_STAGES }: Props) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => {
    const lead = leads.find((l) => l.id === e.active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLead(null);
    const overId = e.over?.id as PipelineStage | undefined;
    const leadId = e.active.id as string;
    if (!overId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.pipelineStage !== overId) {
      onStageChange(leadId, overId);
    }
  };

  const cols = Math.min(Math.max(stages.length, 1), 5);
  const gridCols = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-2 md:grid-cols-4", "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"][cols];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={cn("grid gap-3 pb-2", gridCols)}>
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.pipelineStage === stage);
          return (
            <KanbanColumn key={stage} stage={stage} count={stageLeads.length}>
              {stageLeads.map((lead) => (
                <KanbanCard key={lead.id} lead={lead} onSelect={onSelect} />
              ))}
            </KanbanColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeLead && <KanbanCardInner lead={activeLead} dragging />}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ stage, count, children }: { stage: PipelineStage; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {PIPELINE_STAGE_LABELS[stage]}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-2 rounded-lg border border-border bg-card/40 p-2 transition-colors",
          isOver && "border-primary bg-primary/5"
        )}
      >
        {children}
        {count === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground/60">
            Inga {PIPELINE_STAGE_LABELS[stage].toLowerCase()} ännu.
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({ lead, onSelect }: { lead: Lead; onSelect: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(lead)}
      className={cn("touch-none", isDragging && "opacity-30")}
    >
      <KanbanCardInner lead={lead} />
    </div>
  );
}

function KanbanCardInner({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  const Icon = JOB_ICON[lead.jobType];
  const score = scoreLabel(lead.score);
  const isBooked = lead.pipelineStage === "bokad" || lead.pipelineStage === "pagaende" || lead.pipelineStage === "slutford";
  const incomplete = hasIncompleteBooking(lead);
  return (
    <div
      className={cn(
        "cursor-pointer rounded-md border-l-4 border border-border bg-card p-3 text-sm shadow-sm transition-all hover:border-primary/50 hover:shadow-md",
        STAGE_ACCENT[lead.pipelineStage],
        dragging && "rotate-2 shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{lead.name}</div>
          {lead.address && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.address}</span>
            </div>
          )}
        </div>
        {isBooked ? (
          incomplete && (
            <span
              className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive"
              title="Bokning saknar pris eller tilldelning"
            >
              <AlertTriangle className="h-3 w-3" />
              Saknar info
            </span>
          )
        ) : (
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              STATUS_BADGE[lead.status].className
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[lead.status])} />
            {STATUS_BADGE[lead.status].label}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {lead.phone && (
          <>
            <Phone className="h-3 w-3" />
            <span className="truncate">{lead.phone}</span>
          </>
        )}
        {lead.buildYear > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {lead.buildYear}
          </span>
        )}
      </div>
      {!isBooked && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              score.className
            )}
            title={`Lead-score ${lead.score}/100`}
          >
            <Flame className="h-3 w-3" />
            {score.label} · {lead.score}
          </span>
          {incomplete && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive"
              title="Bokning saknar pris eller tilldelning"
            >
              <AlertTriangle className="h-3 w-3" />
              Saknar info
            </span>
          )}
        </div>
      )}
      {lead.needsOffer && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-warning px-2 py-1 text-[11px] font-bold text-warning-foreground shadow-sm">
          <FileSignature className="h-3 w-3" />
          Att offertera
        </div>
      )}
      {isUninvoiced(lead) && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-bold text-destructive shadow-sm">
          <Receipt className="h-3 w-3" />
          Ej fakturerad
        </div>
      )}
      {isRotApplicationDue(lead) && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-warning px-2 py-1 text-[11px] font-bold text-warning-foreground shadow-sm">
          <Landmark className="h-3 w-3" />
          Att ansöka om ROT
        </div>
      )}
      {isBooked && lead.bookingDate && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-warning px-2 py-1 text-[11px] font-bold text-warning-foreground shadow-sm">
          <Calendar className="h-3 w-3" />
          {new Date(lead.bookingDate).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
        </div>
      )}
    </div>
  );
}
