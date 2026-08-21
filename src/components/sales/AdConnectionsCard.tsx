import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plug, RefreshCw, Trash2, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdConnectionStatus, syncAdSpend } from "@/lib/ads.functions";
import {
  deleteAdSourceRule,
  fetchAdSourceRules,
  fetchAdSyncRuns,
  upsertAdSourceRule,
  type AdProvider,
} from "@/lib/ads-api";

const PROVIDER_LABEL: Record<AdProvider, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
};

const SOURCE_OPTIONS = [
  { value: "roslagstak", label: "Webb (roslagstak)" },
  { value: "field", label: "Fältsälj" },
  { value: "telemarketing", label: "Telemarketing" },
  { value: "scan", label: "Byggnadsscanning" },
  { value: "referral", label: "Referens" },
  { value: "csv_import", label: "CSV-import" },
];

export function AdConnectionsCard({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getAdConnectionStatus);
  const syncFn = useServerFn(syncAdSpend);

  const status = useQuery({
    queryKey: ["ad-connection-status"],
    queryFn: () => statusFn(),
    enabled: isAdmin,
  });
  const runs = useQuery({ queryKey: ["ad-sync-runs"], queryFn: fetchAdSyncRuns });
  const rules = useQuery({ queryKey: ["ad-source-rules"], queryFn: fetchAdSourceRules });

  const [newRule, setNewRule] = useState<{ provider: AdProvider; pattern: string; source: string }>({
    provider: "google_ads",
    pattern: "",
    source: "roslagstak",
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: { days: 90 } }),
    onSuccess: (res) => {
      const ok = res.filter((r) => r.status === "ok");
      const failed = res.filter((r) => r.status === "error");
      const missing = res.filter((r) => r.status === "not_configured");
      if (ok.length) toast.success(`Hämtade ${ok.reduce((s, r) => s + r.rows, 0)} rader annonskostnad`);
      failed.forEach((r) => toast.error(`${PROVIDER_LABEL[r.provider]}: ${r.error}`));
      if (missing.length && !ok.length)
        toast.info(`Saknar uppgifter för ${missing.map((m) => PROVIDER_LABEL[m.provider]).join(", ")}`);
      qc.invalidateQueries({ queryKey: ["ad-spend"] });
      qc.invalidateQueries({ queryKey: ["ad-sync-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRule = useMutation({
    mutationFn: () =>
      upsertAdSourceRule({
        provider: newRule.provider,
        campaignPattern: newRule.pattern.trim() || null,
        leadSource: newRule.source,
      }),
    onSuccess: () => {
      setNewRule({ ...newRule, pattern: "" });
      qc.invalidateQueries({ queryKey: ["ad-source-rules"] });
      toast.success("Mappning sparad");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRule = useMutation({
    mutationFn: (id: string) => deleteAdSourceRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-source-rules"] }),
  });

  if (!isAdmin) return null;

  const connected = status.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4 text-primary" /> Annonskopplingar
        </CardTitle>
        <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
          Hämta annonskostnad
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["google_ads", "meta_ads"] as AdProvider[]).map((p) => {
            const ok = connected?.[p];
            return (
              <div key={p} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{PROVIDER_LABEL[p]}</p>
                  <p className="text-xs text-muted-foreground">
                    {ok ? "Uppgifter finns – kostnad hämtas automatiskt" : "Uppgifter saknas"}
                  </p>
                </div>
                <Badge variant={ok ? "default" : "outline"} className="gap-1">
                  {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {ok ? "Kopplad" : "Ej kopplad"}
                </Badge>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Mappning kampanj → leadkälla
          </Label>
          <div className="space-y-2">
            {(rules.data ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{PROVIDER_LABEL[r.provider]}</span>
                <span className="text-muted-foreground">
                  {r.campaignPattern ? `kampanj innehåller "${r.campaignPattern}"` : "alla kampanjer"}
                </span>
                <span className="ml-auto">
                  → {SOURCE_OPTIONS.find((s) => s.value === r.leadSource)?.label ?? r.leadSource}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeRule.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(rules.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Ingen mappning – all annonskostnad räknas mot Webb (roslagstak).
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Select
              value={newRule.provider}
              onValueChange={(v) => setNewRule({ ...newRule, provider: v as AdProvider })}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-9 w-48"
              placeholder="Kampanjnamn innehåller…"
              value={newRule.pattern}
              onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
            />
            <Select value={newRule.source} onValueChange={(v) => setNewRule({ ...newRule, source: v })}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => saveRule.mutate()} disabled={saveRule.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Lägg till
            </Button>
          </div>
        </div>

        {(runs.data ?? []).length > 0 && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="uppercase tracking-wide">Senaste hämtningar</p>
            {(runs.data ?? []).slice(0, 4).map((r) => (
              <p key={r.id}>
                {new Date(r.createdAt).toLocaleString("sv-SE")} · {PROVIDER_LABEL[r.provider]} ·{" "}
                {r.status === "ok" ? `${r.rowsUpserted} rader` : `fel: ${r.errorMessage}`}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
