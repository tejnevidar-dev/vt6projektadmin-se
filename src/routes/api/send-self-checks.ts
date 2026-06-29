import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SELF_CHECK_TEMPLATES } from "@/lib/self-check-templates";

interface SelfCheckImageRef { path: string; name?: string }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const InputSchema = z.object({
  jobId: z.string().uuid(),
});

const FROM_ADDRESS = "VT6 <no-reply@notify.vt6projektadmin.se>";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  default: "Egenkontroll",
};
function templateLabel(key: string): string {
  return TEMPLATE_LABELS[key] ?? key;
}



function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
  imagesByField: Record<string, { bytes: Uint8Array; name: string }[]>;
}): Promise<Uint8Array> {
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

  const drawImage = async (bytes: Uint8Array, caption: string) => {
    let img;
    try {
      img = await pdf.embedJpg(bytes);
    } catch {
      try {
        img = await pdf.embedPng(bytes);
      } catch {
        draw(`(Kunde inte bädda in bild: ${caption})`, { size: 9, color: rgb(0.6, 0.2, 0.2) });
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
  draw("Falt", { font: bold, size: 12 });
  y -= 4;

  const entries = Object.entries(args.data ?? {}).filter(
    ([k]) => k !== "imagesByField" && k !== "images",
  );
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

  return pdf.save();
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
            return new Uint8Array(ab);
          } catch {
            return null;
          }
        }

        // Build one PDF per self-check and upload. Use a short public redirect
        // URL so mail clients don't line-break the long signed-URL tokens.
        const origin = new URL(request.url).origin;
        const links: { label: string; url: string }[] = [];
        for (let i = 0; i < checks.length; i++) {
          const sc = checks[i];
          const rawData = (sc.data as Record<string, unknown>) ?? {};
          const byField =
            (rawData.imagesByField as Record<string, SelfCheckImageRef[]> | undefined) ?? {};
          const legacy = (rawData.images as SelfCheckImageRef[] | undefined) ?? [];
          const allFields: Record<string, SelfCheckImageRef[]> = { ...byField };
          if (legacy.length > 0) {
            allFields["Övrigt"] = [...(allFields["Övrigt"] ?? []), ...legacy];
          }
          const resolvedImages: Record<string, { bytes: Uint8Array; name: string }[]> = {};
          for (const [field, imgs] of Object.entries(allFields)) {
            const arr: { bytes: Uint8Array; name: string }[] = [];
            for (const img of imgs) {
              if (!img?.path) continue;
              const bytes = await downloadImage(img.path);
              if (bytes) arr.push({ bytes, name: img.name ?? "" });
            }
            if (arr.length > 0) resolvedImages[field] = arr;
          }

          const bytes = await buildSelfCheckPdf({
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
          const filename = `egenkontroll-${i + 1}-${slugify(sc.template_key)}.pdf`;
          const path = `${jobId}/${Date.now()}-${i + 1}-${filename}`;
          const { error: upErr } = await admin.storage
            .from("self-check-pdfs")
            .upload(path, bytes, {
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
        });
      },
    },
  },
});
