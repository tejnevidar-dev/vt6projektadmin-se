import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/image-prepare";

// `job_photos`/`job_photo_share_links` aren't in the generated types yet (added in
// migration 20260918100000_job_photo_gallery.sql) -- same as-any pattern as
// notifications-api.ts/atas-api.ts.
const db = supabase as any;

export type PhotoPhase = "fore" | "efter";

export interface JobPhoto {
  id: string;
  job_id: string;
  storage_path: string;
  phase: PhotoPhase;
  caption: string | null;
  uploaded_by: string | null;
  sort_order: number;
  created_at: string;
}

const BUCKET = "self-check-images";

export async function uploadJobPhoto(jobId: string, file: File, phase: PhotoPhase): Promise<JobPhoto> {
  const prepared = await prepareImageForUpload(file);
  const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${jobId}/gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await db
    .from("job_photos")
    .insert({
      job_id: jobId,
      storage_path: path,
      phase,
      uploaded_by: userData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as JobPhoto;
}

export async function listJobPhotos(jobId: string): Promise<JobPhoto[]> {
  const { data, error } = await db
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId)
    .order("phase", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as JobPhoto[];
}

export async function getJobPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteJobPhoto(photo: JobPhoto): Promise<void> {
  await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  const { error } = await db.from("job_photos").delete().eq("id", photo.id);
  if (error) throw error;
}

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** En delbar länk per jobb -- återanvänds om den redan finns. */
export async function getOrCreateShareLink(jobId: string): Promise<string> {
  const { data: existing } = await db
    .from("job_photo_share_links")
    .select("token")
    .eq("job_id", jobId)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const { data: userData } = await supabase.auth.getUser();
  const token = randomToken();
  const { data, error } = await db
    .from("job_photo_share_links")
    .insert({ job_id: jobId, token, created_by: userData.user?.id ?? null })
    .select("token")
    .single();
  if (error) throw error;
  return data.token as string;
}

export function shareLinkUrl(token: string): string {
  return `${window.location.origin}/foto/${token}`;
}
