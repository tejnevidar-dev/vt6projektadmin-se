import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { KeywordCategory } from "@/lib/seo/analysis";
import type { KeywordsResponse } from "@/lib/seo/types";
import { CsvButton, Empty, Panel, ScoreDot, df, nf, pf } from "./shared";

const CATEGORIES: { key: KeywordCategory | "all"; label: string; hint: string }[] = [
  { key: "all", label: "Alla", hint: "Alla sökord med visningar i perioden" },
  { key: "striking_distance", label: "Striking distance", hint: "Position 4–20 – närmast topplaceringar" },
  { key: "almost_page1", label: "Nästan sida 1", hint: "Position 8–15" },
  { key: "high_impr_low_ctr", label: "Hög visning / låg CTR", hint: "CTR klart under förväntad för positionen" },
  { key: "growing", label: "Växande", hint: "Förbättrad position mot föregående period" },
  { key: "declining", label: "Fallande", hint: "Försämrad position mot föregående period" },
  { key: "untapped", label: "Outnyttjade", hint: "Många visningar men svag position" },
  { key: "top3", label: "Topp 3", hint: "Sökord som redan ligger i topp 3" },
];

const INTENT_LABEL: Record<string, string> = {
  transactional: "Transaktionell",
  commercial: "Kommersiell",
  informational: "Informativ",
  navigational: "Navigerande",
  local: "Lokal",
};

type SortKey = "clicks" | "impressions" | "position" | "opportunityScore" | "ctr" | "potentialTraffic";

export function KeywordsTab({ data }: { data: KeywordsResponse }) {
  const [category, setCategory] = useState<KeywordCategory | "all">("all");
  const [intent, setIntent] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("opportunityScore");

  const rows = useMemo(() => {
    const filtered = data.rows.filter((r) => {
      if (category !== "all" && !r.categories.includes(category)) return false;
      if (intent !== "all" && r.intent !== intent) return false;
      if (q && !r.keyword.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    return filtered.sort((a, b) => (sort === "position" ? a.position - b.position : (b[sort] as number) - (a[sort] as number)));
  }, [data.rows, category, intent, q, sort]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: data.rows.length };
    for (const r of data.rows) for (const c of r.categories) m[c] = (m[c] ?? 0) + 1;
    return m;
  }, [data.rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            title={c.hint}
            onClick={() => setCategory(c.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${category === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
          >
            {c.label} <span className="opacity-70">{counts[c.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <Panel
        title="Sökordsintelligens"
        description={`${data.rangeStart} – ${data.rangeEnd} · ${rows.length} sökord`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Sök sökord…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-44" />
            <Select value={intent} onValueChange={setIntent}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla intentioner</SelectItem>
                {Object.entries(INTENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="opportunityScore">Möjlighetspoäng</SelectItem>
                <SelectItem value="clicks">Klick</SelectItem>
                <SelectItem value="impressions">Visningar</SelectItem>
                <SelectItem value="position">Bästa position</SelectItem>
                <SelectItem value="ctr">CTR</SelectItem>
                <SelectItem value="potentialTraffic">Potentiell trafik</SelectItem>
              </SelectContent>
            </Select>
            <CsvButton filename="sokord.csv" rows={rows as unknown as Record<string, unknown>[]} />
          </div>
        }
      >
        {rows.length ? (
          <div className="max-h-[640px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Sökord</TableHead>
                  <TableHead className="text-right">Pos</TableHead>
                  <TableHead className="text-right">Förändr.</TableHead>
                  <TableHead className="text-right">Klick</TableHead>
                  <TableHead className="text-right">Visn.</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Potential</TableHead>
                  <TableHead>Intention</TableHead>
                  <TableHead>Landningssida</TableHead>
                  <TableHead className="text-right">Poäng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 400).map((r) => (
                  <TableRow key={r.keyword} title={r.recommendation}>
                    <TableCell className="max-w-[240px]">
                      <div className="truncate font-medium">{r.keyword}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.categories.slice(0, 2).map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">{CATEGORIES.find((x) => x.key === c)?.label ?? c}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{df.format(r.position)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${(r.positionChange ?? 0) > 0 ? "text-success" : (r.positionChange ?? 0) < 0 ? "text-destructive" : ""}`}>
                      {r.positionChange == null ? "ny" : `${r.positionChange > 0 ? "+" : ""}${df.format(r.positionChange)}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(r.clicks)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(r.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums" title={`Förväntad CTR ${pf.format(r.expectedCtr)}`}>{pf.format(r.ctr)}</TableCell>
                    <TableCell className="text-right tabular-nums">+{r.potentialTraffic}</TableCell>
                    <TableCell className="text-xs">{INTENT_LABEL[r.intent] ?? r.intent}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {r.landingPage ? <a href={r.landingPage} target="_blank" rel="noreferrer" className="hover:underline">{new URL(r.landingPage).pathname}</a> : "–"}
                    </TableCell>
                    <TableCell className="text-right"><ScoreDot score={r.opportunityScore} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty>Inga sökord matchar filtret.</Empty>
        )}
      </Panel>

      <Panel title="Tappade sökord" description="Hade visningar föregående period men inte nu" actions={<CsvButton filename="tappade-sokord.csv" rows={data.lost as unknown as Record<string, unknown>[]} />}>
        {data.lost.length ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Sökord</TableHead><TableHead className="text-right">Tidigare pos</TableHead><TableHead className="text-right">Tidigare klick</TableHead><TableHead className="text-right">Tidigare visn.</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.lost.slice(0, 100).map((l) => (
                <TableRow key={l.keyword}>
                  <TableCell className="font-medium">{l.keyword}</TableCell>
                  <TableCell className="text-right tabular-nums">{df.format(l.previousPosition)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(l.previousClicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(l.previousImpressions)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>Inga tappade sökord i perioden.</Empty>
        )}
      </Panel>
    </div>
  );
}
