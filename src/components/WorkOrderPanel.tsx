import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Sparkles, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  uploadWorkOrder,
  processWorkOrder,
  getWorkOrderSignedUrl,
  deleteWorkOrder,
  type JobWithLead,
} from "@/lib/jobs-api";

export function WorkOrderPanel({
  job,
  canManage,
  onChanged,
}: {
  job: JobWithLead;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function handleFile(file: File) {
    if (file.type && file.type !== "application/pdf") {
      toast.error("Endast PDF-filer stöds");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Filen är för stor (max 15 MB)");
      return;
    }
    setUploading(true);
    try {
      await uploadWorkOrder(job.id, file);
      toast.success("Arbetsorder uppladdad – AI tolkar nu...");
      await onChanged();
      setProcessing(true);
      try {
        await processWorkOrder(job.id);
        toast.success("AI-sammanfattning klar");
      } catch (e: any) {
        toast.error(e.message ?? "AI kunde inte tolka arbetsordern");
      } finally {
        setProcessing(false);
        await onChanged();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Uppladdning misslyckades");
    } finally {
      setUploading(false);
    }
  }

  async function handleReprocess() {
    setProcessing(true);
    try {
      await processWorkOrder(job.id);
      toast.success("AI-sammanfattning uppdaterad");
      await onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleOpenPdf() {
    if (!job.work_order_pdf_path) return;
    try {
      const url = await getWorkOrderSignedUrl(job.work_order_pdf_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete() {
    if (!job.work_order_pdf_path) return;
    if (!confirm("Ta bort arbetsorder och AI-sammanfattning?")) return;
    try {
      await deleteWorkOrder(job.id, job.work_order_pdf_path);
      toast.success("Borttagen");
      await onChanged();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            {job.work_order_pdf_path ? (
              <>
                <div className="text-sm font-medium truncate">Arbetsorder uppladdad</div>
                {job.work_order_processed_at && (
                  <div className="text-xs text-muted-foreground">
                    AI-tolkad {new Date(job.work_order_processed_at).toLocaleString("sv-SE")}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Ingen arbetsorder uppladdad ännu</div>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {job.work_order_pdf_path && canManage && (
            <Button size="sm" variant="outline" onClick={handleOpenPdf}>
              <ExternalLink className="mr-1.5 h-4 w-4" /> Öppna PDF
            </Button>
          )}
          {canManage && (
            <>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploading || processing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
                <Button asChild size="sm" disabled={uploading || processing}>
                  <span>
                    <Upload className="mr-1.5 h-4 w-4" />
                    {uploading ? "Laddar upp..." : job.work_order_pdf_path ? "Ersätt" : "Ladda upp PDF"}
                  </span>
                </Button>
              </label>
              {job.work_order_pdf_path && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReprocess}
                  disabled={processing || uploading}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {processing ? "Tolkar..." : "Tolka igen"}
                </Button>
              )}
              {job.work_order_pdf_path && (
                <Button size="icon" variant="ghost" onClick={handleDelete} disabled={processing || uploading}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {(processing || uploading) && !job.work_order_summary && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 animate-pulse text-primary" />
          <p className="text-sm font-medium">AI tolkar arbetsordern...</p>
          <p className="mt-1 text-xs text-muted-foreground">Detta tar oftast 5–20 sekunder.</p>
        </div>
      )}

      {job.work_order_summary ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> AI-tolkad arbetsorder
          </div>
          <article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {job.work_order_summary}
          </article>
        </div>
      ) : (
        !uploading &&
        !processing && (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Ingen AI-sammanfattning än</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canManage
                ? "Ladda upp en PDF-arbetsorder så tolkar AI vad som ska göras på plats."
                : "Admin har inte laddat upp en arbetsorder för detta projekt än."}
            </p>
          </div>
        )
      )}
    </div>
  );
}
