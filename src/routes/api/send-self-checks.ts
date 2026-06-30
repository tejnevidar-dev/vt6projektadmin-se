import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { SELF_CHECK_TEMPLATES } from "@/lib/self-check-templates";

interface SelfCheckImageRef { path: string; name?: string }

interface EmbeddedSelfCheckImage {
  bytes: Uint8Array;
  name: string;
}

interface PdfBuildResult {
  bytes: Uint8Array;
  embeddedImageCount: number;
  failedImageNames: string[];
}

const PDF_IMAGE_MAX_EDGE = 1400;
const PDF_IMAGE_JPEG_QUALITY = 72;

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function downscaleRgbaNearest(
  data: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8Array {
  const out = new Uint8Array(dstWidth * dstHeight * 4);
  for (let y = 0; y < dstHeight; y++) {
    const srcY = Math.min(srcHeight - 1, Math.floor((y * srcHeight) / dstHeight));
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.min(srcWidth - 1, Math.floor((x * srcWidth) / dstWidth));
      const srcIdx = (srcY * srcWidth + srcX) * 4;
      const dstIdx = (y * dstWidth + x) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3] ?? 255;
    }
  }
  return out;
}

function prepareImageForPdf(bytes: Uint8Array): Uint8Array {
  // iPhone/Android photos are often 5-10 MB each. Embedding 80 originals can
  // create a several-hundred-MB PDF that many clients cannot open. Phones may
  // upload either JPEG or PNG, so both formats are re-encoded to compact JPEGs.
  try {
    const decoded = isJpeg(bytes)
      ? jpeg.decode(bytes, {
          useTArray: true,
          tolerantDecoding: true,
          maxMemoryUsageInMB: 768,
        })
      : isPng(bytes)
        ? PNG.sync.read(Buffer.from(bytes))
        : null;
    if (!decoded) return bytes;
    const longest = Math.max(decoded.width, decoded.height);
    const scale = Math.min(1, PDF_IMAGE_MAX_EDGE / longest);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const data = scale < 1
      ? downscaleRgbaNearest(decoded.data, decoded.width, decoded.height, width, height)
      : decoded.data;
    const flattened = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const src = i * 4;
      const alpha = (data[src + 3] ?? 255) / 255;
      flattened[src] = Math.round((data[src] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 1] = Math.round((data[src + 1] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 2] = Math.round((data[src + 2] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 3] = 255;
    }
    const encoded = jpeg.encode({ data: flattened, width, height }, PDF_IMAGE_JPEG_QUALITY);
    return encoded.data instanceof Uint8Array ? encoded.data : new Uint8Array(encoded.data);
  } catch {
    return bytes;
  }
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
  const failedImageNames: string[] = [];

  const drawImage = async (bytes: Uint8Array, caption: string) => {
    let img;
    try {
      img = await pdf.embedJpg(bytes);
    } catch {
      try {
        img = await pdf.embedPng(bytes);
      } catch {
        failedImageNames.push(caption);
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

  return {
    bytes: await pdf.save(),
    embeddedImageCount,
    failedImageNames,
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

        // Hjälpfunktion för att ladda ner en bild från storage som bytes.
        async function downloadImage(path: string): Promise<Uint8Array | null> {
          try {
            const { data, error } = await admin.storage
              .from("self-check-images")
              .download(path);
            if (error || !data) return null;
            const ab = await data.arrayBuffer();
            return prepareImageForPdf(new Uint8Array(ab));
          } catch {
            return null;
          }
        }

        // Build one PDF per self-check and upload. Use a short public redirect
        // URL so mail clients don't line-break the long signed-URL tokens.
        const origin = new URL(request.url).origin;
        const links: { label: string; url: string }[] = [];
        let totalEmbeddedImages = 0;

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
          const missingImages: string[] = [];
          for (const [field, imgs] of Object.entries(allFields)) {
            const arr: EmbeddedSelfCheckImage[] = [];
            for (const img of imgs) {
              if (!img?.path) continue;
              const bytes = await downloadImage(img.path);
              if (bytes) {
                arr.push({ bytes, name: img.name ?? "" });
              } else {
                missingImages.push(img.name || img.path.split("/").pop() || "bild");
              }
            }
            if (arr.length > 0) resolvedImages[field] = arr;
          }
          if (missingImages.length > 0) {
            return jsonResponse(
              {
                error: `Kunde inte hämta ${missingImages.length} bifogade bilder till egenkontroll ${i + 1}. Inget mejl skickades.`,
              },
              500,
            );
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
          });
          if (pdfResult.failedImageNames.length > 0) {
            return jsonResponse(
              {
                error: `Kunde inte bädda in ${pdfResult.failedImageNames.length} bilder i egenkontroll ${i + 1}. Inget mejl skickades.`,
              },
              500,
            );
          }
          const filename = `egenkontroll-${i + 1}-${slugify(sc.template_key)}.pdf`;
          const path = `${jobId}/${Date.now()}-${i + 1}-${filename}`;
          const { error: upErr } = await admin.storage
            .from("self-check-pdfs")
            .upload(path, pdfResult.bytes, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (upErr) {
            return jsonResponse(
              { error: `Kunde inte ladda upp PDF: ${upErr.message}` },
              500,
            );
          }
          const safePath = path
            .split("/")
            .map((seg) => encodeURIComponent(seg))
            .join("/");
          links.push({
            label: `Egenkontroll ${i + 1} – ${templateLabel(sc.template_key)}`,
            url: `${origin}/api/public/self-check-pdf/${safePath}`,
          });
          totalEmbeddedImages += pdfResult.embeddedImageCount;
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
        });
      },
    },
  },
});
