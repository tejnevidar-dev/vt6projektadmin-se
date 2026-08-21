import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Target } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { kr } from "@/lib/commission";
import { fetchGoals, goalMap, monthKey, upsertGoal, type SalesGoal } from "@/lib/goals-api";
import type { Saljare } from "@/lib/saljare-api";
import { netValue } from "@/lib/commission";
import { reached } from "@/lib/sales-command-center";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  leads: Lead[];
  sellers: Saljare[];
  isAdmin: boolean;
}

interface Actual {
  revenue: number;
  deals: number;
  meetings: number;
  offers: number;
  winRate: number;
  avgOrder: number;
}

function actualsFor(leads: Lead[], monthStart: Date, monthEnd: Date): Actual {
  const inMonth = (v: string | null) => {
    if (!v) return false;
    const d = new Date(v);
    return d >= monthStart && d < monthEnd;
  };
  const won = leads.filter((l) => l.pipelineStage === "slutford" && inMonth(l.completedAt));
  const created = leads.filter((l) => inMonth(l.createdAt));
  const revenue = won.reduce((s, l) => s + netValue(l), 0);
  return {
    revenue: Math.round(revenue),
    deals: won.length,
    meetings: created.filter((l) => reached(l, "mote_bokat")).length,
    offers: created.filter((l) => reached(l, "offert_skickad")).length,
    winRate: created.length ? (created.filter((l) => l.pipelineStage === "slutford").length / created.length) * 100 : 0,
    avgOrder: won.length ? Math.round(revenue / won.length) : 0,
  };
}

const emptyGoal = (sellerId: string | null, period: string): SalesGoal => ({
  id: "",
  sellerId,
  periodMonth: period,
  revenueGoal: 0,
  dealsGoal: 0,
  meetingsGoal: 0,
  offersGoal: 0,
  winRateGoal: 0,
  avgOrderGoal: 0,
});

export function GoalsTab({ leads, sellers, isAdmin }: Props) {
  const [period, setPeriod] = useState(() => monthKey().slice(0, 7));
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const periodMonth = `${period}-01`;
  const monthStart = useMemo(() => new Date(`${periodMonth}T00:00:00`), [periodMonth]);
  const monthEnd = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1),
    [monthStart],
  );

  const load = async () => {
    setLoading(true);
    try {
      setGoals(await fetchGoals(periodMonth));
    } catch {
      toast.error("Kunde inte hämta mål");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMonth]);

  const map = useMemo(() => goalMap(goals), [goals]);
  const teamActual = useMemo(() => actualsFor(leads, monthStart, monthEnd), [leads, monthStart, monthEnd]);

  const rows = useMemo(
    () => [
      { key: "team", label: "Hela teamet", sellerId: null as string | null, actual: teamActual },
      ...sellers.map((s) => ({
        key: s.id,
        label: s.display_name || s.email,
        sellerId: s.id as string | null,
        actual: actualsFor(
          leads.filter((l) => (l.sellerId ?? l.createdBy) === s.id),
          monthStart,
          monthEnd,
        ),
      })),
    ],
    [sellers, leads, teamActual, monthStart, monthEnd],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mål & budget</h2>
          <p className="text-sm text-muted-foreground">
            Sätt mål per säljare och månad – utfallet uppdateras automatiskt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="goal-period" className="text-sm">
            Månad
          </Label>
          <Input
            id="goal-period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar mål…
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <GoalRow
              key={r.key}
              label={r.label}
              goal={map[r.key] ?? emptyGoal(r.sellerId, periodMonth)}
              actual={r.actual}
              isAdmin={isAdmin}
              onSaved={load}
              periodMonth={periodMonth}
              sellerId={r.sellerId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalRow({
  label,
  goal,
  actual,
  isAdmin,
  periodMonth,
  sellerId,
  onSaved,
}: {
  label: string;
  goal: SalesGoal;
  actual: Actual;
  isAdmin: boolean;
  periodMonth: string;
  sellerId: string | null;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(goal);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(goal), [goal.id, goal.periodMonth, goal.revenueGoal]);

  const save = async () => {
    setSaving(true);
    try {
      await upsertGoal({ ...draft, sellerId, periodMonth });
      toast.success(`Mål sparade för ${label}`);
      onSaved();
    } catch {
      toast.error("Kunde inte spara målen");
    } finally {
      setSaving(false);
    }
  };

  const metrics = [
    { label: "Omsättning", goal: draft.revenueGoal, value: actual.revenue, fmt: kr },
    { label: "Affärer", goal: draft.dealsGoal, value: actual.deals, fmt: (n: number) => String(n) },
    { label: "Möten", goal: draft.meetingsGoal, value: actual.meetings, fmt: (n: number) => String(n) },
    { label: "Offerter", goal: draft.offersGoal, value: actual.offers, fmt: (n: number) => String(n) },
    { label: "Vinstgrad", goal: draft.winRateGoal, value: Math.round(actual.winRate), fmt: (n: number) => `${n} %` },
    { label: "Snittorder", goal: draft.avgOrderGoal, value: actual.avgOrder, fmt: kr },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => {
            const pctVal = m.goal > 0 ? Math.min(100, (m.value / m.goal) * 100) : 0;
            return (
              <div key={m.label} className="rounded-md border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.goal > 0 ? `${Math.round(pctVal)} %` : "Inget mål"}
                  </span>
                </div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">
                  {m.fmt(m.value)}
                  {m.goal > 0 && <span className="text-muted-foreground"> / {m.fmt(m.goal)}</span>}
                </div>
                <Progress
                  value={pctVal}
                  className={cn("mt-2 h-1.5", pctVal >= 100 && "[&>div]:bg-success")}
                />
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3 lg:grid-cols-6">
            <NumField label="Omsättningsmål" value={draft.revenueGoal} onChange={(v) => setDraft({ ...draft, revenueGoal: v })} />
            <NumField label="Affärer" value={draft.dealsGoal} onChange={(v) => setDraft({ ...draft, dealsGoal: v })} />
            <NumField label="Möten" value={draft.meetingsGoal} onChange={(v) => setDraft({ ...draft, meetingsGoal: v })} />
            <NumField label="Offerter" value={draft.offersGoal} onChange={(v) => setDraft({ ...draft, offersGoal: v })} />
            <NumField label="Vinstgrad %" value={draft.winRateGoal} onChange={(v) => setDraft({ ...draft, winRateGoal: v })} />
            <NumField label="Snittorder" value={draft.avgOrderGoal} onChange={(v) => setDraft({ ...draft, avgOrderGoal: v })} />
            <div className="sm:col-span-3 lg:col-span-6">
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Sparar…" : "Spara mål"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-9"
      />
    </div>
  );
}
