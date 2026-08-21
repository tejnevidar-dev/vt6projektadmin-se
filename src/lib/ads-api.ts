import { supabase } from "@/integrations/supabase/client";

export type AdProvider = "google_ads" | "meta_ads";

export interface AdSpendRecord {
  id: string;
  provider: AdProvider;
  accountId: string;
  campaignId: string;
  campaignName: string;
  spendDate: string;
  cost: number;
  impressions: number;
  clicks: number;
  leadSource: string | null;
}

export interface AdSyncRun {
  id: string;
  provider: AdProvider;
  status: string;
  rowsUpserted: number;
  periodStart: string | null;
  periodEnd: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface AdSourceRule {
  id: string;
  provider: AdProvider;
  campaignPattern: string | null;
  leadSource: string;
}

export async function fetchAdSpend(fromDate?: string, toDate?: string): Promise<AdSpendRecord[]> {
  let q = supabase.from("ad_spend").select("*").order("spend_date", { ascending: false });
  if (fromDate) q = q.gte("spend_date", fromDate);
  if (toDate) q = q.lte("spend_date", toDate);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    provider: r.provider as AdProvider,
    accountId: r.account_id,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    spendDate: r.spend_date,
    cost: Number(r.cost ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    leadSource: r.lead_source,
  }));
}

export async function fetchAdSyncRuns(): Promise<AdSyncRun[]> {
  const { data, error } = await supabase
    .from("ad_sync_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    provider: r.provider as AdProvider,
    status: r.status,
    rowsUpserted: r.rows_upserted,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  }));
}

export async function fetchAdSourceRules(): Promise<AdSourceRule[]> {
  const { data, error } = await supabase.from("ad_source_map").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    provider: r.provider as AdProvider,
    campaignPattern: r.campaign_pattern,
    leadSource: r.lead_source,
  }));
}

export async function upsertAdSourceRule(rule: {
  id?: string;
  provider: AdProvider;
  campaignPattern: string | null;
  leadSource: string;
}) {
  const payload = {
    provider: rule.provider,
    campaign_pattern: rule.campaignPattern,
    lead_source: rule.leadSource,
  };
  if (rule.id) {
    const { error } = await supabase.from("ad_source_map").update(payload).eq("id", rule.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("ad_source_map").insert(payload);
    if (error) throw error;
  }
}

export async function deleteAdSourceRule(id: string) {
  const { error } = await supabase.from("ad_source_map").delete().eq("id", id);
  if (error) throw error;
}

/** Summerar hämtad annonskostnad per leadkälla (kr). */
export function adCostsBySource(rows: AdSpendRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.leadSource ?? "roslagstak";
    out[key] = (out[key] ?? 0) + r.cost;
  }
  for (const key of Object.keys(out)) out[key] = Math.round(out[key]!);
  return out;
}
