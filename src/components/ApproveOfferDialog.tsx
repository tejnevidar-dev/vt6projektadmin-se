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
import { SignaturePad } from "@/components/SignaturePad";
import {
  approveSigningRequest,
  rejectSigningRequest,
  type SigningRequestRow,
} from "@/lib/signing.functions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SigningRequestRow | null;
  /** "approve": rita bolagets signatur första gången. "reject": ange anledning. */
  mode: "approve" | "reject";
  defaultSignerName?: string;
  onDone: () => void;
}

/** Godkänn en säljares offert (första gången: rita bolagets signatur) eller avslå den. */
export function ApproveOfferDialog({ open, onOpenChange, row, mode, defaultSignerName, onDone }: Props) {
  const approve = useServerFn(approveSigningRequest);
  const reject = useServerFn(rejectSigningRequest);
  const [name, setName] = useState(defaultSignerName ?? "");
  const [place, setPlace] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setSignature(null);
      setName((v) => v || defaultSignerName || "");
    }
  }, [open, defaultSignerName]);

  if (!row) return null;

  const submitApprove = async () => {
    if (!signature) return toast.error("Rita eller skriv signaturen");
    if (name.trim().length < 2) return toast.error("Ange namnförtydligande");
    if (place.trim().length < 2) return toast.error("Ange ort");
    setBusy(true);
    try {
      const res = await approve({
        data: { id: row.id, signerName: name.trim(), place: place.trim(), signaturePng: signature },
      });
      toast.success(res.emailed ? "Godkänd och skickad till kunden" : "Godkänd (mejlet kunde inte skickas, kopiera länken)");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte godkänna");
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    setBusy(true);
    try {
      await reject({ data: { id: row.id, reason } });
      toast.success("Offerten avslogs och säljaren har fått besked");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte avslå");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "approve" ? "Rita bolagets signatur" : "Avslå offert"} – {row.offer_number}
          </DialogTitle>
          <DialogDescription>
            {row.customer_name}
            {row.created_by_name ? ` · skapad av ${row.created_by_name}` : ""}
            {mode === "approve"
              ? ". Signaturen sparas och används vid alla framtida godkännanden med ett klick."
              : ". Säljaren får ett besked i klockan och per mejl. Kunden får ingenting."}
          </DialogDescription>
        </DialogHeader>

        {mode === "approve" ? (
          <div className="space-y-4">
            <SignaturePad
              name={name}
              onNameChange={setName}
              onSignatureChange={setSignature}
              label="Bolagets signatur"
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ort</Label>
              <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Norrtälje" />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Anledning (visas för säljaren, valfritt)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="T.ex. priset är för lågt" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          {mode === "approve" ? (
            <Button onClick={submitApprove} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Godkänn & skicka
            </Button>
          ) : (
            <Button variant="destructive" onClick={submitReject} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Avslå
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
