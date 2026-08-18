import { AlertTriangle, Eye, Gauge, MousePointerClick, Percent, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import type { OverviewResponse } from "@/lib/seo/types";
import { CsvButton, Delta, Empty, NotConnected, Panel, SeverityBadge, StatCard, df, nf, pf } from "./shared";

export function OverviewTab({ data }: { data: OverviewResponse }) {
  const chart = data.weekly.length > 3 ? data.weekly : data.series;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organiska klick" value={nf.format(data.totals.clicks)} icon={MousePointerClick} footer={<Delta current={data.totals.clicks} previous={data.previousTotals?.clicks} />} />
        <StatCard label="Visningar" value={nf.format(data.totals.impressions)} icon={Eye} footer={<Delta current={data.totals.impressions} previous={data.previousTotals?.impressions} />} />
        <StatCard label="CTR" value={pf.format(data.totals.ctr)} icon={Percent} footer={<Delta current={data.totals.ctr} previous={data.previousTotals?.ctr} />} />
        <StatCard label="Snittposition" value={df.format(data.totals.position)} icon={Gauge} footer={<Delta current={data.totals.position} previous={data.previousTotals?.position} invert />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Klick & visningar" description={`${data.rangeStart} – ${data.rangeEnd}`}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="impressions" name="Visningar" stroke="hsl(var(--muted-foreground))" fill="none" strokeDasharray="4 3" />
              <Area type="monotone" dataKey="clicks" name="Klick" stroke="hsl(var(--primary))" fill="url(#clicksFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Snittposition" description="Lägre är bättre">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis reversed domain={["auto", "auto"]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="position" name="Position" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Positionsfördelning" description="Antal sökord per positionsintervall">
          <ul className="space-y-2 text-sm">
            {[
              ["Topp 3", data.keywordBuckets.top3],
              ["Position 4–10", data.keywordBuckets.pos4_10],
              ["Position 11–20", data.keywordBuckets.pos11_20],
              ["Position 21–50", data.keywordBuckets.pos21_50],
            ].map(([label, value]) => (
              <li key={label as string} className="flex items-center gap-3">
                <span className="w-32 text-muted-foreground">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${data.keywordBuckets.total ? ((value as number) / data.keywordBuckets.total) * 100 : 0}%` }} />
                </div>
                <span className="w-10 text-right font-medium tabular-nums">{value as number}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{nf.format(data.keywordBuckets.total)} sökord med visningar i perioden.</p>
        </Panel>

        <Panel title="Sökordsrörelser" description="Mot föregående period">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Förbättrade", data.keywordMovement.improved, "text-success"],
              ["Försämrade", data.keywordMovement.declined, "text-destructive"],
              ["Nya", data.keywordMovement.added, "text-primary"],
              ["Tappade", data.keywordMovement.lost, "text-muted-foreground"],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">{label as string}</div>
                <div className={`text-xl font-bold tabular-nums ${cls as string}`}>{value as number}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Enheter & marknader">
          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Smartphone className="h-3 w-3" />Enheter</div>
              {data.devices.length ? data.devices.map((d) => (
                <div key={d.key} className="flex justify-between"><span>{d.key}</span><span className="tabular-nums">{nf.format(d.clicks)} klick · pos {df.format(d.position)}</span></div>
              )) : <Empty>Ingen enhetsdata.</Empty>}
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Länder</div>
              {data.countries.slice(0, 4).map((c) => (
                <div key={c.key} className="flex justify-between"><span className="uppercase">{c.key}</span><span className="tabular-nums">{nf.format(c.clicks)} klick</span></div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Indexeringsstatus (startsidan)" description="Google Search Console URL-inspektion">
          {data.index.error ? (
            <NotConnected title="URL-inspektion" detail={data.index.error} />
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Verdikt", data.index.verdict],
                ["Täckning", data.index.coverageState],
                ["Robots.txt", data.index.robotsTxtState],
                ["Indexering", data.index.indexingState],
                ["Hämtning", data.index.pageFetchState],
                ["Mobilanpassning", data.index.mobileVerdict],
                ["Googles kanoniska", data.index.googleCanonical],
                ["Senast crawlad", data.index.lastCrawlTime ? new Date(data.index.lastCrawlTime).toLocaleString("sv-SE") : null],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{label as string}</div>
                  <div className="mt-0.5 break-words font-medium">
                    {value ? (value === "PASS" ? <Badge className="bg-success/15 text-success">PASS</Badge> : String(value)) : <span className="text-muted-foreground">–</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Core Web Vitals & prestanda" description="PageSpeed Insights för startsidan">
          {!data.pagespeed.connected ? (
            <NotConnected title="PageSpeed Insights" detail={data.pagespeed.reason ?? "Kunde inte hämtas."} required={["PAGESPEED_API_KEY för stabil kvot"]} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(["mobile", "desktop"] as const).map((s) => {
                const r = data.pagespeed[s];
                if (!r) return null;
                return (
                  <div key={s} className="rounded-md border border-border p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s === "mobile" ? "Mobil" : "Desktop"}</div>
                    <div className="space-y-1 text-sm">
                      <Row label="Performance" value={r.performance} />
                      <Row label="SEO" value={r.seo} />
                      <Row label="Tillgänglighet" value={r.accessibility} />
                      <Row label="LCP" value={r.lcp != null ? `${df.format(r.lcp / 1000)} s` : null} />
                      <Row label="CLS" value={r.cls != null ? r.cls.toFixed(3) : null} />
                      <Row label="INP" value={r.inp != null ? `${Math.round(r.inp)} ms` : null} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{r.fieldData ? "Fältdata från riktiga besökare" : "Labbdata (Lighthouse)"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Analytics (GA4)"
        description="Organiska användare, sessioner och konverteringar"
      >
        {data.analytics.connected ? (
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Organiska användare" value={nf.format(data.analytics.users ?? 0)} icon={Users} />
            <StatCard label="Sessioner" value={nf.format(data.analytics.sessions ?? 0)} icon={Users} />
            <StatCard label="Konverteringar" value={nf.format(data.analytics.conversions ?? 0)} icon={Users} />
          </div>
        ) : (
          <NotConnected title="Google Analytics 4" detail={data.analytics.reason ?? "Ej ansluten."} required={["Google Analytics-anslutning", "GA4_PROPERTY_ID"]} />
        )}
      </Panel>

      <Panel
        title="SEO-larm"
        description="Automatiska avvikelser i perioden"
        actions={<CsvButton filename="seo-larm.csv" rows={data.alerts as unknown as Record<string, unknown>[]} />}
      >
        {data.alerts.length ? (
          <ul className="space-y-2">
            {data.alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="text-sm text-muted-foreground">{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" />Inga avvikelser upptäckta i perioden.</div>
        )}
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value ?? "–"}</span>
    </div>
  );
}
