import { useState, useRef } from "react";
import { X, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importCsv, type CsvRow } from "@/lib/leads-api";

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  return lines.slice(1).map((line) => {
    const values = line.split(";").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row as unknown as CsvRow;
  });
}

export function CsvImportDialog({ open, onClose, onImported }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    const text = await f.text();
    const rows = parseCsv(text);
    setPreview(rows.slice(0, 5));
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const count = await importCsv(rows);
      setResult(`${count} av ${rows.length} rader importerade!`);
      onImported();
    } catch {
      setResult("Fel vid import. Kontrollera CSV-formatet.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-card-foreground">Importera fastighetsdata (CSV)</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-muted p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Förväntat CSV-format (semikolon-separerat)
          </div>
          <code className="block text-xs text-card-foreground">
            name;phone;address;municipality;region;build_year;roof_type;age
          </code>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <>
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-card-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{preview.length}+ rader hittade</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Klicka för att välja CSV-fil</p>
            </>
          )}
        </div>

        {preview.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Namn</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Telefon</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Adress</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Kommun</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Byggnadsår</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-2 py-1.5 text-card-foreground">{row.name}</td>
                    <td className="px-2 py-1.5 text-card-foreground">{row.phone}</td>
                    <td className="px-2 py-1.5 text-card-foreground">{row.address}</td>
                    <td className="px-2 py-1.5 text-card-foreground">{row.municipality}</td>
                    <td className="px-2 py-1.5 text-card-foreground">{row.build_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <div className="mt-3 rounded-lg bg-muted p-3 text-sm text-card-foreground">{result}</div>
        )}

        <div className="mt-5 flex gap-3">
          <Button onClick={handleImport} disabled={!file || importing} className="flex-1">
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importerar..." : "Importera"}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Stäng
          </Button>
        </div>
      </div>
    </div>
  );
}
