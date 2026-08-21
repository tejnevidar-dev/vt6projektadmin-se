import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { kr } from "@/lib/commission";
import { areaStats } from "@/lib/geo-analytics";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  leads: Lead[];
}

export function GeographyTab({ leads }: Props) {
  const [key, setKey] = useState<"municipality" | "region">("municipality");
  const rows = useMemo(() => areaStats(leads, key), [leads, key]);
  const chart = useMemo(() => rows.slice(0, 12), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-4 w-4 text-primary" /> Var tjänar vi pengar?
          </h2>
          <p className="text-sm text-muted-foreground">
            Omsättning, vinstgrad och snittorder per område – baserat på fastighetens adressuppgifter.
          </p>
        </div>
        <Tabs value={key} onValueChange={(v) => setKey(v as typeof key)}>
          <TabsList>
            <TabsTrigger value="municipality">Kommun</TabsTrigger>
            <TabsTrigger value="region">Län</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Omsättning per område</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="area" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number) => kr(v)} />
              <Bar dataKey="revenue" name="Omsättning" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detaljer per område</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Område</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Vunna</TableHead>
                <TableHead className="text-right">Förlorade</TableHead>
                <TableHead className="text-right">Vinstgrad</TableHead>
                <TableHead className="text-right">Snittorder</TableHead>
                <TableHead className="text-right">Pipeline</TableHead>
                <TableHead className="text-right">Omsättning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.area}>
                  <TableCell className="font-medium">{r.area}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.won}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.lost}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      r.winRate >= 50 ? "text-success" : r.winRate > 0 ? "text-warning-foreground" : "text-muted-foreground",
                    )}
                  >
                    {r.won + r.lost > 0 ? `${r.winRate.toFixed(0)} %` : "–"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.avgOrder ? kr(r.avgOrder) : "–"}</TableCell>
                  <TableCell className="text-right tabular-nums">{kr(r.pipeline)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{kr(r.revenue)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Inga leads med områdesdata.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Kartvy – kan ej visas, behöver komplettering.</strong> En heatmap på karta
          kräver kartintegration (Mapbox/Google Maps) samt att koordinater fylls i på fastigheterna. Tabellen och
          diagrammet ovan visar samma data under tiden.
        </CardContent>
      </Card>
    </div>
  );
}
