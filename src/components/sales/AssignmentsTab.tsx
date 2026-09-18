import { useMemo, useState } from "react";
import { ChevronRight, UserCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/lib/types";
import { JOB_TYPE_LABELS, PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from "@/lib/types";
import { dateSv } from "@/lib/format";
import type { Saljare } from "@/lib/saljare-api";
import { leadsOf } from "@/lib/sales-analytics";

interface Props {
  leads: Lead[];
  sellers: Saljare[];
  currentUserId: string | null;
  isAdmin: boolean;
  onSelect: (lead: Lead) => void;
}

/** Visar en vald säljares tilldelade leads över alla pipeline-steg i en samlad lista. */
export function AssignmentsTab({ leads, sellers, currentUserId, isAdmin, onSelect }: Props) {
  const [sellerId, setSellerId] = useState<string>(() => {
    if (!isAdmin && currentUserId && sellers.some((s) => s.id === currentUserId)) return currentUserId;
    return sellers[0]?.id ?? "";
  });

  const sellerLeads = useMemo(() => (sellerId ? leadsOf(leads, sellerId) : []), [leads, sellerId]);

  const stageCounts = useMemo(() => {
    const counts = new Map<PipelineStage, number>();
    for (const l of sellerLeads) counts.set(l.pipelineStage, (counts.get(l.pipelineStage) ?? 0) + 1);
    return counts;
  }, [sellerLeads]);

  const sorted = useMemo(
    () => [...sellerLeads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sellerLeads],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="h-4 w-4" /> Tilldelningar per säljare
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {sellers.length === 0 && <option value="">Inga säljare registrerade</option>}
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                  {s.id === currentUserId ? " (mig)" : ""}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">
              {sellerLeads.length} tilldelade leads, alla pipeline-steg
            </span>
          </div>

          {stageCounts.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {PIPELINE_STAGES.filter((s) => stageCounts.has(s)).map((stage) => (
                <Badge key={stage} variant="secondary" className="gap-1.5">
                  {PIPELINE_STAGE_LABELS[stage]}
                  <span className="font-semibold">{stageCounts.get(stage)}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {sellerId ? "Inga tilldelade leads." : "Välj en säljare."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kund</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Adress</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground sm:table-cell">Jobbtyp</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Steg</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground lg:table-cell">Skapad</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => onSelect(lead)}
                      className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-2.5 font-medium text-card-foreground">{lead.name}</td>
                      <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">{lead.address}</td>
                      <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                        {JOB_TYPE_LABELS[lead.jobType]}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline">{PIPELINE_STAGE_LABELS[lead.pipelineStage]}</Badge>
                      </td>
                      <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">{dateSv(lead.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
