import { useState } from "react";
import { FileWarning, Link2Off, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TechnicalResponse } from "@/lib/seo/types";
import { CsvButton, Empty, HealthBar, Panel, SeverityBadge, StatCard, nf } from "./shared";

export function TechnicalTab({
  data,
  onRecrawl,
  crawling,
}: {
  data: TechnicalResponse;
  onRecrawl: (maxPages: number) => void;
  crawling: boolean;
}) {
  const [maxPages, setMaxPages] = useState(40);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Crawlade sidor" value={nf.format(data.pagesCrawled)} icon={FileWarning} footer={<span className="text-xs text-muted-foreground">{new Date(data.crawledAt).toLocaleString("sv-SE")}</span>} />
        <StatCard label="URL:er i sitemap" value={nf.format(data.sitemapUrls)} icon={FileWarning} footer={data.sitemapError ? <span className="text-xs text-destructive">{data.sitemapError}</span> : <span className="text-xs text-muted-foreground">Sitemap läst</span>} />
        <StatCard label="Kritiska & höga fel" value={nf.format(data.issuesBySeverity.critical + data.issuesBySeverity.high)} icon={FileWarning} footer={<span className="text-xs text-muted-foreground">{data.issuesBySeverity.critical} kritiska</span>} />
        <StatCard label="Föräldralösa sidor" value={nf.format(data.orphanPages.length)} icon={Link2Off} footer={<span className="text-xs text-muted-foreground">Saknar interna inlänkar</span>} />
      </div>

      <Panel
        title="Teknisk hälsa"
        description={`${data.origin} · robots.txt ${data.robots.ok ? "OK" : "kunde inte läsas"}`}
        actions={
          <div className="flex items-center gap-2">
            <Input type="number" min={5} max={120} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} className="h-9 w-24" />
            <Button size="sm" variant="outline" onClick={() => onRecrawl(maxPages)} disabled={crawling}>
              <RefreshCw className={`mr-2 h-4 w-4 ${crawling ? "animate-spin" : ""}`} />
              Crawla om
            </Button>
            <CsvButton filename="tekniska-fel.csv" rows={data.issues as unknown as Record<string, unknown>[]} />
          </div>
        }
      >
        {data.issues.length ? (
          <ul className="space-y-2">
            {data.issues.map((i) => (
              <li key={i.code + i.url} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={i.severity} />
                  <span className="text-sm font-medium">{i.title}</span>
                  <Badge variant="outline" className="text-[10px]">{i.pages} sid{i.pages === 1 ? "a" : "or"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{i.detail}</p>
                <p className="mt-1 text-sm"><span className="font-medium">Åtgärd:</span> {i.fix}</p>
                {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-primary hover:underline">{i.url}</a>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Inga tekniska fel hittades.</Empty>
        )}
      </Panel>

      <Panel title="Sidanalys" description="Klicka på en sida för fullständig genomgång" actions={<CsvButton filename="sidanalys.csv" rows={data.pages.map((p) => ({ url: p.url, status: p.statusCode, health: p.healthScore, title: p.title, words: p.wordCount, h1: p.h1.join(" | "), canonical: p.canonical, inSitemap: p.inSitemap, imagesMissingAlt: p.imagesMissingAlt }))} />}>
        {data.pages.length ? (
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Sida</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Ord</TableHead>
                  <TableHead className="text-right">Inlänkar</TableHead>
                  <TableHead className="text-right">Alt saknas</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Hälsa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pages.map((p) => (
                  <>
                    <TableRow key={p.url} className="cursor-pointer" onClick={() => setOpen(open === p.url ? null : p.url)}>
                      <TableCell className="max-w-[280px]">
                        <div className="truncate font-medium">{new URL(p.url).pathname}</div>
                        <div className="truncate text-xs text-muted-foreground">{p.title ?? "Saknar title"}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.statusCode}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.wordCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.internalLinksIn ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.imagesMissingAlt}/{p.imagesTotal}</TableCell>
                      <TableCell className="text-xs">{p.structuredData.length ? p.structuredData.join(", ") : "–"}</TableCell>
                      <TableCell><HealthBar score={p.healthScore} /></TableCell>
                    </TableRow>
                    {open === p.url && (
                      <TableRow key={`${p.url}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/40">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1 text-sm">
                              <Field label="URL" value={p.url} link />
                              <Field label="Title" value={p.title ?? "–"} />
                              <Field label="Meta description" value={p.metaDescription ?? "–"} />
                              <Field label="H1" value={p.h1.length ? p.h1.join(" | ") : "–"} />
                              <Field label="Canonical" value={p.canonical ?? "–"} />
                              <Field label="Robots" value={p.robots ?? "–"} />
                              <Field label="I sitemap" value={p.inSitemap ? "Ja" : "Nej"} />
                              <Field label="Utgående interna länkar" value={String(p.internalLinksOut.length)} />
                            </div>
                            <div>
                              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Rubrikstruktur</div>
                              <ul className="mb-3 space-y-0.5 text-sm">
                                {p.headings.slice(0, 14).map((h, idx) => (
                                  <li key={idx} style={{ paddingLeft: (Number(h.tag.replace(/\D/g, "")) - 1) * 12 }} className="truncate text-muted-foreground">
                                    <span className="mr-1 font-mono uppercase text-[10px]">{h.tag}</span>{h.text}
                                  </li>
                                ))}
                                {!p.headings.length && <li className="text-muted-foreground">Inga rubriker hittades.</li>}
                              </ul>
                              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Problem</div>
                              <ul className="space-y-1 text-sm">
                                {p.issues.length ? p.issues.map((i, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <SeverityBadge severity={i.severity} />
                                    <span>{i.title} – <span className="text-muted-foreground">{i.fix}</span></span>
                                  </li>
                                )) : <li className="text-muted-foreground">Inga problem.</li>}
                              </ul>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty>Ingen sidanalys ännu – kör en crawl.</Empty>
        )}
      </Panel>

      {(data.duplicateTitles.length > 0 || data.duplicateDescriptions.length > 0) && (
        <Panel title="Duplicerat innehåll">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Dubblerade titles</h4>
              {data.duplicateTitles.length ? data.duplicateTitles.map((d) => (
                <div key={d.value} className="mb-2 rounded border border-border p-2 text-sm">
                  <div className="font-medium">{d.value}</div>
                  <div className="text-xs text-muted-foreground">{d.urls.join(", ")}</div>
                </div>
              )) : <Empty>Inga.</Empty>}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Dubblerade beskrivningar</h4>
              {data.duplicateDescriptions.length ? data.duplicateDescriptions.map((d) => (
                <div key={d.value} className="mb-2 rounded border border-border p-2 text-sm">
                  <div className="line-clamp-2">{d.value}</div>
                  <div className="text-xs text-muted-foreground">{d.urls.join(", ")}</div>
                </div>
              )) : <Empty>Inga.</Empty>}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-44 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      {link ? <a href={value} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{value}</a> : <span className="break-words">{value}</span>}
    </div>
  );
}
