import { useRef, useState } from "react";
import { FileText, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadOfferPdf, removeOfferPdf, getOfferPdfSignedUrl } from "@/lib/leads-api";

interface OfferPdfCardProps {
  leadId: string;
  offerPdfPath: string | null;
  onChanged?: () => void;
}

export function OfferPdfCard({ leadId, offerPdfPath, onChanged }: OfferPdfCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = offerPdfPath ? offerPdfPath.split("/").pop() ?? "Offert.pdf" : null;

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      await uploadOfferPdf(leadId, file);
      onChanged?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Uppladdning misslyckades");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
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
            <Button size="sm" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Byt
            </Button>
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
        <Button size="sm" variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
          Ladda upp offert
        </Button>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
