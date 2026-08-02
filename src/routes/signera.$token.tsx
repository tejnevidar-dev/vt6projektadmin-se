import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/SignaturePad";
import { CheckCircle2, FileText, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signera/$token")({
  head: () => ({
    meta: [
      { title: "Signera offert – RoslagsTak" },
      { name: "description", content: "Granska och signera din offert digitalt med e-postverifiering." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Signera offert – RoslagsTak" },
      { property: "og:description", content: "Granska och signera din offert digitalt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SigneraPage,
});

interface SignInfo {
  offerNumber: string;
  customerName: string;
  emailMasked: string;
  companySigner: string;
  companyPlace: string;
  companyDate: string;
  totalAmount: number | null;
  status: string;
  signedAt: string | null;
  otpSent: boolean;
  pdfUrl: string | null;
}

const ERROR_TEXT: Record<string, string> = {
  wrong_code: "Fel kod. Försök igen.",
  code_expired: "Koden har gått ut – begär en ny.",
  too_many_attempts: "För många försök. Begär en ny kod.",
  no_code_requested: "Begär en kod först.",
  too_soon: "Vänta någon minut innan du begär en ny kod.",
  expired: "Signeringslänken har gått ut.",
  already_signed: "Offerten är redan signerad.",
  cancelled: "Signeringen har avbrutits.",
  invalid_signature: "Signaturen saknas eller är för stor.",
  invalid_name: "Ange ditt namn.",
  invalid_place: "Ange ort.",
  invalid_code_format: "Koden består av 6 siffror.",
};

function fmtSek(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
}

function SigneraPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<SignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/sign/${token}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = (await res.json()) as SignInfo;
      setInfo(data);
      setCodeSent(data.otpSent);
      setName((prev) => prev || data.customerName || "");
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/public/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const key = String(json?.error ?? "").split(":")[0];
      throw new Error(ERROR_TEXT[key] ?? "Något gick fel. Försök igen.");
    }
    return json;
  };

  const requestCode = async () => {
    setBusy(true);
    try {
      await post({ action: "request-otp" });
      setCodeSent(true);
      toast.success(`Kod skickad till ${info?.emailMasked ?? "din e-post"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte skicka kod");
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (!signature) return toast.error("Rita eller skriv din signatur");
    if (name.trim().length < 2) return toast.error("Ange namnförtydligande");
    if (place.trim().length < 2) return toast.error("Ange ort");
    if (!/^\d{6}$/.test(code.trim())) return toast.error("Ange den 6-siffriga koden");
    setBusy(true);
    try {
      const res = await post({
        action: "sign",
        code: code.trim(),
        name: name.trim(),
        place: place.trim(),
        signaturePng: signature,
      });
      setDoneUrl(res?.pdfUrl ?? null);
      toast.success("Tack! Offerten är signerad.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte signera");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (notFound || !info) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Länken är ogiltig</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signeringslänken kunde inte hittas. Kontakta oss så skickar vi en ny.
          </p>
        </div>
      </main>
    );
  }

  const isSigned = info.status === "signed";
  const isExpired = info.status === "expired" || info.status === "cancelled";

  return (
    <main className="min-h-screen bg-muted/30 pb-16">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            RoslagsTak
          </span>
          <h1 className="text-2xl font-semibold">Signera offert {info.offerNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Signerad av {info.companySigner} ({info.companyPlace}, {info.companyDate})
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Offertdokument
            </CardTitle>
            {isSigned ? (
              <Badge className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Signerad
              </Badge>
            ) : isExpired ? (
              <Badge variant="destructive">Ej giltig</Badge>
            ) : (
              <Badge variant="secondary">Väntar på din signatur</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {info.totalAmount != null && (
              <p className="text-sm text-muted-foreground">
                Belopp: <span className="font-medium text-foreground">{fmtSek(info.totalAmount)}</span>
              </p>
            )}
            {info.pdfUrl ? (
              <>
                <div className="overflow-hidden rounded-md border border-border">
                  <object data={info.pdfUrl} type="application/pdf" className="h-[520px] w-full">
                    <p className="p-4 text-sm text-muted-foreground">
                      Kan inte visa PDF här.{" "}
                      <a className="underline" href={info.pdfUrl} target="_blank" rel="noreferrer">
                        Öppna dokumentet
                      </a>
                      .
                    </p>
                  </object>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={doneUrl ?? info.pdfUrl} target="_blank" rel="noreferrer">
                    Öppna / ladda ner PDF
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Dokumentet kunde inte laddas.</p>
            )}
          </CardContent>
        </Card>

        {isSigned ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <h2 className="text-lg font-semibold">Tack – offerten är signerad</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Ett signerat exemplar med båda parters signaturer har skickats till din e-post. Du kan
                även ladda ner det ovan.
              </p>
            </CardContent>
          </Card>
        ) : isExpired ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Den här signeringslänken är inte längre giltig. Kontakta oss så skickar vi en ny.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Signera med e-postverifiering
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <SignaturePad
                name={name}
                onNameChange={setName}
                onSignatureChange={setSignature}
                label="Din signatur"
              />

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ort</Label>
                <Input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="T.ex. Norrtälje"
                />
              </div>

              <div className="rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Engångskod till {info.emailMasked}</p>
                      <p className="text-xs text-muted-foreground">
                        Koden verifierar din identitet och är giltig i 15 minuter.
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={requestCode} disabled={busy}>
                    {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    {codeSent ? "Skicka ny kod" : "Skicka kod"}
                  </Button>
                </div>
                {codeSent && (
                  <div className="mt-4 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">6-siffrig kod</Label>
                    <Input
                      value={code}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      className="max-w-[180px] text-lg tracking-[0.4em]"
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                )}
              </div>

              <Button className="w-full" size="lg" onClick={sign} disabled={busy || !codeSent}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Signera offerten
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Genom att signera godkänner du offertens innehåll och villkor. Signeringstidpunkt, IP och
                e-postverifiering registreras som signeringsbevis i dokumentet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
