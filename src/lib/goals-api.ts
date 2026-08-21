import { supabase } from "@/integrations/supabase/client";

export interface SalesGoal {
  id: string;
  /** null = mål för hela teamet. */
  sellerId: string | null;
  /** Första dagen i målmånaden, format YYYY-MM-DD. */
  periodMonth: string;
  revenueGoal: number;
  dealsGoal: number;
  meetingsGoal: number;
  offersGoal: number;
  winRateGoal: number;
  avgOrderGoal: number;
}

export type GoalInput = Omit<SalesGoal, "id">;

const TEAM = "team";

/** Nyckel för uppslag: säljar-id eller "team". */
export const goalKey = (sellerId: string | null) => sellerId ?? TEAM;

/** Första dagen i månaden som ISO-datum. */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const fromRow = (r: Record<string, any>): SalesGoal => ({
  id: r.id,
  sellerId: r.seller_id ?? null,
  periodMonth: r.period_month,
  revenueGoal: Number(r.revenue_goal ?? 0),
  dealsGoal: Number(r.deals_goal ?? 0),
  meetingsGoal: Number(r.meetings_goal ?? 0),
  offersGoal: Number(r.offers_goal ?? 0),
  winRateGoal: Number(r.win_rate_goal ?? 0),
  avgOrderGoal: Number(r.avg_order_goal ?? 0),
});

export async function fetchGoals(periodMonth?: string): Promise<SalesGoal[]> {
  let q = (supabase.from("sales_goals") as any).select("*");
  if (periodMonth) q = q.eq("period_month", periodMonth);
  const { data, error } = await q.order("period_month", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function upsertGoal(input: GoalInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const patch = {
    seller_id: input.sellerId,
    period_month: input.periodMonth,
    revenue_goal: input.revenueGoal,
    deals_goal: input.dealsGoal,
    meetings_goal: input.meetingsGoal,
    offers_goal: input.offersGoal,
    win_rate_goal: input.winRateGoal,
    avg_order_goal: input.avgOrderGoal,
    created_by: userData.user?.id ?? null,
  };

  const existing = (supabase.from("sales_goals") as any)
    .select("id")
    .eq("period_month", input.periodMonth);
  const { data: found } = input.sellerId
    ? await existing.eq("seller_id", input.sellerId).maybeSingle()
    : await existing.is("seller_id", null).maybeSingle();

  if (found?.id) {
    const { error } = await (supabase.from("sales_goals") as any).update(patch).eq("id", found.id);
    if (error) throw error;
  } else {
    const { error } = await (supabase.from("sales_goals") as any).insert(patch);
    if (error) throw error;
  }
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await (supabase.from("sales_goals") as any).delete().eq("id", id);
  if (error) throw error;
}

/** Uppslag: nyckel (säljar-id eller "team") → mål. */
export function goalMap(goals: SalesGoal[]): Record<string, SalesGoal> {
  return Object.fromEntries(goals.map((g) => [goalKey(g.sellerId), g]));
}
