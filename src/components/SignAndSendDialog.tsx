import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/SignaturePad";
import { createSigningRequest } from "@/lib/signing.functions";
import { Copy, Loader2, PenTool } from "lucide-react";
import { toast } from "sonner";

interface SignAndSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBase64: string | null;
  offerNumber: string;
  customerName: string;
  customerEmail: string;
  leadId?: string | null;
  totalAmount?: number | null;
  defaultSignerName?: string;
  onCreated?: () => void;
}

export function SignAndSendDialog({
  open,
  onOpenChange,
  pdfBase64,
  offerNumber,
  customerName,
  customerEmail,
  leadId,
  totalAmount,
  defaultSignerName,
  onCreated,
}: SignAndSendDialogProps) {
  const create = useServerFn(createSigningRequest);
  const [signerName, setSignerName] = useState(defaultSignerName ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [email, setEmail] = useState(customerEmail);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(customerEmail);
      setLink(null);
      setSignerName((v) => v || defaultSignerName || "");
    }
  }, [open, customerEmail, defaultSignerName]);

  const submit = async () => {
    if (!pdfBase64) return toast.error("Generera PDF först");
    if (!signature) return toast.error("Rita eller skriv din signatur");
    if (signerName.trim().length < 2) return toast.error("Ange namnförtydligande");
    if (place.trim().length < 2) return toast.error("Ange ort");
    if (sendEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return toast.error("Ange kundens e-postadress");
    setBusy(true);
    try {
      const res = await create({
        data: {
          pdfBase64,
          offerNumber,
          customerName,
          customerEmail: email.trim(),
          leadId: leadId ?? null,
          totalAmount: totalAmount ?? null,
          companySignerName: signerName.trim(),
          companySignaturePng: signature,
          companyPlace: place.trim(),
          companyDate: date,
          sendEmail,
        },
      });
      setLink(res.url);
      toast.success(res.emailed ? "Signeringslänk skickad till kunden" : "Signeringslänk skapad");
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte skapa signeringslänk");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            Signera och skicka till kund
          </DialogTitle>
          <DialogDescription>
            Du signerar först. Kunden får en länk, verifierar sig med en engångskod och signerar –
            sedan får båda parter ett exemplar med båda signaturerna.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Signeringslänk</Label>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Länk kopierad");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Länken är giltig i 30 dagar. Du kan skicka den via SMS eller mejl.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <SignaturePad
              name={signerName}
              onNameChange={setSignerName}
              onSignatureChange={setSignature}
              label="Din signatur (för RoslagsTak)"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ort</Label>
                <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Norrtälje" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Datum</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kundens e-post</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kund@exempel.se" />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(Boolean(v))} />
              Skicka signeringslänken med e-post direkt
            </label>
          </div>
        )}

        <DialogFooter>
          {link ? (
            <Button onClick={() => onOpenChange(false)}>Klart</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Signera & skapa länk
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
