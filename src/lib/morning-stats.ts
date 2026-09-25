// Aggregerade morgonsiffror (bara antal, inga namn/telefon/mail). Ren logik utan I/O;
// endpointen ligger i routes/api/public/morning-stats.ts.

export const WON_STAGES = ["bokad", "pagaende", "slutford"] as const;
export const INTAKE_SOURCES = ["roslagstak", "email", "inbox"] as const;
const DAY = 86400000;

export interface StatsLead {
  id: string;
  source: string;
  pipeline_stage: string;
  created_at: string;
  updated_at: string;
  offer_accepted_at: string | null;
  completed_at: string | null;
  last_contact: string | null;
}

export type CountBySource = Record<string, number>;

export interface WindowCounts {
  total: number;
  by_source: CountBySource;
}

export interface MorningStats {
  generated_at: string;
  new_leads: { last_24h: WindowCounts; last_7d: WindowCounts; month_to_date: WindowCounts };
  unanswered: { over_sla: number; total: number; oldest_hours: number | null; sla_hours: number };
  pipeline: Record<string, number>;
  offers_out: number;
  won: { last_24h: WindowCounts; last_7d: WindowCounts; month_to_date: WindowCounts; total: number };
  last_lead_at: string | null;
  hours_since_last_lead: number | null;
  intake_errors_24h: number;
}

const empty = (): WindowCounts => ({ total: 0, by_source: {} });
const add = (w: WindowCounts, source: string) => {
  w.total++;
  w.by_source[source] = (w.by_source[source] ?? 0) + 1;
};

/** Första dagen i innevarande månad (Stockholmstid) som UTC-tidpunkt. */
export function monthStartStockholm(now: Date): Date {
  const parts = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", timeZone: "Europe/Stockholm" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  // Midnatt Stockholm ≈ föregående dag 22:00/23:00 UTC; 3 h marginal räcker för räknefönster.
  return new Date(Date.UTC(y, m - 1, 1, -2, 0, 0));
}

export const isWon = (l: StatsLead) => !!l.offer_accepted_at || (WON_STAGES as readonly string[]).includes(l.pipeline_stage);
export const wonDate = (l: StatsLead) => new Date(l.offer_accepted_at ?? l.completed_at ?? l.updated_at);

export function buildMorningStats(input: {
  leads: StatsLead[];
  /** Lead-id:n som någon i personalen hanterat (aktivitet med user_id). */
  staffTouchedLeadIds: Set<string>;
  slaHours: number;
  intakeErrors24h: number;
  now?: Date;
}): MorningStats {
  const now = input.now ?? new Date();
  const t24 = now.getTime() - DAY;
  const t7 = now.getTime() - 7 * DAY;
  const tMonth = monthStartStockholm(now).getTime();
  const slaCut = now.getTime() - input.slaHours * 3600000;
  const lookback = now.getTime() - 72 * 3600000;

  const newLeads = { last_24h: empty(), last_7d: empty(), month_to_date: empty() };
  const won = { last_24h: empty(), last_7d: empty(), month_to_date: empty(), total: 0 };
  const pipeline: Record<string, number> = {};
  let offersOut = 0;
  let overSla = 0;
  let unansweredTotal = 0;
  let oldestMs: number | null = null;
  let lastLeadMs: number | null = null;

  for (const l of input.leads) {
    const created = new Date(l.created_at).getTime();
    if (created >= t24) add(newLeads.last_24h, l.source);
    if (created >= t7) add(newLeads.last_7d, l.source);
    if (created >= tMonth) add(newLeads.month_to_date, l.source);
    if ((INTAKE_SOURCES as readonly string[]).includes(l.source) && (lastLeadMs === null || created > lastLeadMs)) lastLeadMs = created;

    pipeline[l.pipeline_stage] = (pipeline[l.pipeline_stage] ?? 0) + 1;
    if (l.pipeline_stage === "offert_skickad") offersOut++;

    if (isWon(l)) {
      won.total++;
      const d = wonDate(l).getTime();
      if (d >= t24) add(won.last_24h, l.source);
      if (d >= t7) add(won.last_7d, l.source);
      if (d >= tMonth) add(won.month_to_date, l.source);
    }

    const untouched =
      l.pipeline_stage === "inkommande_webb" &&
      (INTAKE_SOURCES as readonly string[]).includes(l.source) &&
      !l.last_contact &&
      !input.staffTouchedLeadIds.has(l.id);
    if (untouched) {
      unansweredTotal++;
      if (created <= slaCut && created >= lookback) overSla++;
      if (oldestMs === null || created < oldestMs) oldestMs = created;
    }
  }

  return {
    generated_at: now.toISOString(),
    new_leads: newLeads,
    unanswered: {
      over_sla: overSla,
      total: unansweredTotal,
      oldest_hours: oldestMs === null ? null : Math.round((now.getTime() - oldestMs) / 3600000),
      sla_hours: input.slaHours,
    },
    pipeline,
    offers_out: offersOut,
    won,
    last_lead_at: lastLeadMs === null ? null : new Date(lastLeadMs).toISOString(),
    hours_since_last_lead: lastLeadMs === null ? null : Math.round(((now.getTime() - lastLeadMs) / 3600000) * 10) / 10,
    intake_errors_24h: input.intakeErrors24h,
  };
}
