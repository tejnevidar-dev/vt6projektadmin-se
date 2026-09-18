import { supabase } from "@/integrations/supabase/client";
import type { PipelineStage } from "@/lib/types";

// `lead_stage_history` isn't in the generated types yet (added in migration
// 20260917090000_lead_stage_history.sql) -- same as-any pattern as notifications-api.ts.
const db = supabase as any;

export interface StageHistoryRow {
  leadId: string;
  fromStage: PipelineStage | null;
  toStage: PipelineStage;
  changedAt: string;
}

export async function fetchLeadStageHistory(): Promise<StageHistoryRow[]> {
  const { data, error } = await db
    .from("lead_stage_history")
    .select("lead_id, from_stage, to_stage, changed_at")
    .order("lead_id", { ascending: true })
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    leadId: r.lead_id,
    fromStage: r.from_stage,
    toStage: r.to_stage,
    changedAt: r.changed_at,
  }));
}

export interface StageDuration {
  stage: PipelineStage;
  avgDays: number;
  samples: number;
}

/**
 * Snitt antal dagar leads spenderar i varje steg, baserat på closed intervals
 * (tid mellan att ett steg påbörjades och nästa övergång). Steget en lead befinner
 * sig i just nu (ingen "nästa" övergång ännu) räknas inte in -- bara avslutade steg.
 */
export function avgTimeInStage(history: StageHistoryRow[]): StageDuration[] {
  const byLead = new Map<string, StageHistoryRow[]>();
  for (const row of history) {
    if (!byLead.has(row.leadId)) byLead.set(row.leadId, []);
    byLead.get(row.leadId)!.push(row);
  }

  const durationsByStage = new Map<PipelineStage, number[]>();
  for (const rows of byLead.values()) {
    for (let i = 0; i < rows.length - 1; i++) {
      const stage = rows[i].toStage;
      const days = (new Date(rows[i + 1].changedAt).getTime() - new Date(rows[i].changedAt).getTime()) / 86400000;
      if (days < 0) continue;
      if (!durationsByStage.has(stage)) durationsByStage.set(stage, []);
      durationsByStage.get(stage)!.push(days);
    }
  }

  return [...durationsByStage.entries()]
    .map(([stage, days]) => ({
      stage,
      avgDays: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
      samples: days.length,
    }))
    .sort((a, b) => b.avgDays - a.avgDays);
}
