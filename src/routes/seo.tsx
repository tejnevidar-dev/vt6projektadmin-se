import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRoles } from "@/hooks/use-role";
import { SEO_PERIODS, type SeoPeriodKey } from "@/lib/seo/analysis";
import type { OpportunityItem } from "@/lib/seo/types";
import {
  createSeoTask,
  deleteLocalTarget,
  deleteSeoTask,
  getSeoInsights,
  getSeoKeywords,
  getSeoMarket,
  getSeoOverviewV2,
  getSeoSources,
  getSeoTechnical,
  listLocalTargets,
  listSeoTasks,
  updateSeoTask,
  upsertLocalTarget,
} from "@/lib/seo-center.functions";
import { OverviewTab } from "@/components/seo/OverviewTab";
import { KeywordsTab } from "@/components/seo/KeywordsTab";
import { OpportunitiesTab } from "@/components/seo/OpportunitiesTab";
import { TechnicalTab } from "@/components/seo/TechnicalTab";
import { GrowthTab } from "@/components/seo/GrowthTab";
import { TasksTab } from "@/components/seo/TasksTab";
import { MarketTab } from "@/components/seo/MarketTab";
import { Panel } from "@/components/seo/shared";

export const Route = createFileRoute("/seo")({
  component: SeoPage,
  head: () => ({
    meta: [
      { title: "SEO Command Center – roslagstak.se | admin.vt6" },
      {
        name: "description",
        content:
          "Datadriven SEO-panel för roslagstak.se: Search Console-mått, sökordsintelligens, möjlighetsmotor, teknisk revision, lokal SEO och uppgiftshantering.",
      },
      { property: "og:title", content: "SEO Command Center – roslagstak.se | admin.vt6" },
      { property: "og:description", content: "Övervaka, analysera och förbättra webbplatsens organiska synlighet med riktig data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SeoPage() {
  return (
    <RequireAuth>
      <SeoGuard />
    </RequireAuth>
  );
}

function SeoGuard() {
  const { isAdmin, loading } = useUserRoles();
  if (loading)
    return (
      <AppShell title="SEO Command Center">
        <div className="mx-auto max-w-7xl rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Kontrollerar behörighet…
        </div>
      </AppShell>
    );
  if (!isAdmin)
    return (
      <AppShell title="SEO Command Center">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">Endast för administratörer</h2>
          <p className="mt-2 text-sm text-muted-foreground">Du saknar behörighet att se SEO-panelen.</p>
        </div>
      </AppShell>
    );
  return <SeoCenter />;
}

function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {(error as Error).message}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function SeoCenter() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<SeoPeriodKey>("28d");
  const [tab, setTab] = useState("overview");
  const [maxPages, setMaxPages] = useState(40);

  const fnSources = useServerFn(getSeoSources);
  const fnOverview = useServerFn(getSeoOverviewV2);
  const fnKeywords = useServerFn(getSeoKeywords);
  const fnTechnical = useServerFn(getSeoTechnical);
  const fnMarket = useServerFn(getSeoMarket);
  const fnInsights = useServerFn(getSeoInsights);
  const fnTargets = useServerFn(listLocalTargets);
  const fnTasks = useServerFn(listSeoTasks);
  const fnUpsertTarget = useServerFn(upsertLocalTarget);
  const fnDeleteTarget = useServerFn(deleteLocalTarget);
  const fnCreateTask = useServerFn(createSeoTask);
  const fnUpdateTask = useServerFn(updateSeoTask);
  const fnDeleteTask = useServerFn(deleteSeoTask);

  const sources = useQuery({ queryKey: ["seo-sources"], queryFn: () => fnSources({}), staleTime: 10 * 60_000, retry: false });
  const overview = useQuery({ queryKey: ["seo-overview", period], queryFn: () => fnOverview({ data: { period } }), staleTime: 10 * 60_000, retry: false });
  const keywords = useQuery({
    queryKey: ["seo-keywords", period],
    queryFn: () => fnKeywords({ data: { period } }),
    enabled: tab === "keywords",
    staleTime: 10 * 60_000,
    retry: false,
  });
  const technical = useQuery({
    queryKey: ["seo-technical", maxPages],
    queryFn: () => fnTechnical({ data: { maxPages } }),
    enabled: tab === "technical",
    staleTime: 30 * 60_000,
    retry: false,
  });
  const insights = useQuery({
    queryKey: ["seo-insights", period],
    queryFn: () => fnInsights({ data: { period } }),
    enabled: tab === "opportunities" || tab === "growth",
    staleTime: 10 * 60_000,
    retry: false,
  });
  const market = useQuery({
    queryKey: ["seo-market", period],
    queryFn: () => fnMarket({ data: { period, database: "se" } }),
    enabled: tab === "market",
    staleTime: 60 * 60_000,
    retry: false,
  });
  const targets = useQuery({ queryKey: ["seo-targets"], queryFn: () => fnTargets({}), enabled: tab === "growth", retry: false });
  const tasks = useQuery({ queryKey: ["seo-tasks"], queryFn: () => fnTasks({}), enabled: tab === "tasks", retry: false });

  const invalidate = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const taskMutation = useMutation({
    mutationFn: (o: OpportunityItem) =>
      fnCreateTask({
        data: {
          title: o.title,
          category: o.category,
          priority: o.priority,
          impact: o.impact,
          difficulty: o.difficulty,
          opportunity_score: o.score,
          affected_url: o.url,
          target_keyword: o.keywords[0] ?? null,
          problem: o.why,
          recommendation: o.action,
          source: "engine",
          source_key: o.id,
        },
      }),
    onSuccess: () => {
      toast.success("Uppgift skapad");
      invalidate(["seo-tasks"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const manualTask = useMutation({
    mutationFn: (title: string) => fnCreateTask({ data: { title, category: "Manuell", source: "manual" } }),
    onSuccess: () => invalidate(["seo-tasks"]),
    onError: (e: Error) => toast.error(e.message),
  });

  const patchTask = useMutation({
    mutationFn: (v: { id: string; status: string }) => fnUpdateTask({ data: v }),
    onSuccess: () => invalidate(["seo-tasks"]),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => fnDeleteTask({ data: { id } }),
    onSuccess: () => invalidate(["seo-tasks"]),
    onError: (e: Error) => toast.error(e.message),
  });

  const addTarget = useMutation({
    mutationFn: (v: { service: string; locality: string; landing_url: string | null }) => fnUpsertTarget({ data: v }),
    onSuccess: () => {
      toast.success("Lokalt mål tillagt");
      invalidate(["seo-targets", "seo-insights"]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTarget = useMutation({
    mutationFn: (id: string) => fnDeleteTarget({ data: { id } }),
    onSuccess: () => invalidate(["seo-targets", "seo-insights"]),
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshing = overview.isFetching || keywords.isFetching || insights.isFetching || technical.isFetching;

  return (
    <AppShell
      title="SEO Command Center"
      description={overview.data ? `${overview.data.siteUrl} · ${overview.data.rangeStart} – ${overview.data.rangeEnd}` : "Google Search Console"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            {SEO_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${period === p.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => invalidate(["seo-overview", "seo-keywords", "seo-insights", "seo-technical", "seo-sources"])}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Uppdatera
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap gap-2">
          {(sources.data ?? []).map((s) => (
            <Badge
              key={s.id}
              variant="outline"
              title={`${s.detail}${s.required.length ? ` · Krävs: ${s.required.join(", ")}` : ""}`}
              className={s.connected ? "border-success/40 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground"}
            >
              <Database className="mr-1 h-3 w-3" />
              {s.name}: {s.connected ? "ansluten" : "ej ansluten"}
            </Badge>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="overview">Översikt</TabsTrigger>
            <TabsTrigger value="keywords">Sökord</TabsTrigger>
            <TabsTrigger value="opportunities">Möjligheter</TabsTrigger>
            <TabsTrigger value="technical">Teknisk SEO</TabsTrigger>
            <TabsTrigger value="market">Marknad & länkar</TabsTrigger>
            <TabsTrigger value="growth">Lokalt & innehåll</TabsTrigger>
            <TabsTrigger value="tasks">Uppgifter</TabsTrigger>
            <TabsTrigger value="sources">Datakällor</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-4">
            <ErrorBox error={overview.error} />
            {overview.isLoading && <Loading label="Hämtar Search Console-data…" />}
            {overview.data && <OverviewTab data={overview.data} />}
          </TabsContent>

          <TabsContent value="keywords" className="mt-6 space-y-4">
            <ErrorBox error={keywords.error} />
            {keywords.isLoading && <Loading label="Analyserar sökord…" />}
            {keywords.data && <KeywordsTab data={keywords.data} />}
          </TabsContent>

          <TabsContent value="opportunities" className="mt-6 space-y-4">
            <ErrorBox error={insights.error} />
            {insights.isLoading && <Loading label="Beräknar möjligheter…" />}
            {insights.data && (
              <OpportunitiesTab items={insights.data.opportunities} onCreateTask={(o) => taskMutation.mutate(o)} creating={taskMutation.isPending} />
            )}
          </TabsContent>

          <TabsContent value="technical" className="mt-6 space-y-4">
            <ErrorBox error={technical.error} />
            {technical.isLoading && <Loading label="Crawlar webbplatsen…" />}
            {technical.data && (
              <TechnicalTab
                data={technical.data}
                crawling={technical.isFetching}
                onRecrawl={(n) => {
                  setMaxPages(n);
                  qc.invalidateQueries({ queryKey: ["seo-technical"] });
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="market" className="mt-6 space-y-4">
            <ErrorBox error={market.error} />
            {market.isLoading && <Loading label="Hämtar Semrush-data…" />}
            {market.data && <MarketTab data={market.data} />}
          </TabsContent>

          <TabsContent value="growth" className="mt-6 space-y-4">
            <ErrorBox error={insights.error} />
            {insights.isLoading && <Loading label="Analyserar lokal SEO och innehåll…" />}
            {insights.data && (
              <GrowthTab
                local={insights.data.local}
                gaps={insights.data.gaps}
                links={insights.data.links}
                targets={(targets.data ?? []) as any[]}
                busy={addTarget.isPending || removeTarget.isPending}
                onAddTarget={(service, locality, landing) => addTarget.mutate({ service, locality, landing_url: landing || null })}
                onDeleteTarget={(id) => removeTarget.mutate(id)}
              />
            )}
          </TabsContent>

          <TabsContent value="tasks" className="mt-6 space-y-4">
            <ErrorBox error={tasks.error} />
            {tasks.isLoading && <Loading label="Hämtar uppgifter…" />}
            {tasks.data && (
              <TasksTab
                tasks={tasks.data}
                busy={patchTask.isPending || removeTask.isPending || manualTask.isPending}
                onCreate={(title) => manualTask.mutate(title)}
                onUpdate={(id, status) => patchTask.mutate({ id, status })}
                onDelete={(id) => removeTask.mutate(id)}
              />
            )}
          </TabsContent>

          <TabsContent value="sources" className="mt-6 space-y-4">
            <Panel title="Datakällor" description="Panelen visar aldrig uppskattade eller påhittade siffror – saknas en källa markeras den som ej ansluten.">
              <ul className="space-y-3">
                {(sources.data ?? []).map((s) => (
                  <li key={s.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      <Badge variant="outline" className={s.connected ? "border-success/40 bg-success/10 text-success" : ""}>
                        {s.connected ? "Ansluten" : "Datakälla ej ansluten"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                    {s.required.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Krävs: {s.required.join(", ")}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
