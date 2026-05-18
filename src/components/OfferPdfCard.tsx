import { useId, useState } from "react";
import { FileText, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadOfferPdf, removeOfferPdf, getOfferPdfSignedUrl } from "@/lib/leads-api";

interface OfferPdfCardProps {
  leadId: string;
  offerPdfPath: string | null;
  onChanged?: () => void;
}

export function OfferPdfCard({ leadId, offerPdfPath, onChanged }: OfferPdfCardProps) {
  const inputId = useId();
  const replaceInputId = `${inputId}-replace`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = offerPdfPath ? offerPdfPath.split("/").pop() ?? "Offert.pdf" : null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) throw new Error("Endast PDF-filer kan laddas upp.");
      await uploadOfferPdf(leadId, file);
      onChanged?.();
    } catch (err) {
      console.error("Offer upload failed", err);
      setError(err instanceof Error ? err.message : "Uppladdning misslyckades");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    if (!offerPdfPath) return;
    setBusy(true);
    try {
      const url = await getOfferPdfSignedUrl(offerPdfPath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      setError("Kunde inte öppna PDF");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!offerPdfPath) return;
    if (!confirm("Ta bort offert-PDF?")) return;
    setBusy(true);
    try {
      await removeOfferPdf(leadId, offerPdfPath);
      onChanged?.();
    } catch (err) {
      console.error(err);
      setError("Kunde inte ta bort PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Offert (PDF)</span>
      </div>

      {offerPdfPath ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate" title={fileName ?? ""}>{fileName}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={handleOpen} disabled={busy}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Öppna
            </Button>
            <label
              htmlFor={replaceInputId}
              className="flex-1 inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              Byt
            </label>
            <input
              id={replaceInputId}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleRemove}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <label
            htmlFor={inputId}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground ${busy ? "pointer-events-none opacity-50" : ""}`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ? "Laddar upp..." : "Ladda upp offert"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
