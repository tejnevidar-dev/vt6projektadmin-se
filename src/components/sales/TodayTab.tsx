import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileSignature,
  Flame,
  ListTodo,
  Phone,
  PhoneCall,
  Skull,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LeadDetail } from "@/components/LeadDetail";
import { kr } from "@/lib/commission";
import {
  PRIORITY_META,
  actionSummary,
  staleDeals,
  todaysActions,
  type SalesAction,
} from "@/lib/sales-actions";
import { PIPELINE_STAGE_LABELS, type Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  leads: Lead[];
  /** Inloggad användares id – används för filtret "Mina leads". */
  userId?: string | null;
  onUpdated?: () => void;
}

const KIND_ICON: Record<SalesAction["kind"], typeof Phone> = {
  ring: PhoneCall,
  boka: CalendarClock,
  offert: FileSignature,
  mote: CheckCircle2,
  uppfoljning: Phone,
  komplettera: AlertTriangle,
};

export function TodayTab({ leads, userId, onUpdated }: Props) {
  const [scope, setScope] = useState<"mina" | "alla">(userId ? "mina" : "alla");
  const [selected, setSelected] = useState<Lead | null>(null);

  const scoped = useMemo(
    () =>
      scope === "mina" && userId
        ? leads.filter((l) => (l.sellerId ?? l.createdBy) === userId)
        : leads,
    [leads, scope, userId],
  );

  const now = useMemo(() => new Date(), []);
  const actions = useMemo(() => todaysActions(scoped, now), [scoped, now]);
  const stale = useMemo(() => staleDeals(scoped, now), [scoped, now]);
  const summary = useMemo(() => actionSummary(actions, stale), [actions, stale]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Vad ska jag göra idag?</h2>
          <p className="text-sm text-muted-foreground">
            Prioriterad lista utifrån affärsvärde, uppföljningsschema och kundkontakt.
          </p>
        </div>
        {userId && (
          <Tabs value={scope} onValueChange={(v) => setScope(v as "mina" | "alla")}>
            <TabsList>
              <TabsTrigger value="mina">Mina leads</TabsTrigger>
              <TabsTrigger value="alla">Hela teamet</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={ListTodo} label="Aktiviteter idag" value={String(summary.total)} />
        <MiniStat icon={Flame} label="Hög prioritet" value={String(summary.high)} tone="destructive" />
        <MiniStat icon={CalendarClock} label="Möten idag" value={String(summary.meetingsToday)} />
        <MiniStat icon={TrendingDown} label="Pipeline i riskzon" value={kr(summary.pipelineAtRisk)} tone="warning" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" /> Dagens lista
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Inget att följa upp just nu – all pipeline är färsk. 🎉
            </p>
          ) : (
            actions.slice(0, 25).map((a) => {
              const Icon = KIND_ICON[a.kind];
              const meta = PRIORITY_META[a.priority];
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a.lead)}
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{a.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.reason}</div>
                  </div>
                  {a.value > 0 && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{kr(a.value)}</span>
                  )}
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.className)}>
                    {meta.label}
                  </Badge>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Skull className="h-4 w-4" /> Affärer i riskzonen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stale.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Inga affärer i riskzonen.</p>
          ) : (
            stale.slice(0, 15).map((d) => (
              <button
                key={d.lead.id}
                onClick={() => setSelected(d.lead)}
                className="w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {d.lead.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {PIPELINE_STAGE_LABELS[d.lead.pipelineStage]}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{d.reasons.join(" · ")}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{d.value > 0 ? kr(d.value) : "–"}</div>
                    <div
                      className={cn(
                        "text-xs font-semibold",
                        d.risk >= 75 ? "text-destructive" : d.risk >= 55 ? "text-warning-foreground" : "text-muted-foreground",
                      )}
                    >
                      Risk {d.risk}/100
                    </div>
                  </div>
                </div>
                <Progress value={d.risk} className="mt-2 h-1.5" />
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selected && (
        <LeadDetail
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => onUpdated?.()}
        />
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  tone?: "destructive" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            tone === "destructive" ? "bg-destructive/10 text-destructive" : tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
