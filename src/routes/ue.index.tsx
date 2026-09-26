import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { listMyOffers, respondToMyOffer, getWorkOrderPdf, type UeOfferView } from "@/lib/work-orders.functions";
import { ChevronRight, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ue/")({
  component: () => (
    <RequireAuth>
      <UeHome />
    </RequireAuth>
  ),
});

interface JobRow {
  id: string;
  address: string | null;
  status: "ej_paborjad" | "pagaende" | "klar";
  fixed_price: number | null;
}

const kr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
const time = (iso: string) => new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
const STATUS = { ej_paborjad: "Ej påbörjad", pagaende: "Pågående", klar: "Klar" } as const;

function UeHome() {
  const { user } = useAuth();
  const offersFn = useServerFn(listMyOffers);
  const respond = useServerFn(respondToMyOffer);
  const pdf = useServerFn(getWorkOrderPdf);
  const [offers, setOffers] = useState<UeOfferView[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setOffers((await offersFn({ data: undefined as never })).filter((o) => o.status === "pending"));
      if (user?.id) {
        const { data } = await supabase
          .from("jobs")
          .select("id, address, status, fixed_price")
          .eq("assigned_to", user.id)
          .order("created_at", { ascending: false });
        setJobs((data ?? []) as JobRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [offersFn, user?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (o: UeOfferView, action: "accept" | "decline") => {
    setBusy(o.offerId);
    try {
      const r = await respond({ data: { offerId: o.offerId, action, reason: reasons[o.offerId] } });
      if (!r.ok) {
        const e = r.error ?? "";
        toast.error(e.startsWith("requirements:") ? "Dina krav är inte kompletta (försäkring, F-skatt, avtal, ID06). Kontakta VT6 Invest." : e);
      } else {
        toast.success(action === "accept" ? "Uppdraget är accepterat" : "Tack för svaret");
        await load();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Något gick fel");
    } finally {
      setBusy(null);
    }
  };

  const download = async (id: string) => {
    const r = await pdf({ data: { workOrderId: id } });
    const a = document.createElement("a");
    a.href = `data:application/pdf;base64,${r.base64}`;
    a.download = r.fileName;
    a.click();
  };

  return (
    <AppShell title="Mina jobb">
      <div className="mx-auto max-w-2xl space-y-4">
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}

        {offers.map((o) => (
          <Card key={o.offerId} className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Nytt uppdrag: {o.content.address}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                Fast pris: <b>{kr(o.fixedPrice)}</b> (exkl. moms) · svara senast <b>{time(o.expiresAt)}</b>
              </div>
              {o.content.scope.length > 0 && (
                <ul className="list-inside list-disc text-muted-foreground">
                  {o.content.scope.map((s) => (
                    <li key={s.label}>
                      {s.label}: {s.quantity} {s.unit}
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-muted-foreground">
                Kontakt: {[o.content.contact.name, o.content.contact.phone].filter(Boolean).join(", ")}
              </div>
              <Button size="sm" variant="outline" onClick={() => void download(o.workOrderId)}>
                <FileDown className="mr-1 h-4 w-4" /> Arbetsorder (PDF, sv + en)
              </Button>
              <Button className="w-full" size="lg" disabled={busy === o.offerId} onClick={() => void answer(o, "accept")}>
                Acceptera till fast pris
              </Button>
              <Input
                placeholder="Anledning om du avböjer (valfritt)"
                value={reasons[o.offerId] ?? ""}
                onChange={(e) => setReasons({ ...reasons, [o.offerId]: e.target.value })}
              />
              <Button className="w-full" variant="outline" disabled={busy === o.offerId} onClick={() => void answer(o, "decline")}>
                Avböj
              </Button>
            </CardContent>
          </Card>
        ))}

        {!loading && jobs.length === 0 && offers.length === 0 && (
          <p className="text-sm text-muted-foreground">Inga jobb eller uppdrag just nu.</p>
        )}

        {jobs.map((j) => (
          <Link key={j.id} to="/ue/$jobId" params={{ jobId: j.id }}>
            <Card className="mb-2">
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <div className="font-medium">{j.address ?? "Jobb"}</div>
                  <div className="text-xs text-muted-foreground">{j.fixed_price != null ? kr(Number(j.fixed_price)) : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={j.status === "klar" ? "default" : "secondary"}>{STATUS[j.status]}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
