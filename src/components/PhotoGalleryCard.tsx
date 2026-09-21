import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteJobPhoto,
  getJobPhotoUrl,
  getOrCreateShareLink,
  listJobPhotos,
  shareLinkUrl,
  uploadJobPhoto,
  type JobPhoto,
  type PhotoPhase,
} from "@/lib/job-photos-api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Upload, Link as LinkIcon, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  canManage: boolean;
}

export function PhotoGalleryCard({ jobId, canManage }: Props) {
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<PhotoPhase | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<JobPhoto | null>(null);
  const foreInput = useRef<HTMLInputElement>(null);
  const efterInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await listJobPhotos(jobId);
      setPhotos(list);
      const entries = await Promise.all(
        list.map(async (p) => [p.id, await getJobPhotoUrl(p.storage_path)] as const),
      );
      setUrls(Object.fromEntries(entries));
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda bilder");
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(files: FileList | null, phase: PhotoPhase) {
    if (!files || files.length === 0) return;
    setUploading(phase);
    try {
      for (const file of Array.from(files)) {
        await uploadJobPhoto(jobId, file, phase);
      }
      toast.success("Bild(er) uppladdade");
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ladda upp bild");
    } finally {
      setUploading(null);
    }
  }

  async function confirmDelete() {
    const photo = photoToDelete;
    setPhotoToDelete(null);
    if (!photo) return;
    try {
      await deleteJobPhoto(photo);
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte ta bort bilden");
    }
  }

  async function handleShare() {
    try {
      const token = await getOrCreateShareLink(jobId);
      const url = shareLinkUrl(token);
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success("Länk kopierad till urklipp");
    } catch (e: any) {
      toast.error(e.message ?? "Kunde inte skapa delningslänk");
    }
  }

  const fore = photos.filter((p) => p.phase === "fore");
  const efter = photos.filter((p) => p.phase === "efter");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Före/efter-bilder som kan delas med kunden via en publik länk.
        </p>
        {canManage && (
          <Button size="sm" variant="outline" onClick={handleShare}>
            <LinkIcon className="mr-1.5 h-3.5 w-3.5" /> Skapa/kopiera delningslänk
          </Button>
        )}
      </div>

      {shareUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
          <span className="truncate">{shareUrl}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast.success("Kopierad");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <PhotoSection
        title="Före"
        photos={fore}
        urls={urls}
        canManage={canManage}
        uploading={uploading === "fore"}
        onUploadClick={() => foreInput.current?.click()}
        onDelete={setPhotoToDelete}
      />
      <input
        ref={foreInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files, "fore")}
      />

      <PhotoSection
        title="Efter"
        photos={efter}
        urls={urls}
        canManage={canManage}
        uploading={uploading === "efter"}
        onUploadClick={() => efterInput.current?.click()}
        onDelete={setPhotoToDelete}
      />
      <input
        ref={efterInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files, "efter")}
      />

      <AlertDialog open={!!photoToDelete} onOpenChange={(o) => !o && setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort bilden?</AlertDialogTitle>
            <AlertDialogDescription>Bilden tas bort permanent och försvinner även från kundens delade länk.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PhotoSection({
  title,
  photos,
  urls,
  canManage,
  uploading,
  onUploadClick,
  onDelete,
}: {
  title: string;
  photos: JobPhoto[];
  urls: Record<string, string>;
  canManage: boolean;
  uploading: boolean;
  onUploadClick: () => void;
  onDelete: (photo: JobPhoto) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        {canManage && (
          <Button size="sm" variant="outline" disabled={uploading} onClick={onUploadClick}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> {uploading ? "Laddar upp…" : "Lägg till"}
          </Button>
        )}
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga bilder ännu.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-md border border-border bg-muted/30">
              {urls[p.id] ? (
                <img src={urls[p.id]} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              ) : (
                <div className="aspect-square w-full animate-pulse bg-muted" />
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1.5 text-destructive shadow-sm transition hover:bg-background"
                  title="Ta bort"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
