import { Link2, Search, TrendingUp, Users } from "lucide-react";
import type { MarketResponse } from "@/lib/seo/types";
import { CsvButton, Empty, NotConnected, Panel, StatCard, df, nf } from "@/components/seo/shared";

export function MarketTab({ data }: { data: MarketResponse }) {
  if (!data.connected) {
    return (
      <NotConnected
        title="Semrush (sökvolym, backlinks, konkurrenter)"
        detail={data.reason ?? "Semrush är inte anslutet."}
        required={["Semrush-anslutning"]}
      />
    );
  }

  const kw = data.keywords ?? [];
  const bl = data.backlinks;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Authority Score" value={bl ? nf.format(bl.authorityScore) : "–"} icon={TrendingUp} footer={<span className="text-xs text-muted-foreground">Semrush 0–100</span>} />
        <StatCard label="Backlinks" value={bl ? nf.format(bl.totalBacklinks) : "–"} icon={Link2} footer={<span className="text-xs text-muted-foreground">{bl ? `${nf.format(bl.referringDomains)} refererande domäner` : ""}</span>} />
        <StatCard label="Organiska sökord" value={data.overview ? nf.format(data.overview.organicKeywords) : "–"} icon={Search} footer={<span className="text-xs text-muted-foreground">Semrush-estimat, databas {data.database.toUpperCase()}</span>} />
        <StatCard label="Estimerad organisk trafik" value={data.overview ? nf.format(data.overview.organicTraffic) : "–"} icon={Users} footer={<span className="text-xs text-muted-foreground">per månad (estimat)</span>} />
      </div>

      <Panel
        title="Sökvolym & svårighetsgrad"
        description="Dina Search Console-sökord berikade med Semrush-volym, KD och CPC."
        actions={<CsvButton filename="semrush-sokord.csv" rows={kw as unknown as Record<string, unknown>[]} />}
      >
        {kw.length === 0 ? (
          <Empty>Inga sökord att berika ännu.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Sökord</th>
                  <th className="py-2 pr-3 text-right">Position</th>
                  <th className="py-2 pr-3 text-right">Klick</th>
                  <th className="py-2 pr-3 text-right">Visningar</th>
                  <th className="py-2 pr-3 text-right">Sökvolym</th>
                  <th className="py-2 pr-3 text-right">KD</th>
                  <th className="py-2 text-right">CPC</th>
                </tr>
              </thead>
              <tbody>
                {kw.map((k) => (
                  <tr key={k.keyword} className="border-t border-border">
                    <td className="py-2 pr-3">{k.keyword}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{df.format(k.position)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nf.format(k.clicks)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nf.format(k.impressions)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{k.volume == null ? "–" : nf.format(k.volume)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{k.difficulty == null ? "–" : df.format(k.difficulty)}</td>
                    <td className="py-2 text-right tabular-nums">{k.cpc == null ? "–" : `${df.format(k.cpc)} $`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Starkaste länkkällor" description="Refererande domäner sorterade av Semrush.">
          {!bl?.topDomains?.length ? (
            <Empty>Ingen backlinkdata tillgänglig.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {bl.topDomains.map((d) => (
                <li key={d.domain} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <span className="truncate">{d.domain}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">AS {nf.format(d.authority)} · {nf.format(d.backlinks)} länkar</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Organiska konkurrenter" description="Domäner som rankar på samma sökord.">
          {!data.competitors?.length ? (
            <Empty>Ingen konkurrentdata tillgänglig.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.competitors.map((c) => (
                <li key={c.domain} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <span className="truncate">{c.domain}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {nf.format(c.commonKeywords)} gemensamma · {nf.format(c.organicTraffic)} trafik
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs text-muted-foreground">Källa: Semrush ({data.database.toUpperCase()}-databasen). Volym och trafik är estimat.</p>
    </div>
  );
}
