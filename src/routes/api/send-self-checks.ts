import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prepareImageForPdf, PdfImageError } from "@/lib/pdf-image";
import { SELF_CHECK_TEMPLATES } from "@/lib/self-check-templates";

interface SelfCheckImageRef { path: string; name?: string }

interface EmbeddedSelfCheckImage {
  bytes: Uint8Array;
  name: string;
}

interface PdfImageFailure {
  name: string;
  reason: string;
}

interface PdfBuildResult {
  bytes: Uint8Array;
  embeddedImageCount: number;
  failedImages: PdfImageFailure[];
}




const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const InputSchema = z.object({
  jobId: z.string().uuid(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function stringifyValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "–";
  if (typeof val === "boolean") return val ? "Ja" : "Nej";
  if (typeof val === "string" || typeof val === "number") return String(val);
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function isImageMetadataKey(key: string): boolean {
  return ["images", "imagesbyfield"].includes(key.replace(/[^a-z]/gi, "").toLowerCase());
}

function isSelfCheckImageRef(value: unknown): value is SelfCheckImageRef {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

function containsImageRefs(value: unknown): boolean {
  if (isSelfCheckImageRef(value)) return true;
  if (Array.isArray(value)) return value.some(containsImageRefs);
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>).some(containsImageRefs);
  }
  return false;
}

function normalizeImageRefs(value: unknown): Record<string, SelfCheckImageRef[]> {
  if (!value) return {};

  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (Array.isArray(parsed)) {
    return {
      "Övrigt": parsed.filter(isSelfCheckImageRef),
    };
  }

  if (typeof parsed !== "object" || parsed === null) return {};

  const result: Record<string, SelfCheckImageRef[]> = {};
  for (const [field, refs] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(refs)) {
      const validRefs = refs.filter(isSelfCheckImageRef);
      if (validRefs.length > 0) result[field] = validRefs;
    }
  }
  return result;
}

function normalizeSelfCheckData(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitize(s: string): string {
  // Standard Helvetica only supports WinAnsi; strip anything outside.
  return s.replace(/[^\x00-\xFF]/g, "?");
}

function slugify(s: string): string {
  return (
    (s || "egenkontroll")
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "egenkontroll"
  );
}

const TEMPLATE_LABELS: Record<string, string> = {
  tak: "Takarbete",
  plat: "Platarbete",
  sakerhet: "Sakerhet",
  stallning: "Stallning",
  taktvatt: "Taktvatt",
  default: "Egenkontroll",
};
function templateLabel(key: string): string {
  return TEMPLATE_LABELS[key] ?? key;
}

function templateFieldLabels(key: string): Set<string> {
  return new Set(SELF_CHECK_TEMPLATES.find((t) => t.key === key)?.fields.map((f) => f.label) ?? []);
}




async function buildSelfCheckPdf(args: {
  index: number;
  jobAddress: string;
  customerName: string | null;
  templateKey: string;
  data: Record<string, unknown>;
  completedAt: string | null;
  createdAt: string;
  performerName: string | null;
  imagesByField: Record<string, EmbeddedSelfCheckImage[]>;
  failedNotes?: string[];

}): Promise<PdfBuildResult> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE: [number, number] = [595.28, 841.89]; // A4
  let page = pdf.addPage(PAGE);
  const margin = 50;
  const maxWidth = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const ensureSpace = (h: number) => {
    if (y - h < margin) {
      page = pdf.addPage(PAGE);
      y = page.getHeight() - margin;
    }
  };

  const draw = (
    text: string,
    opts: { font?: typeof font; size?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 11;
    const color = opts.color ?? rgb(0, 0, 0);
    const safe = sanitize(text);
    for (const rawLine of safe.split(/\n/)) {
      const words = rawLine.split(/\s+/);
      let line = "";
      const lines: string[] = [];
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      if (lines.length === 0) lines.push("");
      for (const l of lines) {
        ensureSpace(size + 4);
        page.drawText(l, { x: margin, y, size, font: f, color });
        y -= size + 4;
      }
    }
  };

  let embeddedImageCount = 0;
  const failedImages: PdfImageFailure[] = [];

  const drawImage = async (bytes: Uint8Array, caption: string) => {
    let img;
    let jpgErr: unknown;
    let pngErr: unknown;
    try {
      img = await pdf.embedJpg(bytes);
    } catch (e) {
      jpgErr = e;
      try {
        img = await pdf.embedPng(bytes);
      } catch (e2) {
        pngErr = e2;
        failedImages.push({
          name: caption,
          reason: `pdf-lib avvisade bilden (${bytes.length} bytes). embedJpg: ${(jpgErr as Error)?.message ?? "okänt"}; embedPng: ${(pngErr as Error)?.message ?? "okänt"}`,
        });
        return;
      }
    }
    const maxW = maxWidth;
    const maxH = 320;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    ensureSpace(h + 14);
    page.drawImage(img, { x: margin, y: y - h, width: w, height: h });
    embeddedImageCount += 1;
    y -= h + 6;
    draw(caption, { size: 9, color: rgb(0.4, 0.4, 0.4) });
    y -= 2;
  };


  draw(`Egenkontroll #${args.index + 1}`, { font: bold, size: 18 });
  y -= 6;
  draw(`Mall: ${templateLabel(args.templateKey)}`, { size: 10, color: rgb(0.3, 0.3, 0.3) });
  if (args.jobAddress)
    draw(`Adress: ${args.jobAddress}`, { size: 10, color: rgb(0.3, 0.3, 0.3) });
  if (args.customerName)
    draw(`Objekt: ${args.customerName}`, { size: 10, color: rgb(0.3, 0.3, 0.3) });
  const when = args.completedAt ?? args.createdAt;
  draw(`Datum: ${new Date(when).toLocaleString("sv-SE")}`, {
    size: 10,
    color: rgb(0.3, 0.3, 0.3),
  });
  if (args.performerName)
    draw(`Utford av: ${args.performerName}`, { size: 10, color: rgb(0.3, 0.3, 0.3) });

  y -= 10;
  draw("Fält", { font: bold, size: 12 });
  y -= 4;

  const allowedFieldLabels = templateFieldLabels(args.templateKey);
  const entries = Object.entries(args.data ?? {}).filter(([k, v]) => {
    if (k.startsWith("__")) return false;
    if (!allowedFieldLabels.has(k)) return false;
    return !isImageMetadataKey(k) && !containsImageRefs(v);
  });
  if (entries.length === 0) {
    draw("Inga ifyllda falt", { size: 11, color: rgb(0.4, 0.4, 0.4) });
  } else {
    for (const [k, v] of entries) {
      draw(k, { font: bold, size: 11 });
      draw(stringifyValue(v), { size: 11 });
      y -= 4;
    }
  }

  const imageFields = Object.entries(args.imagesByField).filter(([, arr]) => arr.length > 0);
  if (imageFields.length > 0) {
    y -= 8;
    draw("Bifogade bilder", { font: bold, size: 12 });
    y -= 4;
    for (const [field, imgs] of imageFields) {
      draw(field, { font: bold, size: 11 });
      y -= 2;
      for (let i = 0; i < imgs.length; i++) {
        await drawImage(imgs[i].bytes, `${imgs[i].name || `Bild ${i + 1}`}`);
      }
      y -= 4;
    }
  }

  const notes = [...(args.failedNotes ?? []), ...failedImages.map((f) => f.name)];
  if (notes.length > 0) {
    y -= 8;
    draw("Bilder som inte kunde bifogas", { font: bold, size: 11 });
    for (const n of notes) {
      draw(`- ${n}`, { size: 10, color: rgb(0.45, 0.45, 0.45) });
    }
  }


  return {
    bytes: await pdf.save(),
    embeddedImageCount,
    failedImages,
  };
}

export const Route = createFileRoute("/api/send-self-checks")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),



      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const token = authHeader.slice(7);

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const anonKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !anonKey || !serviceKey) {
          return jsonResponse({ error: "Server misconfigured" }, 500);
        }

        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData.user) return jsonResponse({ error: "Invalid token" }, 401);

        const body = await request.json().catch(() => null);
        const parsed = InputSchema.safeParse(body);
        if (!parsed.success) return jsonResponse({ error: "Invalid input" }, 400);
        const { jobId } = parsed.data;

        const { data: job, error: jobErr } = await userClient
          .from("jobs")
          .select(
            "id, customer_name, address, client_company, client_contact_name, client_email, status",
          )
          .eq("id", jobId)
          .maybeSingle();
        if (jobErr) return jsonResponse({ error: jobErr.message }, 500);
        if (!job) return jsonResponse({ error: "Projektet hittades inte" }, 404);
        if (!job.client_email) {
          return jsonResponse(
            { error: "Beställarens e-postadress saknas på projektet" },
            400,
          );
        }
        if (!job.address) {
          return jsonResponse(
            { error: "Adress saknas på projektet" },
            400,
          );
        }

        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: allChecks, error: scErr } = await admin
          .from("self_checks")
          .select("id, template_key, data, completed_at, created_at, user_id")
          .eq("job_id", jobId)
          .order("created_at", { ascending: true });
        if (scErr) return jsonResponse({ error: scErr.message }, 500);
        // Filtrera till mallar som ska skickas till beställare (sentToClient = true).
        const CLIENT_TEMPLATE_KEYS = new Set(
          SELF_CHECK_TEMPLATES.filter((t) => t.sentToClient).map((t) => t.key),
        );
        const checks = (allChecks ?? []).filter((c) =>
          CLIENT_TEMPLATE_KEYS.has(c.template_key),
        );
        if (checks.length === 0) {
          return jsonResponse(
            {
              error:
                "Det finns inga egenkontroller att skicka till beställaren.",
            },
            400,
          );
        }

        const userIds = Array.from(
          new Set(checks.map((c) => c.user_id).filter(Boolean) as string[]),
        );
        let nameMap: Record<string, string> = {};
        if (userIds.length) {
          const { data: profs } = await admin
            .from("profiles")
            .select("id, display_name, email")
            .in("id", userIds);
          nameMap = Object.fromEntries(
            (profs ?? []).map(
              (p: { id: string; display_name: string | null; email: string }) => [
                p.id,
                p.display_name || p.email,
              ],
            ),
          );
        }

        // Hjälpfunktion för att ladda ner och förbereda en bild från storage.
        // Returnerar antingen bytes eller ett strukturerat fel så vi kan
        // berätta exakt varför bilden inte gick att bädda in.
        type ImageLoadResult =
          | { ok: true; bytes: Uint8Array }
          | { ok: false; reason: string };
        async function downloadImage(path: string): Promise<ImageLoadResult> {
          let ab: ArrayBuffer;
          try {
            const { data, error } = await admin.storage
              .from("self-check-images")
              .download(path);
            if (error || !data) {
              return {
                ok: false,
                reason: `nedladdning misslyckades: ${error?.message ?? "ingen data"}`,
              };
            }
            ab = await data.arrayBuffer();
          } catch (err) {
            return {
              ok: false,
              reason: `nedladdning kastade: ${(err as Error).message}`,
            };
          }
          try {
            return { ok: true, bytes: prepareImageForPdf(new Uint8Array(ab)) };
          } catch (err) {
            if (err instanceof PdfImageError) {
              return {
                ok: false,
                reason: `${err.stage} (${err.format}, ${err.byteLength} bytes): ${err.message}`,
              };
            }
            return {
              ok: false,
              reason: `bildbearbetning kastade: ${(err as Error).message}`,
            };
          }
        }



        // Build one PDF per self-check and upload. Use a short public redirect
        // URL so mail clients don't line-break the long signed-URL tokens.
        const origin = new URL(request.url).origin;
        const links: { label: string; url: string }[] = [];
        let totalEmbeddedImages = 0;
        const skippedImages: string[] = [];


        // Ta bort tidigare genererade PDF:er för projektet så användaren och
        // beställaren inte råkar öppna gamla, trasiga filer efter ett omskick.
        const { data: oldPdfs } = await admin.storage
          .from("self-check-pdfs")
          .list(jobId, { limit: 1000 });
        const oldPdfPaths = (oldPdfs ?? [])
          .filter((f) => f.name.toLowerCase().endsWith(".pdf"))
          .map((f) => `${jobId}/${f.name}`);
        if (oldPdfPaths.length > 0) {
          await admin.storage.from("self-check-pdfs").remove(oldPdfPaths);
        }

        for (let i = 0; i < checks.length; i++) {
          const sc = checks[i];
          const rawData = normalizeSelfCheckData(sc.data);
          const byField = normalizeImageRefs(rawData.imagesByField);
          const legacy = normalizeImageRefs(rawData.images);
          const allFields: Record<string, SelfCheckImageRef[]> = { ...byField };
          if (legacy["Övrigt"]?.length > 0) {
            allFields["Övrigt"] = [...(allFields["Övrigt"] ?? []), ...legacy["Övrigt"]];
          }
          const resolvedImages: Record<string, EmbeddedSelfCheckImage[]> = {};
          const failedDownloads: { name: string; reason: string }[] = [];
          for (const [field, imgs] of Object.entries(allFields)) {
            const arr: EmbeddedSelfCheckImage[] = [];
            for (const img of imgs) {
              if (!img?.path) continue;
              const result = await downloadImage(img.path);
              const displayName = img.name || img.path.split("/").pop() || "bild";
              if (result.ok) {
                arr.push({ bytes: result.bytes, name: img.name ?? "" });
              } else {
                failedDownloads.push({ name: displayName, reason: result.reason });
              }
            }
            if (arr.length > 0) resolvedImages[field] = arr;
          }
          // Enskilda bilder som inte går att läsa ska inte stoppa hela utskicket –
          // de listas istället i PDF:en och rapporteras tillbaka till användaren.
          for (const f of failedDownloads) {
            skippedImages.push(`Egenkontroll ${i + 1}: ${f.name} – ${f.reason}`);
          }

          const pdfResult = await buildSelfCheckPdf({
            index: i,
            jobAddress: job.address ?? "",
            customerName: job.customer_name ?? null,
            templateKey: sc.template_key,
            data: rawData,
            completedAt: sc.completed_at,
            createdAt: sc.created_at,
            performerName: sc.user_id ? nameMap[sc.user_id] ?? null : null,
            imagesByField: resolvedImages,
            failedNotes: failedDownloads.map((f) => f.name),
          });
          for (const f of pdfResult.failedImages) {
            skippedImages.push(`Egenkontroll ${i + 1}: ${f.name} – ${f.reason}`);
          }


          const filename = `egenkontroll-${i + 1}-${slugify(sc.template_key)}.pdf`;
          const path = `${jobId}/${Date.now()}-${i + 1}-${filename}`;
          const { error: upErr } = await admin.storage
            .from("self-check-pdfs")
            .upload(path, pdfResult.bytes, {
              contentType: "application/pdf",
              upsert: true,
            });
          const checkSkipped = [
            ...failedDownloads.map((f) => `${f.name} – ${f.reason}`),
            ...pdfResult.failedImages.map((f) => `${f.name} – ${f.reason}`),
          ];
          if (upErr) {
            perCheck.push({
              self_check_id: sc.id,
              template_key: sc.template_key,
              pdf_path: null,
              embedded: pdfResult.embeddedImageCount,
              skipped: checkSkipped,
              error: `Kunde inte ladda upp PDF: ${upErr.message}`,
            });
            skippedImages.push(
              `Egenkontroll ${i + 1}: PDF kunde inte laddas upp – ${upErr.message}`,
            );
            continue;
          }
          const safePath = path
            .split("/")
            .map((seg) => encodeURIComponent(seg))
            .join("/");
          links.push({
            label: `Egenkontroll ${i + 1} – ${templateLabel(sc.template_key)}`,
            url: `${origin}/api/public/self-check-pdf/${safePath}`,
          });
          perCheck.push({
            self_check_id: sc.id,
            template_key: sc.template_key,
            pdf_path: path,
            embedded: pdfResult.embeddedImageCount,
            skipped: checkSkipped,
            error: null,
          });
          totalEmbeddedImages += pdfResult.embeddedImageCount;
        }

        // Nästa försöksnummer per egenkontroll (för "skickad om"-status).
        const { data: prevDeliveries } = await admin
          .from("self_check_deliveries")
          .select("self_check_id, attempt")
          .eq("job_id", jobId);
        const attemptMap: Record<string, number> = {};
        for (const d of prevDeliveries ?? []) {
          const key = (d as { self_check_id: string | null }).self_check_id ?? "";
          const n = (d as { attempt: number }).attempt ?? 1;
          if (!attemptMap[key] || attemptMap[key] < n) attemptMap[key] = n;
        }

        async function logDeliveries(emailError: string | null) {
          if (perCheck.length === 0) return;
          const rows = perCheck.map((p) => ({
            job_id: jobId,
            self_check_id: p.self_check_id,
            template_key: p.template_key,
            recipient_email: job!.client_email,
            status: p.error || emailError ? "failed" : "sent",
            attempt: (attemptMap[p.self_check_id] ?? 0) + 1,
            error_message: p.error ?? emailError,
            skipped_images: p.skipped,
            embedded_image_count: p.embedded,
            pdf_path: p.pdf_path,
            triggered_by: userData.user!.id,
          }));
          await admin.from("self_check_deliveries").insert(rows);
        }

        if (links.length === 0) {
          await logDeliveries("Inga PDF:er kunde genereras");
          return jsonResponse(
            { error: "Inga PDF:er kunde genereras – inget mejl skickades." },
            500,
          );
        }



        const greetName = job.client_company || job.client_contact_name || "";

        // Send via Lovable Emails (transactional) on notify.vt6projektadmin.se
        const sendResp = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            templateName: "self-checks-client",
            recipientEmail: job.client_email,
            idempotencyKey: `self-checks-${jobId}-${Date.now()}`,
            templateData: {
              greetName,
              address: job.address,
              links,
            },
          }),
        });
        const sendBody = await sendResp.json().catch(() => ({}));
        if (!sendResp.ok) {
          return jsonResponse(
            {
              error: `E-postutskick misslyckades: ${
                (sendBody as { error?: string }).error ?? sendResp.status
              }`,
            },
            502,
          );
        }

        await admin
          .from("jobs")
          .update({
            self_checks_emailed_at: new Date().toISOString(),
            self_checks_emailed_to: job.client_email,
          })
          .eq("id", jobId);

        return jsonResponse({
          success: true,
          to: job.client_email,
          count: checks.length,
          imageCount: totalEmbeddedImages,
          skippedImageCount: skippedImages.length,
          skippedImages: skippedImages.slice(0, 20),
        });

      },
    },
  },
});
