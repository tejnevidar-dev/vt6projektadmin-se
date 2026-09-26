import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AtaCard } from "@/components/AtaCard";
import { PhotoGalleryCard } from "@/components/PhotoGalleryCard";
import { SelfCheckDialog } from "@/components/SelfCheckDialog";
import { supabase } from "@/integrations/supabase/client";
import { listJobPhotos } from "@/lib/job-photos-api";
import { listSelfChecks, updateJobStatus, type SelfCheck } from "@/lib/jobs-api";
import { getWorkOrderPdf } from "@/lib/work-orders.functions";
import { ArrowLeft, CheckCircle2, Circle, ClipboardCheck, FileDown, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ue/$jobId")({
  component: () => (
    <RequireAuth>
      <UeJobPage />
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

function UeJobPage() {
  const { jobId } = useParams({ from: "/ue/$jobId" });
  const pdf = useServerFn(getWorkOrderPdf);
  const [job, setJob] = useState<JobRow | null>(null);
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);
  const [checks, setChecks] = useState<SelfCheck[]>([]);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<SelfCheck | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data: j } = await supabase.from("jobs").select("id, address, status, fixed_price").eq("id", jobId).maybeSingle();
    setJob((j as JobRow | null) ?? null);
    const { data: wo } = await (supabase as any).from("work_orders").select("id").eq("job_id", jobId).maybeSingle();
    setWorkOrderId(wo?.id ?? null);
    const photos = await listJobPhotos(jobId);
    setBefore(photos.filter((p) => p.phase === "fore").length);
    setAfter(photos.filter((p) => p.phase === "efter").length);
    setChecks(await listSelfChecks(jobId));
  }, [jobId]);

  useEffect(() => {
    void refresh();
    // Fotokortet har ingen återanropning, så räknarna uppdateras med jämna mellanrum.
    const t = setInterval(() => void refresh(), 8000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!job) {
    return (
      <AppShell title="Jobb">
        <Loader2 className="h-5 w-5 animate-spin" />
      </AppShell>
    );
  }

  const checkDone = checks.some((c) => !!c.completed_at);
  const canFinish = before > 0 && after > 0 && checkDone;

  const setStatus = async (status: "pagaende" | "klar") => {
    setBusy(true);
    try {
      await updateJobStatus(job.id, status);
      toast.success(status === "klar" ? "Jobbet är markerat som klart" : "Jobbet är påbörjat");
      await refresh();
    } catch (e: any) {
      const m = String(e?.message ?? "");
      toast.error(m.includes("KLART_KRAV") ? m.replace(/^.*KLART_KRAV:\s*/, "") : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!workOrderId) return;
    const r = await pdf({ data: { workOrderId } });
    const a = document.createElement("a");
    a.href = `data:application/pdf;base64,${r.base64}`;
    a.download = r.fileName;
    a.click();
  };

  const Item = ({ ok, text }: { ok: boolean; text: string }) => (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      {text}
    </li>
  );

  return (
    <AppShell title={job.address ?? "Jobb"}>
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/ue">
            <ArrowLeft className="mr-1 h-4 w-4" /> Mina jobb
          </Link>
        </Button>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Badge>{job.status === "klar" ? "Klar" : job.status === "pagaende" ? "Pågående" : "Ej påbörjad"}</Badge>
            {job.fixed_price != null && <span className="text-sm">Fast pris: <b>{kr(Number(job.fixed_price))}</b></span>}
            {workOrderId && (
              <Button size="sm" variant="outline" onClick={() => void download()}>
                <FileDown className="mr-1 h-4 w-4" /> Arbetsorder (PDF)
              </Button>
            )}
            {job.address && (
              <Button size="sm" variant="outline" asChild>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">
                  Vägbeskrivning
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Innan du kan markera klart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5">
              <Item ok={before > 0} text={`Foto före arbetet (${before})`} />
              <Item ok={after > 0} text={`Foto efter arbetet (${after})`} />
              <Item ok={checkDone} text="Egenkontroll slutförd" />
            </ul>
            {job.status === "ej_paborjad" && (
              <Button className="w-full" size="lg" disabled={busy} onClick={() => void setStatus("pagaende")}>
                <Play className="mr-2 h-4 w-4" /> Starta jobbet
              </Button>
            )}
            {job.status === "pagaende" && (
              <Button className="w-full" size="lg" disabled={busy || !canFinish} onClick={() => void setStatus("klar")}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Klart
              </Button>
            )}
          </CardContent>
        </Card>

        <PhotoGalleryCard jobId={job.id} canManage />

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Egenkontroll</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDlgOpen(true);
              }}
            >
              <ClipboardCheck className="mr-1 h-4 w-4" /> Ny egenkontroll
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {checks.length === 0 && <p className="text-sm text-muted-foreground">Ingen egenkontroll ännu.</p>}
            {checks.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>
                  {c.template_key} · {c.completed_at ? "slutförd" : "utkast"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(c);
                    setDlgOpen(true);
                  }}
                >
                  {c.completed_at ? "Visa" : "Fortsätt"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <AtaCard jobId={job.id} isAdmin={false} canCreate={job.status === "pagaende"} forceApproval />
      </div>

      <SelfCheckDialog open={dlgOpen} onOpenChange={setDlgOpen} jobId={job.id} existing={editing} onSaved={() => void refresh()} />
    </AppShell>
  );
}
