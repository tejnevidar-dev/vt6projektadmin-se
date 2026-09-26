import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";
import { WO_TEXT, validateAcceptance, type Lang, type Personnel } from "@/lib/work-order";

export interface AcceptancePayload {
  termsAccepted: boolean;
  acceptedBy: string;
  personnel: Personnel[];
}

interface Props {
  lang: Lang;
  terms: string[];
  frameworkUrl: string | null;
  busy: boolean;
  onAccept: (payload: AcceptancePayload) => void;
  onDecline: (reason: string) => void;
  defaultName?: string;
}

const ERR: Record<string, string> = {
  terms_required: "Du måste kryssa i att du accepterar villkoren. / You must accept the terms.",
  name_required: "Ange ditt namn. / Enter your name.",
  personnel_required: "Ange minst en person på plats. / Add at least one person on site.",
  personnel_status_invalid: "Ange status för varje person. / Select a status for each person.",
};

/** Villkorsruta, obligatorisk kryssruta, personal på plats och accept/avböj. Delas av acceptsidan och UE-vyn. */
export function WorkOrderAcceptForm({ lang, terms, frameworkUrl, busy, onAccept, onDecline, defaultName }: Props) {
  const t = WO_TEXT[lang];
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [people, setPeople] = useState<Personnel[]>([{ name: "", status: "employee" }]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    const payload = { termsAccepted: checked, acceptedBy: name, personnel: people.filter((p) => p.name.trim()) };
    const bad = validateAcceptance(payload);
    if (bad) return setError(ERR[bad] ?? bad);
    setError(null);
    onAccept(payload);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-xs">
        <div className="mb-1 text-sm font-semibold">{t.termsTitle}</div>
        <ul className="list-inside list-disc space-y-1">
          {terms.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {frameworkUrl && (
          <a className="mt-2 inline-block text-primary underline" href={frameworkUrl} target="_blank" rel="noreferrer">
            {t.frameworkLink}
          </a>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{t.personnel}</Label>
        {people.map((p, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder={t.personName}
              value={p.name}
              onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={p.status}
              onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, status: e.target.value as Personnel["status"] } : x)))}
            >
              <option value="employee">{t.employee}</option>
              <option value="self_employed">{t.selfEmployed}</option>
            </select>
            {people.length > 1 && (
              <Button type="button" size="icon" variant="ghost" onClick={() => setPeople(people.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setPeople([...people, { name: "", status: "employee" }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> {t.addPerson}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t.yourName}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
        <span>{t.termsCheckbox}</span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" size="lg" disabled={busy} onClick={accept}>
        {t.accept}
      </Button>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Anledning om du avböjer (valfritt) / Reason (optional)" />
      <Button className="w-full" variant="outline" disabled={busy} onClick={() => onDecline(reason)}>
        {t.decline}
      </Button>
    </div>
  );
}
