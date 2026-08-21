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
  {
    title: "AI-genererade fritextinsikter",
    need: "Insikterna nedan är regelbaserade. Vill du ha AI-skrivna analyser kopplar vi in AI-motorn separat.",
  },
];

export function InsightsTab({ leads }: Props) {
  const insights = useMemo(() => salesInsights(leads, readSourceCosts()), [leads]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Insikter & rekommendationer
        </h2>
        <p className="text-sm text-muted-foreground">
          Mönster i pipeline, källor, geografi och förlustorsaker – med konkreta nästa steg.
        </p>
      </div>

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
