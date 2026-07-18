import { supabase } from "@/integrations/supabase/client";

export interface OfferDraftRow {
  id: string;
  created_by: string;
  lead_id: string | null;
  kind: string;
  label: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

export async function listMyDrafts(): Promise<OfferDraftRow[]> {
  const { data, error } = await supabase
    .from("offer_drafts" as any)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as OfferDraftRow[];
}

export async function createDraft(input: {
  label: string;
  payload: unknown;
  leadId?: string | null;
  kind?: string;
}): Promise<OfferDraftRow> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Ej inloggad");
  const { data, error } = await supabase
    .from("offer_drafts" as any)
    .insert({
      created_by: uid,
      label: input.label,
      payload: input.payload as any,
      lead_id: input.leadId ?? null,
      kind: input.kind ?? "combined",
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as OfferDraftRow;
}

export async function updateDraft(
  id: string,
  patch: { label?: string; payload?: unknown; leadId?: string | null },
): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.label !== undefined) upd.label = patch.label;
  if (patch.payload !== undefined) upd.payload = patch.payload;
  if (patch.leadId !== undefined) upd.lead_id = patch.leadId;
  const { error } = await supabase.from("offer_drafts" as any).update(upd).eq("id", id);
  if (error) throw error;
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabase.from("offer_drafts" as any).delete().eq("id", id);
  if (error) throw error;
}
