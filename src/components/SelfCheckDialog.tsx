import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  SELF_CHECK_TEMPLATES,
  getSelfCheckTemplate,
  type SelfCheckTemplate,
} from "@/lib/self-check-templates";
import {
  createSelfCheck,
  updateSelfCheck,
  type SelfCheck,
} from "@/lib/jobs-api";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
  existing?: SelfCheck | null;
  onSaved: () => void;
}

export function SelfCheckDialog({ open, onOpenChange, jobId, existing, onSaved }: Props) {
  const [templateKey, setTemplateKey] = useState<string>(
    existing?.template_key ?? SELF_CHECK_TEMPLATES[0].key
  );
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTemplateKey(existing.template_key);
      setValues((existing.data as Record<string, unknown>) ?? {});
    } else {
      setTemplateKey(SELF_CHECK_TEMPLATES[0].key);
      setValues({});
    }
  }, [open, existing]);

  const template: SelfCheckTemplate | undefined = getSelfCheckTemplate(templateKey);
  const readOnly = !!existing?.completed_at;

  async function handleSave(submit: boolean) {
    if (!template) return;
    if (submit) {
      for (const f of template.fields) {
        if (f.required && !values[f.label]) {
          toast.error(`"${f.label}" måste fyllas i innan inlämning`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      if (existing) {
        await updateSelfCheck(existing.id, { data: values, submit });
      } else {
        await createSelfCheck({
          job_id: jobId,
          template_key: templateKey,
          data: values,
          submit,
        });
      }
      toast.success(submit ? "Egenkontroll inlämnad" : "Utkast sparat");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Egenkontroll" : "Ny egenkontroll"}
            {readOnly && " (inlämnad)"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!existing && (
            <div>
              <Label>Mall</Label>
              <Select value={templateKey} onValueChange={setTemplateKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELF_CHECK_TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {template?.description && (
                <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
              )}
            </div>
          )}

          {existing && template && (
            <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              Mall: <strong className="text-foreground">{template.name}</strong>
            </div>
          )}

          <div className="space-y-3">
            {template?.fields.map((f) => {
              const val = values[f.label];
              if (f.type === "checkbox") {
                return (
                  <label
                    key={f.label}
                    className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5 text-sm"
                  >
                    <Checkbox
                      checked={!!val}
                      disabled={readOnly}
                      onCheckedChange={(c) =>
                        setValues((v) => ({ ...v, [f.label]: c === true }))
                      }
                    />
                    <span>{f.label}</span>
                  </label>
                );
              }
              if (f.type === "textarea") {
                return (
                  <div key={f.label}>
                    <Label>{f.label}</Label>
                    <Textarea
                      rows={3}
                      value={(val as string) ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.label]: e.target.value }))
                      }
                    />
                  </div>
                );
              }
              return (
                <div key={f.label}>
                  <Label>{f.label}</Label>
                  <Input
                    value={(val as string) ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.label]: e.target.value }))
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Stäng" : "Avbryt"}
          </Button>
          {!readOnly && (
            <>
              <Button variant="secondary" disabled={saving} onClick={() => handleSave(false)}>
                Spara utkast
              </Button>
              <Button disabled={saving} onClick={() => handleSave(true)}>
                Lämna in
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
