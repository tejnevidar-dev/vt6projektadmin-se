import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useUserRoles } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  cancelWorkOrder,
  dispatchWorkOrderNow,
  getWorkOrderPdf,
  listWorkOrders,
  setWorkOrderPrice,
  type WorkOrderRow,
} from "@/lib/work-orders.functions";

export const Route = createFileRoute("/arbetsorder/")({
  component: () => (
    <RequireAuth>
      <WorkOrdersPage />
    </RequireAuth>
  ),
});

const STATUS: Record<string, string> = {
  draft: "Väntar på UE-pris",
  offered: "Skickad till UE",
  accepted: "Accepterad",
  unassigned: "Ingen UE tillgänglig",
  cancelled: "Avbruten",
};
const OFFER: Record<string, string> = {
  pending: "väntar på svar",
  accepted: "accepterade",
  declined: "avböjde",
  expired: "svarade inte i tid",
  cancelled: "avbruten",
};
const kr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
const time = (iso: string) => new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

function WorkOrdersPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const list = useServerFn(listWorkOrders);
  const setPrice = useServerFn(setWorkOrderPrice);
  const dispatch = useServerFn(dispatchWorkOrderNow);
  const cancel = useServerFn(cancelWorkOrder);
  const pdf = useServerFn(getWorkOrderPdf);
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [starts, setStarts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await list({ data: undefined as never }));
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte läsa arbetsordrar");
    } finally {
      setLoading(false);
    }
  }, [list]);
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Något gick fel");
    } finally {
      setBusy(null);
    }
  };

  const download = async (id: string) => {
    const r = await pdf({ data: { workOrderId: id } });
    const a = document.createElement("a");
    a.href = `data:application/pdf;base64,${r.base64}`;
    a.download = r.fileName;
    a.click();
  };

  return (
    <AppShell title="Arbetsorder" description="Skapas automatiskt när en offert signeras och skickas till godkänd UE.">
      {rolesLoading || loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : !isAdmin ? (
        <p className="text-sm text-muted-foreground">Bara admin.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga arbetsordrar än. De skapas när en kund signerar en offert.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((w) => {
            const editable = ["draft", "unassigned", "offered"].includes(w.status);
            return (
              <Card key={w.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {w.content.address}
                    <Badge variant={w.status === "accepted" ? "default" : w.status === "unassigned" ? "destructive" : "secondary"}>
                      {STATUS[w.status] ?? w.status}
                    </Badge>
                    <span className="text-xs font-normal text-muted-foreground">
                      {w.lead_name} · offert {w.content.offer_number ?? "–"} · {time(w.created_at)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="text-muted-foreground">
                    UE-pris: {w.ue_price != null ? <b className="text-foreground">{kr(Number(w.ue_price))}</b> : "ej satt"}
                    {w.start_date ? ` · start ${w.start_date}` : ""}
                  </div>
                  {w.offers.length > 0 && (
                    <ul className="list-inside list-disc text-xs text-muted-foreground">
                      {w.offers.map((o) => (
                        <li key={o.id}>
                          {o.company_name ?? "UE"}: {OFFER[o.status] ?? o.status}
                          {o.status === "pending" ? ` (svara senast ${time(o.expires_at)})` : ""}
                          {o.decline_reason ? ` – ${o.decline_reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editable && (
                    <div className="flex flex-wrap items-end gap-2">
                      <Input
                        className="w-36"
                        inputMode="decimal"
                        placeholder="UE-pris (kr)"
                        value={prices[w.id] ?? (w.ue_price != null ? String(w.ue_price) : "")}
                        onChange={(e) => setPrices({ ...prices, [w.id]: e.target.value })}
                      />
                      <Input
                        className="w-40"
                        type="date"
                        value={starts[w.id] ?? w.start_date ?? ""}
                        onChange={(e) => setStarts({ ...starts, [w.id]: e.target.value })}
                      />
                      <Button
                        size="sm"
                        disabled={busy === w.id}
                        onClick={() => {
                          const p = Number((prices[w.id] ?? String(w.ue_price ?? "")).replace(/\s/g, "").replace(",", "."));
                          void run(w.id, () => setPrice({ data: { id: w.id, price: p, startDate: starts[w.id] ?? w.start_date } }), "Sparat och skickat");
                        }}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> Spara & skicka till UE
                      </Button>
                      {(w.status === "unassigned" || w.status === "draft") && w.ue_price != null && (
                        <Button size="sm" variant="outline" disabled={busy === w.id} onClick={() => void run(w.id, () => dispatch({ data: { id: w.id } }), "Försökte skicka igen")}>
                          Försök igen
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => void download(w.id)}>
                      <FileDown className="mr-1 h-3.5 w-3.5" /> PDF
                    </Button>
                    {w.job_id && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/jobb/$jobId" params={{ jobId: w.job_id }}>Öppna jobbet</Link>
                      </Button>
                    )}
                    {w.status !== "accepted" && w.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" disabled={busy === w.id} onClick={() => void run(w.id, () => cancel({ data: { id: w.id } }), "Avbruten")}>
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Avbryt
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
