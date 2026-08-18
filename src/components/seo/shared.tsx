import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, type IssueSeverity } from "@/lib/seo/analysis";

export const nf = new Intl.NumberFormat("sv-SE");
export const pf = new Intl.NumberFormat("sv-SE", { style: "percent", maximumFractionDigits: 2 });
export const df = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

export function Delta({ current, previous, invert }: { current: number; previous?: number | null; invert?: boolean }) {
  if (previous == null || previous === 0) return <span className="text-xs text-muted-foreground">Ingen jämförelse</span>;
  const diff = ((current - previous) / previous) * 100;
  const good = invert ? diff < 0 : diff > 0;
  const Icon = Math.abs(diff) < 0.5 ? Minus : good ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${Math.abs(diff) < 0.5 ? "text-muted-foreground" : good ? "text-success" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {diff > 0 ? "+" : ""}
      {df.format(diff)} %
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  footer,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  footer?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4" title={hint}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}

const severityStyles: Record<IssueSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  low: "bg-muted text-muted-foreground border-border",
};

const severityLabels: Record<IssueSeverity, string> = {
  critical: "Kritisk",
  high: "Hög",
  medium: "Medel",
  low: "Låg",
};

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return <Badge variant="outline" className={severityStyles[severity]}>{severityLabels[severity]}</Badge>;
}

export function ScoreDot({ score }: { score: number }) {
  const color = score >= 75 ? "bg-destructive" : score >= 55 ? "bg-orange-500" : score >= 35 ? "bg-yellow-500" : "bg-muted-foreground";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="font-semibold tabular-nums">{score}</span>
    </span>
  );
}

export function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-success" : score >= 55 ? "bg-yellow-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{score}</span>
    </div>
  );
}

export function NotConnected({ title, detail, required }: { title: string; detail: string; required?: string[] }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5">
      <p className="text-sm font-semibold">Datakälla ej ansluten – {title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      {required?.length ? (
        <p className="mt-2 text-xs text-muted-foreground">Krävs: {required.join(", ")}</p>
      ) : null}
    </div>
  );
}

export function CsvButton({ filename, rows, label = "Exportera CSV" }: { filename: string; rows: Record<string, unknown>[]; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => downloadCsv(filename, rows)} disabled={!rows.length}>
      {label}
    </Button>
  );
}

export function Panel({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
