import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ImageOff } from "lucide-react";

export const Route = createFileRoute("/foto/$token")({
  head: () => ({
    meta: [
      { title: "Projektbilder – RoslagsTak" },
      { name: "description", content: "Före- och efterbilder från ert takprojekt." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FotoPage,
});

interface Photo {
  url: string;
  phase: "fore" | "efter";
  caption: string | null;
  createdAt: string;
}

interface GalleryInfo {
  customerName: string | null;
  address: string | null;
  photos: Photo[];
}

function FotoPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<GalleryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/photos/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("not_found");
        return res.json() as Promise<GalleryInfo>;
      })
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ImageOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Länken är ogiltig eller har tagits bort.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fore = data.photos.filter((p) => p.phase === "fore");
  const efter = data.photos.filter((p) => p.phase === "efter");

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Projektbilder</h1>
          {data.address && <p className="mt-1 text-sm text-muted-foreground">{data.address}</p>}
          {data.customerName && <p className="text-sm text-muted-foreground">{data.customerName}</p>}
        </div>

        {data.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga bilder har lagts till ännu.</p>
        ) : (
          <>
            {fore.length > 0 && <PhotoSection title="Före" photos={fore} />}
            {efter.length > 0 && <PhotoSection title="Efter" photos={efter} />}
          </>
        )}
      </div>
    </div>
  );
}

function PhotoSection({ title, photos }: { title: string; photos: Photo[] }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-lg border border-border bg-muted/30"
          >
            <img
              src={p.url}
              alt={p.caption ?? title}
              className="aspect-square w-full object-cover transition group-hover:opacity-90"
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
