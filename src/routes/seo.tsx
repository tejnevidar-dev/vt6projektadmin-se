import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MousePointerClick, Eye, Percent, Gauge, RefreshCw, Search, FileText, ShieldCheck } from "lucide-react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSeoOverview, type SeoRow, type SeoWeek } from "@/lib/seo.functions";

export const Route = createFileRoute("/seo")({
  component: SeoPage,
  head: () => ({
    meta: [
      { title: "SEO – roslagstak.se | admin.vt6" },
      { name: "description", content: "Search Console-mått för roslagstak.se: klick, visningar, CTR, snittposition, indexering, toppsökningar och toppsidor per vecka." },
      { property: "og:title", content: "SEO – roslagstak.se | admin.vt6" },
      { property: "og:description", content: "Veckovis SEO-översikt från Google Search Console för roslagstak.se." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const nf = new Intl.NumberFormat("sv-SE");
const pf = new Intl.NumberFormat("sv-SE", { style: "percent", maximumFractionDigits: 2 });
const df = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

function fmtWeek(w: SeoWeek) {
  const d = new Date(`${w.weekStart}T00:00:00Z`);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" });
}

function Delta({ current, previous, invert }: { current: number; previous: number | null | undefined; invert?: boolean }) {
  if (previous == null || previous === 0) return null;
  const diff = ((current - previous) / previous) * 100;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`text-xs font-medium ${good ? "text-success" : "text-destructive"}`}>
      {diff > 0 ? "+" : ""}
      {df.format(diff)} %
    </span>
  );
}

function SeoPage() {
  return (
    <RequireAuth>
      <SeoGuard />
    </RequireAuth>
  );
}

function SeoGuard() {
  const { isAdmin, loading } = useUserRoles();
  if (loading) {
    return (
      <AppShell title="SEO – roslagstak.se">
        <div className="mx-auto max-w-7xl rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Kontrollerar behörighet…
        </div>
      </AppShell>
    );
  }
  if (!isAdmin) {
    return (
      <AppShell title="SEO – roslagstak.se">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">Endast för administratörer</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Du saknar behörighet att se SEO-panelen.
          </p>
        </div>
      </AppShell>
    );
  }
  return <SeoContent />;
}

function SeoContent() {
  const fetchOverview = useServerFn(getSeoOverview);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["seo-overview", 12],
    queryFn: () => fetchOverview({ data: { weeks: 12 } }),
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  const maxClicks = Math.max(1, ...(data?.weeks ?? []).map((w) => w.clicks));
  const maxImpr = Math.max(1, ...(data?.weeks ?? []).map((w) => w.impressions));

  return (
    <AppShell
      title="SEO – roslagstak.se"
      description={
        data
          ? `Google Search Console · ${data.rangeStart} – ${data.rangeEnd}`
          : "Google Search Console"
      }
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Uppdatera
        </Button>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Kunde inte hämta Search Console-data: {(error as Error).message}
          </div>
        )}

        {isLoading && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Hämtar Search Console-data…
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Klick", value: nf.format(data.totals.clicks), icon: MousePointerClick, delta: <Delta current={data.totals.clicks} previous={data.previousTotals?.clicks} /> },
                { label: "Visningar", value: nf.format(data.totals.impressions), icon: Eye, delta: <Delta current={data.totals.impressions} previous={data.previousTotals?.impressions} /> },
                { label: "CTR", value: pf.format(data.totals.ctr), icon: Percent, delta: <Delta current={data.totals.ctr} previous={data.previousTotals?.ctr} /> },
                { label: "Snittposition", value: df.format(data.totals.position), icon: Gauge, delta: <Delta current={data.totals.position} previous={data.previousTotals?.position} invert /> },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{s.value}</span>
                    {s.delta}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Jämfört med föregående period</p>
                </div>
              ))}
            </div>

            <section className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Indexeringsstatus (startsidan)</h3>
              </div>
              {data.index.error ? (
                <p className="text-sm text-muted-foreground">
                  Indexeringsstatus kunde inte läsas: {data.index.error}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    ["Verdikt", data.index.verdict],
                    ["Täckning", data.index.coverageState],
                    ["Robots.txt", data.index.robotsTxtState],
                    ["Indexering", data.index.indexingState],
                    ["Hämtning", data.index.pageFetchState],
                    ["Mobilanpassning", data.index.mobileVerdict],
                    ["Googles kanoniska", data.index.googleCanonical],
                    [
                      "Senast crawlad",
                      data.index.lastCrawlTime
                        ? new Date(data.index.lastCrawlTime).toLocaleString("sv-SE")
                        : null,
                    ],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
                      <div className="mt-1 break-words text-sm font-medium">
                        {value ? (
                          value === "PASS" ? (
                            <Badge className="bg-success/15 text-success">{value}</Badge>
                          ) : (
                            String(value)
                          )
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-4 font-semibold">Per vecka</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Vecka</th>
                      <th className="py-2 pr-4">Klick</th>
                      <th className="py-2 pr-4">Visningar</th>
                      <th className="py-2 pr-4">CTR</th>
                      <th className="py-2">Snittposition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeks.map((w) => (
                      <tr key={w.weekStart} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap font-medium">{fmtWeek(w)}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-10 tabular-nums">{nf.format(w.clicks)}</span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: `${(w.clicks / maxClicks) * 100}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-14 tabular-nums">{nf.format(w.impressions)}</span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-info" style={{ width: `${(w.impressions / maxImpr) * 100}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{pf.format(w.ctr)}</td>
                        <td className="py-2 tabular-nums">{df.format(w.position)}</td>
                      </tr>
                    ))}
                    {data.weeks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          Ingen rapporterad data för perioden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <RowTable title="Toppsökningar" icon={Search} rows={data.topQueries} />
              <RowTable title="Toppsidor" icon={FileText} rows={data.topPages} linkify />
            </div>

            <p className="text-xs text-muted-foreground">
              Källa: Google Search Console ({data.siteUrl}). Data släpar normalt 2–3 dagar och
              lågvolymsökningar kan utelämnas av Google.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function RowTable({
  title,
  icon: Icon,
  rows,
  linkify,
}: {
  title: string;
  icon: typeof Search;
  rows: SeoRow[];
  linkify?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4">{linkify ? "Sida" : "Sökning"}</th>
              <th className="py-2 pr-4">Klick</th>
              <th className="py-2 pr-4">Visn.</th>
              <th className="py-2 pr-4">CTR</th>
              <th className="py-2">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border/60 last:border-0">
                <td className="max-w-[18rem] truncate py-2 pr-4">
                  {linkify ? (
                    <a href={r.key} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {r.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
                    </a>
                  ) : (
                    r.key
                  )}
                </td>
                <td className="py-2 pr-4 tabular-nums">{nf.format(r.clicks)}</td>
                <td className="py-2 pr-4 tabular-nums">{nf.format(r.impressions)}</td>
                <td className="py-2 pr-4 tabular-nums">{pf.format(r.ctr)}</td>
                <td className="py-2 tabular-nums">{df.format(r.position)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  Ingen rapporterad data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
