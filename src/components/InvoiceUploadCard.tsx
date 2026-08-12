import { useCallback, useEffect, useId, useState } from "react";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  fetchLeadDocuments,
  uploadLeadDocument,
  deleteLeadDocument,
  getLeadDocumentUrl,
  isInvoiceDocument,
  INVOICE_FOLDER,
  type LeadDocument,
} from "@/lib/lead-documents-api";

interface Props {
  leadId: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ladda upp och hantera kundens faktura-PDF. */
export function InvoiceUploadCard({ leadId }: Props) {
  const inputId = useId();
  const [docs, setDocs] = useState<LeadDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchLeadDocuments(leadId);
      setDocs(all.filter(isInvoiceDocument));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await uploadLeadDocument(leadId, file, INVOICE_FOLDER);
      toast.success("Fakturan uppladdad");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Uppladdning misslyckades");
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
      toast.error("Kunde inte öppna fakturan");
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
      toast.error("Kunde inte ta bort fakturan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Faktura {docs.length > 0 && `(${docs.length})`}
        </span>
        <label
          htmlFor={inputId}
          className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {busy ? "Laddar…" : "Ladda upp faktura"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/pdf,.pdf,image/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Laddar…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ingen faktura uppladdad ännu.</p>
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
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleOpen(doc)} aria-label="Öppna faktura">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleRemove(doc)}
                disabled={busy}
                aria-label="Ta bort faktura"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
