import { useEffect, useState } from "react";
import { Check, X, Image as ImageIcon } from "lucide-react";
import { getSelfCheckImageUrl } from "@/lib/jobs-api";
import { SELF_CHECK_TEMPLATES } from "@/lib/self-check-templates";

interface SelfCheckImage {
  name: string;
  path: string;
  uploadedAt?: string;
}
type ImagesByField = Record<string, SelfCheckImage[]>;

const LEGACY_IMAGE_BUCKET = "Övriga bilder";

export function SelfCheckDataView({
  templateKey,
  data,
}: {
  templateKey: string;
  data: Record<string, any>;
}) {
  const tpl = SELF_CHECK_TEMPLATES.find((t) => t.key === templateKey);
  const raw = { ...(data ?? {}) };
  const imagesByField: ImagesByField = { ...((raw.imagesByField as ImagesByField) ?? {}) };
  const legacy = (raw.images as SelfCheckImage[] | undefined) ?? [];
  if (legacy.length) {
    imagesByField[LEGACY_IMAGE_BUCKET] = [
      ...(imagesByField[LEGACY_IMAGE_BUCKET] ?? []),
      ...legacy,
    ];
  }
  delete raw.imagesByField;
  delete raw.images;

  const fields = tpl?.fields ?? Object.keys(raw).map((label) => ({ label, type: "text" as const }));
  const extraKeys = Object.keys(raw).filter((k) => !fields.some((f) => f.label === k));
  const imageOnlyKeys = Object.keys(imagesByField).filter(
    (k) => !fields.some((f) => f.label === k) && (imagesByField[k]?.length ?? 0) > 0,
  );

  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <FieldRow
          key={f.label}
          label={f.label}
          value={raw[f.label]}
          images={imagesByField[f.label] ?? []}
        />
      ))}
      {extraKeys.map((k) => (
        <FieldRow key={k} label={k} value={raw[k]} images={imagesByField[k] ?? []} />
      ))}
      {imageOnlyKeys.map((k) => (
        <FieldRow key={k} label={k} value={undefined} images={imagesByField[k]} />
      ))}
      {fields.length === 0 && extraKeys.length === 0 && imageOnlyKeys.length === 0 && (
        <p className="text-xs text-muted-foreground">Ingen data inlämnad.</p>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  images,
}: {
  label: string;
  value: unknown;
  images: SelfCheckImage[];
}) {
  const isBool = typeof value === "boolean";
  const text =
    !isBool && value != null && String(value).trim() !== "" ? String(value) : null;
  if (!isBool && !text && images.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {isBool &&
          (value ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Godkänd
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Ej ibockad
            </span>
          ))}
      </div>
      {text && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{text}</p>}
      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((img) => (
            <Thumb key={img.path} image={img} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ image }: { image: SelfCheckImage }) {
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

  if (!url) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-md border border-border bg-muted/40">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title={image.name}>
      <img
        src={url}
        alt={image.name}
        loading="lazy"
        className="h-20 w-20 rounded-md border border-border object-cover transition-opacity hover:opacity-80"
      />
    </a>
  );
}
