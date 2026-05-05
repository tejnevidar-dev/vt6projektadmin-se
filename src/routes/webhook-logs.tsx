import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type WebhookLog = {
  id: string;
  source: string;
  status_code: number;
  status: string;
  error_message: string | null;
  payload: unknown;
  headers: unknown;
  lead_id: string | null;
  created_at: string;
};

const PAGE_SIZE = 25;

export const Route = createFileRoute("/webhook-logs")({
  validateSearch: (search: Record<string, unknown>) => {
    const p = Number(search.page);
    return { page: Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1 };
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: WebhookLogsPage,
});

function WebhookLogsPage() {
  const { page } = Route.useSearch();
  const navigate = useNavigate({ from: "/webhook-logs" });
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from("webhook_logs" as never)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (!error && data) {
      setLogs(data as unknown as WebhookLog[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goTo = (p: number) => navigate({ search: { page: Math.min(Math.max(1, p), totalPages) } });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Webhook-loggar</h1>
            <p className="text-sm text-muted-foreground">
              Inkommande anrop till /api/public/roslagstak-webhook · {total} totalt
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}>Uppdatera</Button>
            <Link to="/"><Button variant="ghost">Tillbaka</Button></Link>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Laddar...</div>
        ) : logs.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            Inga loggar än. När RoslagsTak skickar en webhook visas den här.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {logs.map((log) => {
                const ok = log.status_code >= 200 && log.status_code < 300;
                const isOpen = openId === log.id;
                return (
                  <div key={log.id} className="rounded-md border bg-card">
                    <button
                      onClick={() => setOpenId(isOpen ? null : log.id)}
                      className="flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={ok ? "default" : "destructive"}>{log.status_code}</Badge>
                        <span className="font-medium">{log.status}</span>
                        {log.error_message && (
                          <span className="text-sm text-destructive truncate max-w-md">{log.error_message}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("sv-SE")}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t p-3 space-y-3">
                        {log.lead_id && (
                          <div className="text-sm"><span className="text-muted-foreground">Lead-ID:</span> {log.lead_id}</div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">Payload</div>
                          <pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(log.payload, null, 2)}</pre>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">Headers</div>
                          <pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(log.headers, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                Sida {page} av {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => goTo(1)} disabled={page <= 1}>« Första</Button>
                <Button variant="outline" size="sm" onClick={() => goTo(page - 1)} disabled={page <= 1}>Föregående</Button>
                <Button variant="outline" size="sm" onClick={() => goTo(page + 1)} disabled={page >= totalPages}>Nästa</Button>
                <Button variant="outline" size="sm" onClick={() => goTo(totalPages)} disabled={page >= totalPages}>Sista »</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
