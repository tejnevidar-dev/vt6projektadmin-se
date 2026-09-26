import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { WorkOrderAcceptForm, type AcceptancePayload } from "@/components/WorkOrderAcceptForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { WO_TEXT, type Lang, type WorkOrderContent } from "@/lib/work-order";

export const Route = createFileRoute("/arbetsorder/$token")({
  head: () => ({
    meta: [
      { title: "Arbetsorder / Work order – VT6 Invest" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkOrderPage,
});

interface Info {
  status: string;
  workOrderStatus: string;
  fixedPrice: number;
  expiresAt: string;
  startDate: string | null;
  endDate: string | null;
  orderNumber: string | null;
  subcontractor: { name: string; orgNumber: string | null } | null;
  frameworkUrl: string | null;
  terms: { sv: string[]; en: string[] };
  content: WorkOrderContent;
  attachments: { name: string; url: string }[];
}

const fmtKr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(iso));

const ERR: Record<string, string> = {
  terms_required: "Du måste kryssa i villkoren. / You must accept the terms.",
  name_required: "Ange ditt namn. / Enter your name.",
  personnel_required: "Ange minst en person på plats. / Add at least one person.",
  already_answered: "Du har redan svarat på det här uppdraget. / You have already answered.",
  expired: "Tiden för att svara har gått ut. / The reply time has expired.",
  closed: "Uppdraget är inte längre tillgängligt. / The assignment is no longer available.",
  not_found: "Länken hittades inte. / Link not found.",
};

function WorkOrderPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang] = useState<Lang>("sv");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/public/work-order/${token}`);
    if (res.status === 404) setNotFound(true);
    else setInfo(await res.json());
    setLoading(false);
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (action: "accept" | "decline", reason = "", acceptance?: AcceptancePayload) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/public/work-order/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, ...(acceptance ?? {}) }),
      });
      const j = await res.json();
      if (!res.ok) {
        const key = String(j.error ?? "");
        toast.error(key.startsWith("requirements:") ? "Dina krav (försäkring, F-skatt, avtal, ID06) är inte kompletta. Kontakta VT6 Invest." : (ERR[key] ?? key));
        return;
      }
      setDone(j.status);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;
  if (notFound || !info) return <Center>{ERR.not_found}</Center>;

  const t = WO_TEXT[lang];
  const c = info.content;
  const open = info.status === "pending" && info.workOrderStatus === "offered";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {t.title}
          {info.orderNumber ? ` ${info.orderNumber}` : ""}
        </h1>
        <div className="flex gap-1">
          {(["sv", "en"] as Lang[]).map((l) => (
            <Button key={l} size="sm" variant={lang === l ? "default" : "outline"} onClick={() => setLang(l)}>
              {l === "sv" ? "Svenska" : "English"}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t.from}
        {info.subcontractor ? ` · ${t.subcontractor}: ${info.subcontractor.name}${info.subcontractor.orgNumber ? ` (${t.orgNo} ${info.subcontractor.orgNumber})` : ""}` : ""}
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{c.address}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label={t.price} value={<b>{fmtKr(info.fixedPrice)}</b>} />
          {info.startDate && <Row label={t.start} value={info.startDate} />}
          {info.endDate && <Row label={t.end} value={info.endDate} />}
          {c.storeys && <Row label={t.storeys} value={c.storeys} />}
          {c.pitch && <Row label={t.pitch} value={c.pitch} />}
          {c.roof_area_kvm && <Row label={t.area} value={`${c.roof_area_kvm} m²`} />}
          <List title={t.standardTasks} none={t.none} items={(c.standard_tasks ?? []).map((k) => t[`task_${k}`] ?? k)} />
          <List title={t.scope} none={t.none} items={c.scope.map((s) => `${s.label}: ${s.quantity} ${s.unit}`)} />
          <List title={t.materials} none={t.none} items={c.materials.map((s) => `${s.label}: ${s.quantity} ${s.unit}`)} />
          {c.material_delivery_date && <Row label={t.materialDelivery} value={c.material_delivery_date} />}
          <Row label={t.contact} value={[c.contact.name, c.contact.phone, c.contact.email].filter(Boolean).join(" · ")} />
          {info.attachments.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground">{t.attachments}</div>
              <ul className="list-inside list-disc">
                {info.attachments.map((a) => (
                  <li key={a.url}>
                    <a className="text-primary underline" href={a.url} target="_blank" rel="noreferrer">
                      {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.notes && <Row label={t.notes} value={<span className="whitespace-pre-wrap">{c.notes}</span>} />}
          <Button variant="outline" asChild>
            <a href={`/api/public/work-order/${token}?pdf=1`} target="_blank" rel="noreferrer">
              <FileText className="mr-2 h-4 w-4" /> PDF (sv + en)
            </a>
          </Button>
        </CardContent>
      </Card>

      {done ? (
        <Card>
          <CardContent className="flex items-center gap-2 pt-6">
            {done === "accepted" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5" />}
            {done === "accepted"
              ? "Tack, uppdraget är accepterat. / Thank you, the assignment is accepted."
              : "Tack för svaret. / Thank you for your reply."}
          </CardContent>
        </Card>
      ) : open ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm">
              {t.valid}: <b>{fmtTime(info.expiresAt)}</b>. {t.binding}
            </p>
            <WorkOrderAcceptForm
              lang={lang}
              terms={info.terms[lang]}
              frameworkUrl={info.frameworkUrl}
              busy={busy}
              onAccept={(p) => void respond("accept", "", p)}
              onDecline={(r) => void respond("decline", r)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Badge variant="secondary">{info.status}</Badge>{" "}
            {info.status === "accepted" ? "Uppdraget är accepterat. / Accepted." : (ERR[info.status] ?? ERR.closed)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-sm">{children}</div>;
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
function List({ title, items, none }: { title: string; items: string[]; none: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{title}</div>
      {items.length ? (
        <ul className="list-inside list-disc">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : (
        <div>{none}</div>
      )}
    </div>
  );
}
