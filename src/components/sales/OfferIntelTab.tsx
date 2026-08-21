import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, FileText, Layers, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { kr } from "@/lib/commission";
import { fetchOffers, leadOfferFallback, offerIntel, priceBuckets } from "@/lib/offer-intelligence";
import type { Lead } from "@/lib/types";

interface Props {
  leads: Lead[];
}

export function OfferIntelTab({ leads }: Props) {
  const { data: offers = [], isLoading } = useQuery({ queryKey: ["offers"], queryFn: fetchOffers });

  const intel = useMemo(() => offerIntel(offers), [offers]);
  const buckets = useMemo(() => priceBuckets(offers), [offers]);
  const fallback = useMemo(() => leadOfferFallback(leads), [leads]);

  const leadName = (id: string | null) => leads.find((l) => l.id === id)?.name ?? "Okänd kund";

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Laddar offertdata…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileText} label="Offerter totalt" value={String(intel.total)} sub={`${intel.sent} skickade`} />
        <Stat icon={CheckCircle2} label="Accepterade" value={String(intel.accepted)} sub={`${intel.rejected} avvisade`} />
        <Stat icon={Percent} label="Vinstgrad offert" value={`${intel.winRate.toFixed(0)} %`} sub="Av avgjorda offerter" />
        <Stat
          icon={Clock}
          label="Svarstid"
          value={intel.avgResponseDays != null ? `${intel.avgResponseDays} dagar` : "–"}
          sub="Skickad → accepterad"
        />
        <Stat icon={Layers} label="Versioner per affär" value={intel.avgVersions ? intel.avgVersions.toFixed(2) : "–"} sub={`${intel.revisedShare.toFixed(0)} % krävde omarbetning`} />
        <Stat icon={FileText} label="Snittbelopp" value={kr(intel.avgAmount)} sub="Alla offerter" />
        <Stat icon={CheckCircle2} label="Snitt vunnen" value={kr(intel.avgAcceptedAmount)} sub="Accepterade offerter" />
        <Stat icon={AlertTriangle} label="Snitt förlorad" value={kr(intel.avgRejectedAmount)} sub="Avvisade offerter" />
      </div>

      {intel.total === 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm">
            Ingen offert har sparats i systemet ännu, så statistiken nedan är tom. Just nu ligger{" "}
            <strong>{fallback.count} leads</strong> i offertsteg till ett värde av{" "}
            <strong>{kr(fallback.value)}</strong>. Statistiken fylls på automatiskt när offerter genereras och
            markeras som skickade/accepterade.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vinstgrad per prisnivå</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" %" />
              <Tooltip
                formatter={(v: number, n) => (n === "winRate" ? `${v.toFixed(0)} %` : v)}
                labelClassName="text-foreground"
              />
              <Bar dataKey="winRate" name="Vinstgrad" radius={[4, 4, 0, 0]}>
                {buckets.map((b) => (
                  <Cell
                    key={b.label}
                    fill={b.winRate >= 50 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Offerter utan svar</CardTitle>
        </CardHeader>
        <CardContent>
          {intel.stale.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Inga obesvarade offerter äldre än 5 dagar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kund</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                  <TableHead className="text-right">Dagar sedan utskick</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intel.stale.map((s) => (
                  <TableRow key={s.offer.id}>
                    <TableCell className="font-medium">{leadName(s.offer.leadId)}</TableCell>
                    <TableCell>v{s.offer.version}</TableCell>
                    <TableCell className="text-right tabular-nums">{kr(s.offer.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={s.days >= 14 ? "border-destructive/50 text-destructive" : ""}>
                        {s.days} dagar
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
