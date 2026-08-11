import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getSelfCheckDeliveries,
  sendSelfChecksToClient,
  type SelfCheck,
  type SelfCheckDelivery,
} from "@/lib/jobs-api";
import type { SelfCheckTemplate } from "@/lib/self-check-templates";

interface Props {
  jobId: string;
  checks: SelfCheck[];
  templates: SelfCheckTemplate[];
  /** Ändras när projektet laddas om, så att historiken hämtas på nytt. */
  refreshKey?: number | string;
}

type RowStatus = "not_started" | "draft" | "uploaded" | "sent" | "resent" | "failed";

const STATUS_META: Record<
  RowStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  not_started: {
    label: "Ej påbörjad",
    icon: Clock,
    className: "border-border bg-muted text-muted-foreground",
  },
  draft: {
    label: "Utkast",
    icon: Clock,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  uploaded: {
    label: "Uppladdad – ej skickad",
    icon: AlertTriangle,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  sent: {
    label: "Skickad",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  resent: {
    label: "Skickad om",
    icon: RotateCw,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Misslyckades",
    icon: XCircle,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

function fmt(ts: string | null | undefined): string {
  if (!ts) return "–";
  return new Date(ts).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SelfCheckStatusPanel({ jobId, checks, templates, refreshKey }: Props) {
  const [deliveries, setDeliveries] = useState<SelfCheckDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSelfCheckDeliveries(jobId)
      .then((d) => {
        if (cancelled) return;
        setDeliveries(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [jobId, refreshKey, reloadKey]);

  const handleResend = useCallback(
    async (templateKey: string, templateName: string) => {
      setResending(templateKey);
      try {
        const res = await sendSelfChecksToClient(jobId, [templateKey]);
        const attempt = res.attempts.find((a) => a.template_key === templateKey)?.attempt;
        toast.success(
          `${templateName} skickad till ${res.to}${attempt ? ` (försök ${attempt})` : ""}`,
          res.skippedImageCount
            ? { description: `${res.skippedImageCount} bild(er) kunde inte bifogas.` }
            : undefined,
        );
      } catch (e) {
        toast.error(`Kunde inte skicka om ${templateName}`, {
          description: (e as Error).message,
        });
      } finally {
        setResending(null);
        setReloadKey((k) => k + 1);
      }
    },
    [jobId],
  );

  const rows = templates.map((t) => {
    const tplChecks = checks.filter((c) => c.template_key === t.key);
    const submitted = tplChecks.filter((c) => c.completed_at);
    const latestCheck = [...tplChecks].sort((a, b) =>
      (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at),
    )[0];
    const tplDeliveries = deliveries.filter((d) => d.template_key === t.key);
    const latest = tplDeliveries[0] ?? null;

    let status: RowStatus;
    if (tplChecks.length === 0) status = "not_started";
    else if (submitted.length === 0) status = "draft";
    else if (!latest) status = "uploaded";
    else if (latest.status === "failed") status = "failed";
    else status = latest.attempt > 1 ? "resent" : "sent";

    return { template: t, latestCheck, latest, tplDeliveries, status, submitted: submitted.length };
  });

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <div className="text-sm font-medium">Status per egenkontroll</div>
          <p className="text-xs text-muted-foreground">
            Uppladdning och utskick till beställaren, med tidsstämplar och felorsaker.
          </p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Laddar...</span>}
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-destructive">
          Kunde inte hämta utskickshistorik: {error}
        </div>
      )}

      <div className="divide-y divide-border">
        {rows.map(({ template, latestCheck, latest, tplDeliveries, status, submitted }) => {
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          const attempts = tplDeliveries.length;
          return (
            <div key={template.key} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{template.name}</span>
                <Badge variant="outline" className={`gap-1 text-[11px] ${meta.className}`}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                  {status === "resent" && ` (försök ${latest?.attempt})`}
                </Badge>
                {!template.sentToClient && (
                  <span className="text-[11px] text-muted-foreground">
                    Skickas inte till beställaren
                  </span>
                )}
                {template.sentToClient && submitted > 0 && (
                  <Button
                    size="sm"
                    variant={status === "failed" ? "default" : "outline"}
                    className="ml-auto h-7 gap-1.5 text-xs"
                    disabled={resending !== null}
                    onClick={() => handleResend(template.key, template.name)}
                  >
                    {resending === template.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCw className="h-3 w-3" />
                    )}
                    {attempts > 0 ? `Skicka om (försök ${attempts + 1})` : "Skicka"}
                  </Button>
                )}
              </div>

              <div className="mt-1 grid gap-x-6 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
                <span>
                  Uppladdad:{" "}
                  <strong className="text-foreground">
                    {submitted > 0 ? fmt(latestCheck?.completed_at) : "–"}
                  </strong>
                  {submitted > 1 && ` (${submitted} inlämnade)`}
                </span>
                <span>
                  Senaste utskick:{" "}
                  <strong className="text-foreground">{fmt(latest?.created_at)}</strong>
                  {latest?.recipient_email ? ` till ${latest.recipient_email}` : ""}
                </span>
                <span>
                  Antal utskicksförsök: <strong className="text-foreground">{attempts}</strong>
                </span>
                {latest && (
                  <span>
                    Bilder i PDF:{" "}
                    <strong className="text-foreground">{latest.embedded_image_count}</strong>
                  </span>
                )}
              </div>

              {latest?.error_message && (
                <div className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
                  Felorsak: {latest.error_message}
                </div>
              )}

              {latest && latest.skipped_images.length > 0 && (
                <div className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
                  {latest.skipped_images.length} bild(er) kunde inte bifogas:
                  <ul className="mt-0.5 list-disc pl-4">
                    {latest.skipped_images.slice(0, 5).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {tplDeliveries.length > 1 && (
                <details className="mt-1.5 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer">Visa tidigare försök</summary>
                  <ul className="mt-1 space-y-0.5">
                    {tplDeliveries.slice(1).map((d) => (
                      <li key={d.id}>
                        Försök {d.attempt} – {d.status === "sent" ? "Skickad" : "Misslyckades"} –{" "}
                        {fmt(d.created_at)}
                        {d.error_message ? ` – ${d.error_message}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
