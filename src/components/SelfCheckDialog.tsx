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
import { Video, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  SELF_CHECK_TEMPLATES,
  getSelfCheckTemplate,
  type SelfCheckTemplate,
} from "@/lib/self-check-templates";
import {
  createSelfCheck,
  updateSelfCheck,
  uploadSelfCheckImage,
  deleteSelfCheckImage,
  getSelfCheckImageUrl,
  type SelfCheck,
  type SelfCheckImage,
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
  const [images, setImages] = useState<SelfCheckImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTemplateKey(existing.template_key);
      const d = (existing.data as Record<string, unknown>) ?? {};
      const imgs = (d.images as SelfCheckImage[] | undefined) ?? [];
      setImages(imgs);
      const { images: _omit, ...rest } = d as Record<string, unknown>;
      setValues(rest);
    } else {
      setTemplateKey(SELF_CHECK_TEMPLATES[0].key);
      setValues({});
      setImages([]);
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
      if (template.requiresImages && images.length === 0) {
        toast.error("Du måste ladda upp minst en bild innan inlämning");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...values, images };
      if (existing) {
        await updateSelfCheck(existing.id, { data: payload, submit });
      } else {
        await createSelfCheck({
          job_id: jobId,
          template_key: templateKey,
          data: payload,
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

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: SelfCheckImage[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name} är inte en bildfil`);
          continue;
        }
        const img = await uploadSelfCheckImage(jobId, f);
        uploaded.push(img);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(path: string) {
    try {
      await deleteSelfCheckImage(path);
      setImages((prev) => prev.filter((i) => i.path !== path));
    } catch (e: any) {
      toast.error(e.message);
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

          {template?.instructions && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm leading-relaxed">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Instruktion
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{template.instructions}</p>
              {template.videoUrl && (
                <a
                  href={template.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Video className="h-3.5 w-3.5" />
                  {template.videoLabel ?? "Se instruktionsvideo"}
                </a>
              )}
            </div>
          )}

          <div className="space-y-3">
            {template?.fields.map((f) => {
              const val = values[f.label];
              const instructionNode = f.instruction ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.instruction}
                </p>
              ) : null;

              if (f.type === "checkbox") {
                return (
                  <label
                    key={f.label}
                    className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={!!val}
                      disabled={readOnly}
                      onCheckedChange={(c) =>
                        setValues((v) => ({ ...v, [f.label]: c === true }))
                      }
                    />
                    <span className="flex-1">
                      <span className="font-medium">{f.label}</span>
                      {instructionNode}
                    </span>
                  </label>
                );
              }
              if (f.type === "textarea") {
                return (
                  <div key={f.label}>
                    <Label>{f.label}</Label>
                    {instructionNode}
                    <Textarea
                      rows={3}
                      className="mt-1"
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
                  {instructionNode}
                  <Input
                    className="mt-1"
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

          {template?.requiresImages && (
            <div className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Bilder (obligatoriskt)</div>
                  <p className="text-xs text-muted-foreground">
                    Ladda upp minst en bild som dokumenterar arbetet.
                  </p>
                </div>
                {!readOnly && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Laddar upp..." : "Lägg till"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              {images.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {images.map((img) => (
                    <SelfCheckImageRow
                      key={img.path}
                      image={img}
                      readOnly={readOnly}
                      onRemove={() => removeImage(img.path)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Inga bilder uppladdade ännu.
                </p>
              )}
            </div>
          )}
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

function SelfCheckImageRow({
  image,
  readOnly,
  onRemove,
}: {
  image: SelfCheckImage;
  readOnly: boolean;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSelfCheckImageUrl(image.path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null));
    return () => {
      cancelled = true;
    };
  }, [image.path]);

  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs">
      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex-1 truncate text-foreground hover:underline"
        >
          {image.name}
        </a>
      ) : (
        <span className="flex-1 truncate text-muted-foreground">{image.name}</span>
      )}
      {!readOnly && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRemove}
          aria-label="Ta bort bild"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}
