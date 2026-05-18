import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./activities-api";

const BUCKET = "lead-documents";

export interface LeadDocument {
  id: string;
  leadId: string;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export async function fetchLeadDocuments(leadId: string): Promise<LeadDocument[]> {
  const { data, error } = await supabase
    .from("lead_documents" as any)
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    leadId: d.lead_id,
    filePath: d.file_path,
    fileName: d.file_name,
    mimeType: d.mime_type,
    fileSize: d.file_size,
    uploadedBy: d.uploaded_by,
    createdAt: d.created_at,
  }));
}

export async function uploadLeadDocument(leadId: string, file: File): Promise<LeadDocument> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${leadId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await (supabase.from("lead_documents" as any) as any)
    .insert({
      lead_id: leadId,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: userData?.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  await logActivity(leadId, "updated", `Dokument uppladdat (${file.name})`, { file_path: path });
  const d: any = data;
  return {
    id: d.id,
    leadId: d.lead_id,
    filePath: d.file_path,
    fileName: d.file_name,
    mimeType: d.mime_type,
    fileSize: d.file_size,
    uploadedBy: d.uploaded_by,
    createdAt: d.created_at,
  };
}

export async function deleteLeadDocument(doc: LeadDocument): Promise<void> {
  await supabase.storage.from(BUCKET).remove([doc.filePath]);
  const { error } = await supabase.from("lead_documents" as any).delete().eq("id", doc.id);
  if (error) throw error;
  await logActivity(doc.leadId, "updated", `Dokument borttaget (${doc.fileName})`);
}

export async function getLeadDocumentUrl(path: string, expiresIn = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
