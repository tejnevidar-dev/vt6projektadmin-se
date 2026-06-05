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
  initialTemplateKey?: string;
  lockTemplate?: boolean;
  onSaved: () => void;
}

type ImagesByField = Record<string, SelfCheckImage[]>;

const LEGACY_IMAGE_BUCKET = "__övrigt";

export function SelfCheckDialog({ open, onOpenChange, jobId, existing, initialTemplateKey, lockTemplate, onSaved }: Props) {
  const [templateKey, setTemplateKey] = useState<string>(
    existing?.template_key ?? initialTemplateKey ?? SELF_CHECK_TEMPLATES[0].key
  );
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [imagesByField, setImagesByField] = useState<ImagesByField>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTemplateKey(existing.template_key);
      const d = { ...((existing.data as Record<string, unknown>) ?? {}) };
      const byField = (d.imagesByField as ImagesByField | undefined) ?? {};
      const legacy = (d.images as SelfCheckImage[] | undefined) ?? [];
      const merged: ImagesByField = { ...byField };
      if (legacy.length > 0) {
        merged[LEGACY_IMAGE_BUCKET] = [
          ...(merged[LEGACY_IMAGE_BUCKET] ?? []),
          ...legacy,
        ];
      }
      setImagesByField(merged);
      delete d.imagesByField;
      delete d.images;
      setValues(d);
    } else {
      setTemplateKey(initialTemplateKey ?? SELF_CHECK_TEMPLATES[0].key);
      setValues({});
      setImagesByField({});
    }
  }, [open, existing, initialTemplateKey]);

  const template: SelfCheckTemplate | undefined = getSelfCheckTemplate(templateKey);
  const readOnly = !!existing?.completed_at;
  const totalImages = Object.values(imagesByField).reduce((n, arr) => n + arr.length, 0);

  async function handleSave(submit: boolean) {
    if (!template) return;
    if (submit) {
      for (const f of template.fields) {
        if (f.required && !values[f.label]) {
          toast.error(`"${f.label}" måste fyllas i innan inlämning`);
          return;
        }
      }
      if (template.requiresImages && totalImages === 0) {
        toast.error("Du måste ladda upp minst en bild innan inlämning");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...values, imagesByField };
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

  async function addImagesToField(fieldLabel: string, files: FileList | null) {
    if (!files || files.length === 0) return;
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
      setImagesByField((prev) => ({
        ...prev,
        [fieldLabel]: [...(prev[fieldLabel] ?? []), ...uploaded],
      }));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function removeImage(fieldLabel: string, path: string) {
    try {
      await deleteSelfCheckImage(path);
      setImagesByField((prev) => ({
        ...prev,
        [fieldLabel]: (prev[fieldLabel] ?? []).filter((i) => i.path !== path),
      }));
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

          {template?.requiresImages && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              För denna mall krävs minst en uppladdad bild innan inlämning. Lägg bilderna på rätt
              moment nedan så går det snabbt att hitta dem senare.
            </div>
          )}

          <div className="space-y-3">
            {template?.fields.map((f) => (
              <FieldRow
                key={f.label}
                field={f}
                value={values[f.label]}
                onChange={(val) => setValues((v) => ({ ...v, [f.label]: val }))}
                images={imagesByField[f.label] ?? []}
                onAddImages={(files) => addImagesToField(f.label, files)}
                onRemoveImage={(path) => removeImage(f.label, path)}
                readOnly={readOnly}
              />
            ))}

            {(imagesByField[LEGACY_IMAGE_BUCKET]?.length ?? 0) > 0 && (
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-sm font-medium">Övriga bilder</div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Bilder från tidigare uppladdningar utan kopplat moment.
                </p>
                <ImageList
                  images={imagesByField[LEGACY_IMAGE_BUCKET] ?? []}
                  readOnly={readOnly}
                  onRemove={(p) => removeImage(LEGACY_IMAGE_BUCKET, p)}
                />
              </div>
            )}
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

function FieldRow({
  field,
  value,
  onChange,
  images,
  onAddImages,
  onRemoveImage,
  readOnly,
}: {
  field: { label: string; type: "checkbox" | "text" | "textarea"; instruction?: string };
  value: unknown;
  onChange: (v: unknown) => void;
  images: SelfCheckImage[];
  onAddImages: (files: FileList | null) => void;
  onRemoveImage: (path: string) => void;
  readOnly: boolean;
}) {
  const instructionNode = field.instruction ? (
    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{field.instruction}</p>
  ) : null;

  const imageAttachments = (
    <ImageAttachments
      fieldLabel={field.label}
      images={images}
      onAddImages={onAddImages}
      onRemoveImage={onRemoveImage}
      readOnly={readOnly}
    />
  );

  if (field.type === "checkbox") {
    return (
      <div className="rounded-md border border-border bg-card p-3 text-sm">
        <label className="flex items-start gap-3">
          <Checkbox
            className="mt-0.5"
            checked={!!value}
            disabled={readOnly}
            onCheckedChange={(c) => onChange(c === true)}
          />
          <span className="flex-1">
            <span className="font-medium">{field.label}</span>
            {instructionNode}
          </span>
        </label>
        {imageAttachments}
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="rounded-md border border-border bg-card p-3">
        <Label className="font-medium">{field.label}</Label>
        {instructionNode}
        <Textarea
          rows={3}
          className="mt-1"
          value={(value as string) ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
        {imageAttachments}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <Label className="font-medium">{field.label}</Label>
      {instructionNode}
      <Input
        className="mt-1"
        value={(value as string) ?? ""}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
      {imageAttachments}
    </div>
  );
}

function ImageAttachments({
  fieldLabel,
  images,
  onAddImages,
  onRemoveImage,
  readOnly,
}: {
  fieldLabel: string;
  images: SelfCheckImage[];
  onAddImages: (files: FileList | null) => void;
  onRemoveImage: (path: string) => void;
  readOnly: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const inputId = `imgs-${fieldLabel.replace(/\s+/g, "-")}`;

  async function handle(files: FileList | null) {
    setUploading(true);
    try {
      await onAddImages(files);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 border-t border-dashed border-border pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Bilder ({images.length})
        </span>
        {!readOnly && (
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-accent"
          >
            <Upload className="h-3 w-3" />
            {uploading ? "Laddar upp..." : "Lägg till bild"}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void handle(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {images.length > 0 && (
        <ImageList images={images} readOnly={readOnly} onRemove={onRemoveImage} />
      )}
    </div>
  );
}

function ImageList({
  images,
  readOnly,
  onRemove,
}: {
  images: SelfCheckImage[];
  readOnly: boolean;
  onRemove: (path: string) => void;
}) {
  return (
    <ul className="mt-1.5 space-y-1">
      {images.map((img) => (
        <SelfCheckImageRow
          key={img.path}
          image={img}
          readOnly={readOnly}
          onRemove={() => onRemove(img.path)}
        />
      ))}
    </ul>
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
    <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
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
