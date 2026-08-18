import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContentGap, LinkSuggestion, LocalReportRow, LocalTarget } from "@/lib/seo/types";
import { CsvButton, Empty, NotConnected, Panel, df, nf } from "./shared";

const STATUS: Record<LocalReportRow["status"], { label: string; cls: string }> = {
  stark: { label: "Stark", cls: "bg-success/15 text-success" },
  svag: { label: "Svag", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  saknas: { label: "Sida saknas", cls: "bg-destructive/15 text-destructive" },
  obevakad: { label: "Ingen data", cls: "bg-muted text-muted-foreground" },
};

export function GrowthTab({
  local,
  gaps,
  links,
  targets,
  onAddTarget,
  onDeleteTarget,
  busy,
}: {
  local: LocalReportRow[];
  gaps: ContentGap[];
  links: LinkSuggestion[];
  targets: LocalTarget[];
  onAddTarget: (service: string, locality: string, landingUrl: string) => void;
  onDeleteTarget: (id: string) => void;
  busy: boolean;
}) {
  const [service, setService] = useState("");
  const [locality, setLocality] = useState("");
  const [landing, setLanding] = useState("");

  return (
    <div className="space-y-6">
      <Panel
        title="Lokal SEO"
        description="Geografisk rankinganalys för tjänst + ort"
        actions={<CsvButton filename="lokal-seo.csv" rows={local as unknown as Record<string, unknown>[]} />}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <Input placeholder="Tjänst, t.ex. takläggare" value={service} onChange={(e) => setService(e.target.value)} className="h-9 w-52" />
          <Input placeholder="Ort, t.ex. Norrtälje" value={locality} onChange={(e) => setLocality(e.target.value)} className="h-9 w-44" />
          <Input placeholder="Landningssida (valfritt)" value={landing} onChange={(e) => setLanding(e.target.value)} className="h-9 w-64" />
          <Button
            size="sm"
            disabled={busy || !service.trim() || !locality.trim()}
            onClick={() => {
              onAddTarget(service, locality, landing);
              setService("");
              setLocality("");
              setLanding("");
            }}
          >
            <Plus className="mr-1 h-4 w-4" />Lägg till mål
          </Button>
        </div>

        {local.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tjänst + ort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sökord</TableHead>
                <TableHead className="text-right">Klick</TableHead>
                <TableHead className="text-right">Visn.</TableHead>
                <TableHead className="text-right">Pos</TableHead>
                <TableHead>Rekommendation</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {local.map((l) => {
                const target = targets.find((t) => t.service === l.service && t.locality === l.locality);
                return (
                  <TableRow key={`${l.service}-${l.locality}`}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{l.service} · {l.locality}</div>
                      {l.landingUrl && <a href={l.landingUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{l.landingUrl}</a>}
                      {l.cannibalization.length > 1 && <div className="text-xs text-destructive">Risk för kannibalisering: {l.cannibalization.length} sidor</div>}
                    </TableCell>
                    <TableCell><Badge className={STATUS[l.status].cls}>{STATUS[l.status].label}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{l.keywords}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(l.clicks)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(l.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.position != null ? df.format(l.position) : "–"}</TableCell>
                    <TableCell className="max-w-[320px] text-xs text-muted-foreground">{l.recommendation}</TableCell>
                    <TableCell>
                      {target && (
                        <Button variant="ghost" size="icon" onClick={() => onDeleteTarget(target.id)} disabled={busy}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <Empty>Inga lokala mål ännu. Lägg till tjänst och ort ovan.</Empty>
        )}
      </Panel>

      <Panel title="Content gap" description="Sökintentioner utan matchande sida" actions={<CsvButton filename="content-gap.csv" rows={gaps.map((g) => ({ ...g, secondaryKeywords: g.secondaryKeywords.join(" | "), outline: g.outline.join(" | "), linkFrom: g.linkFrom.join(" | ") }))} />}>
        {gaps.length ? (
          <ul className="space-y-3">
            {gaps.map((g) => (
              <li key={g.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{g.primaryKeyword}</span>
                  <Badge variant="outline">{g.intent}</Badge>
                  {g.position != null && <Badge variant="outline">Pos {df.format(g.position)}</Badge>}
                  <Badge variant="outline">{nf.format(g.impressions)} visn.</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{g.reason}</p>
                <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                  <div>
                    <div><span className="font-medium">Föreslagen URL:</span> {g.recommendedUrl}</div>
                    <div><span className="font-medium">Title:</span> {g.recommendedTitle}</div>
                    <div><span className="font-medium">H1:</span> {g.recommendedH1}</div>
                    {g.secondaryKeywords.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.secondaryKeywords.map((k) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Innehållsstruktur</div>
                    <ul className="list-inside list-disc text-sm text-muted-foreground">
                      {g.outline.map((o) => <li key={o}>{o}</li>)}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Inga content gaps identifierade.</Empty>
        )}
      </Panel>

      <Panel title="Intern länkning" description="Förslag på interna länkar till svagt länkade sidor" actions={<CsvButton filename="internlankning.csv" rows={links as unknown as Record<string, unknown>[]} />}>
        {links.length ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Från</TableHead><TableHead>Till</TableHead><TableHead>Ankartext</TableHead><TableHead>Varför</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {links.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="max-w-[200px] truncate text-xs">{new URL(l.from).pathname}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{new URL(l.to).pathname}</TableCell>
                  <TableCell className="text-sm font-medium">{l.anchor}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>Inga länkförslag – strukturen ser balanserad ut.</Empty>
        )}
      </Panel>

      <Panel title="Konkurrentanalys">
        <NotConnected
          title="Konkurrentdata"
          detail="Ranking-överlapp, konkurrenters toppsidor och delade sökord kräver en extern SEO-datakälla. Ingen sådan är ansluten, så inga siffror visas här."
          required={["API-nyckel för t.ex. Semrush eller DataForSEO"]}
        />
      </Panel>
    </div>
  );
}
