import { useMemo, useState } from "react";
import { AlertTriangle, Info, Lightbulb, Loader2, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { salesInsights, type Insight } from "@/lib/sales-insights";
import { readSourceCosts } from "@/lib/source-roi";
import { generateAiInsights, type AiInsightsResult } from "@/lib/ai-insights.functions";
import { daysSinceContact } from "@/lib/sales-actions";
import { netValue } from "@/lib/commission";
import { fetchOffers } from "@/lib/offer-intelligence";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  leads: Lead[];
}


const TONE: Record<Insight["tone"], { icon: typeof Info; className: string; badge: string }> = {
  positive: { icon: TrendingUp, className: "border-success/40 bg-success/5", badge: "Möjlighet" },
  warning: { icon: AlertTriangle, className: "border-warning/40 bg-warning/5", badge: "Varning" },
  critical: { icon: AlertTriangle, className: "border-destructive/40 bg-destructive/5", badge: "Akut" },
  neutral: { icon: Info, className: "", badge: "Info" },
};

const PENDING = [
  {
    title: "Kartvy / geografisk heatmap",
    need: "Kartintegration (Mapbox eller Google Maps) + koordinater på fastigheterna.",
  },
  {
    title: "Automatisk annonskostnad i ROI",
    need: "Koppling mot Google Ads och Meta Ads. Kostnad matas in manuellt tills vidare.",
  },
  {
    title: "SMS-påminnelser vid bokning",
    need: "Twilio-konto med SID, token och avsändarnummer. E-postpåminnelser fungerar redan.",
  },
  {
    title: "Google Business Profile i SEO-panelen",
    need: "GBP-API saknar färdig koppling – recensioner och lokala visningar kan inte hämtas ännu.",
  },
  {
    title: "GA4-trafikdata i SEO-panelen",
    need: "GA4-åtkomsttoken behövs för att visa sessioner och konverteringar per kanal.",
  },
];

const URGENCY: Record<string, { label: string; className: string }> = {
  hog: { label: "Hög", className: "bg-destructive/15 text-destructive border-destructive/30" },
  medel: { label: "Medel", className: "bg-warning/15 text-warning-foreground border-warning/30" },
  lag: { label: "Låg", className: "bg-muted text-muted-foreground" },
};

const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;

export function InsightsTab({ leads }: Props) {
  const insights = useMemo(() => salesInsights(leads, readSourceCosts()), [leads]);
  const [ai, setAi] = useState<AiInsightsResult | null>(null);

  const { data: offers = [] } = useQuery({ queryKey: ["offers"], queryFn: fetchOffers });
  const runAi = useServerFn(generateAiInsights);

  const payload = useMemo(() => {
    const open = leads.filter((l) => l.pipelineStage !== "slutford" && l.pipelineStage !== "forlorad");
    const now = new Date();
    const leadBriefs = [...open]
      .sort((a, b) => netValue(b) - netValue(a))
      .slice(0, 60)
      .map((l) => ({
        id: l.id,
        name: l.name,
        stage: l.pipelineStage,
        source: l.source,
        area: l.municipality,
        value: Math.round(netValue(l)),
        daysSinceContact: daysSinceContact(l, now),
        score: l.score,
        jobType: l.jobType,
        lostReason: l.lostReason,
      }));
    const leadById = new Map(leads.map((l) => [l.id, l.name]));
    const offerBriefs = offers.slice(0, 60).map((o) => ({
      id: o.id,
      leadName: o.leadId ? (leadById.get(o.leadId) ?? null) : null,
      status: o.status,
      amount: Math.round(o.totalAmount),
      daysSinceSent: o.sentAt
        ? Math.floor((now.getTime() - new Date(o.sentAt).getTime()) / 86400000)
        : null,
      version: o.version,
    }));
    const won = leads.filter((l) => l.pipelineStage === "slutford").length;
    const lost = leads.filter((l) => l.pipelineStage === "forlorad").length;
    const summary = [
      `Totalt ${leads.length} leads, ${open.length} öppna, ${won} vunna, ${lost} förlorade.`,
      `Öppet pipelinevärde: ${kr(open.reduce((s, l) => s + netValue(l), 0))}.`,
      `Regelbaserade insikter: ${insights.map((i) => i.title).join("; ") || "inga"}.`,
    ].join(" ");
    return { leads: leadBriefs, offers: offerBriefs, summary };
  }, [leads, offers, insights]);

  const mutation = useMutation({
    mutationFn: () => runAi({ data: payload }),
    onSuccess: (res) => setAi(res),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Kunde inte generera AI-rekommendationer."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Insikter & rekommendationer
          </h2>
          <p className="text-sm text-muted-foreground">
            Mönster i pipeline, källor, geografi och förlustorsaker – med konkreta nästa steg.
          </p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || leads.length === 0}>
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          AI-prioritering
        </Button>
      </div>

      {ai && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4 text-primary" /> AI-rekommendationer
            </CardTitle>
            <p className="text-sm text-muted-foreground">{ai.headline}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {ai.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">AI hittade inga tydliga prioriteringar.</p>
            ) : (
              ai.recommendations.map((r) => (
                <div key={`${r.rank}-${r.title}`} className="rounded-md border border-border/60 bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {r.rank}. {r.title}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {r.type}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px]", URGENCY[r.urgency]?.className)}>
                        {URGENCY[r.urgency]?.label}
                      </Badge>
                      {r.value > 0 && <span className="text-sm font-semibold">{kr(r.value)}</span>}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{r.why}</div>
                  <div className="mt-1 text-sm font-medium">Nästa steg: {r.action}</div>
                </div>
              ))
            )}
            {ai.risks.length > 0 && (
              <div className="rounded-md border border-dashed p-3 text-sm">
                <div className="mb-1 font-medium">Risker att bevaka</div>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {ai.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {insights.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            För lite data för att hitta mönster ännu. Insikter dyker upp när fler leads och affärer registrerats.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((i) => {
            const tone = TONE[i.tone];
            const Icon = tone.icon;
            return (
              <Card key={i.id} className={cn(tone.className)}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-3 text-base">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" /> {i.title}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {i.metric ?? tone.badge}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{i.body}</CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4" /> Kan ej visas – behöver komplettering
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {PENDING.map((p) => (
            <div key={p.title} className="rounded-md border border-border/60 p-3">
              <div className="font-medium">{p.title}</div>
              <div className="text-muted-foreground">{p.need}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
