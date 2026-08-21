import { useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { kr } from "@/lib/commission";
import { readSourceCosts, sourceRoi, writeSourceCosts, type SourceCosts } from "@/lib/source-roi";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  field: "Fältsälj",
  telemarketing: "Telemarketing",
  scan: "Byggnadsscanning",
  referral: "Referens",
  csv_import: "CSV-import",
  roslagstak: "Webb (roslagstak)",
};

interface Props {
  leads: Lead[];
  isAdmin: boolean;
}

export function SourceRoiTab({ leads, isAdmin }: Props) {
  const [costs, setCosts] = useState<SourceCosts>(() => readSourceCosts());
  const rows = useMemo(() => sourceRoi(leads, costs), [leads, costs]);

  const update = (source: string, value: number) => {
    const next = { ...costs, [source]: value };
    setCosts(next);
    writeSourceCosts(next);
  };

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalRoi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Coins className="h-4 w-4 text-primary" /> ROI per leadkälla
        </h2>
        <p className="text-sm text-muted-foreground">
          Ange kostnad per källa (annonsering, telemarketing, listköp) så räknas kostnad per lead, kostnad per affär
          och ROI ut automatiskt.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total kostnad</p>
            <p className="mt-1 text-xl font-semibold">{kr(totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Omsättning från leads</p>
            <p className="mt-1 text-xl font-semibold">{kr(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total ROI</p>
            <p className="mt-1 text-xl font-semibold">{totalRoi != null ? `${totalRoi.toFixed(0)} %` : "–"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Källa för källa</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Källa</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Affärer</TableHead>
                <TableHead className="text-right">Vinstgrad</TableHead>
                <TableHead className="text-right">Snittorder</TableHead>
                <TableHead className="text-right">Säljcykel</TableHead>
                <TableHead className="text-right">Kostnad</TableHead>
                <TableHead className="text-right">Kost/lead</TableHead>
                <TableHead className="text-right">Kost/affär</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.source}>
                  <TableCell className="font-medium">{SOURCE_LABELS[r.source] ?? r.source}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.won}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.won + r.lost > 0 ? `${r.winRate.toFixed(0)} %` : "–"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.avgOrder ? kr(r.avgOrder) : "–"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.avgCycleDays != null ? `${r.avgCycleDays} d` : "–"}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <Input
                        type="number"
                        className="ml-auto h-8 w-28 text-right"
                        value={r.cost || ""}
                        placeholder="0"
                        onChange={(e) => update(r.source, Number(e.target.value))}
                      />
                    ) : (
                      <span className="tabular-nums">{r.cost ? kr(r.cost) : "–"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.costPerLead != null ? kr(r.costPerLead) : "–"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.costPerDeal != null ? kr(r.costPerDeal) : "–"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      r.roi == null ? "text-muted-foreground" : r.roi >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {r.roi != null ? `${r.roi.toFixed(0)} %` : "–"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    Inga leads att analysera.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Automatisk annonskostnad – kan ej visas, behöver komplettering.</strong>{" "}
          Kostnaderna matas in manuellt här. För att hämta spend automatiskt krävs koppling mot Google Ads och Meta
          Ads. Värdena sparas lokalt i din webbläsare tills en integration finns på plats.
        </CardContent>
      </Card>
    </div>
  );
}
