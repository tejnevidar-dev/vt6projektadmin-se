import { useEffect, useId, useState } from "react";
import { FolderUp, FileText, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchLeadDocuments,
  uploadLeadDocument,
  deleteLeadDocument,
  getLeadDocumentUrl,
  isInvoiceDocument,
  type LeadDocument,
} from "@/lib/lead-documents-api";

interface LeadDocumentsCardProps {
  leadId: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadDocumentsCard({ leadId }: LeadDocumentsCardProps) {
  const inputId = useId();
  const [docs, setDocs] = useState<LeadDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setDocs(await fetchLeadDocuments(leadId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await uploadLeadDocument(leadId, file);
      await load();
    } catch (err) {
      console.error("Upload failed", err);
      setError(err instanceof Error ? err.message : "Uppladdning misslyckades");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (doc: LeadDocument) => {
    try {
      const url = await getLeadDocumentUrl(doc.filePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      setError("Kunde inte öppna fil");
    }
  };

  const handleRemove = async (doc: LeadDocument) => {
    if (!confirm(`Ta bort ${doc.fileName}?`)) return;
    setBusy(true);
    try {
      await deleteLeadDocument(doc);
      await load();
    } catch (err) {
      console.error(err);
      setError("Kunde inte ta bort fil");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Ladda upp information {docs.length > 0 && `(${docs.length})`}
          </span>
        </div>
        <label
          htmlFor={inputId}
          className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {busy ? "Laddar..." : "Ladda upp"}
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
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Laddar...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga dokument uppladdade ännu.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-md bg-card px-2.5 py-1.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate" title={doc.fileName}>{doc.fileName}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString("sv-SE")} · {formatSize(doc.fileSize)}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleOpen(doc)} aria-label="Öppna">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleRemove(doc)}
                disabled={busy}
                aria-label="Ta bort"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
