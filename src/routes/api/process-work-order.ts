import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { extractText, getDocumentProxy } from "unpdf";
import { callOpenAIChat } from "@/lib/openai.server";

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

export const Route = createFileRoute("/api/process-work-order")({
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
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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

        // Load job and verify the user can access it via RLS
        const { data: job, error: jobErr } = await userClient
          .from("jobs")
          .select("id, work_order_pdf_path, assigned_to")
          .eq("id", jobId)
          .maybeSingle();
        if (jobErr) return jsonResponse({ error: jobErr.message }, 500);
        if (!job) return jsonResponse({ error: "Job not found" }, 404);
        if (!job.work_order_pdf_path) {
          return jsonResponse({ error: "Ingen arbetsorder uppladdad" }, 400);
        }

        // Download the PDF using service role (RLS bypass; user already verified)
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: file, error: dlErr } = await admin.storage
          .from("work-orders")
          .download(job.work_order_pdf_path);
        if (dlErr || !file) return jsonResponse({ error: dlErr?.message ?? "Kunde inte hämta fil" }, 500);

        const arrayBuf = await file.arrayBuffer();
        let workOrderText: string;
        try {
          const pdf = await getDocumentProxy(new Uint8Array(arrayBuf));
          const { text } = await extractText(pdf, { mergePages: true });
          workOrderText = text.trim();
        } catch (e) {
          console.error("PDF text extraction failed", e);
          return jsonResponse({ error: "Kunde inte läsa text ur PDF:en." }, 500);
        }
        if (!workOrderText) {
          return jsonResponse({ error: "Ingen text hittades i PDF:en (kan vara en inskannad bild utan textlager)." }, 400);
        }

        const systemPrompt = `Du är en assistent som tolkar svenska arbetsordrar för takläggare. Läs hela arbetsordern noggrant och skriv om innehållet i klartext på svenska så att en hantverkare/arbetsledare direkt förstår vad som ska göras på plats.

SEKRETESS – mycket viktigt: Denna sammanfattning visas för alla anställda inkl. hantverkare. Ta INTE med följande i din output, oavsett om det står i arbetsordern:
- Uppdragsgivare / beställare / klientföretag / kontaktpersoner hos uppdragsgivaren (t.ex. "Property Management Solutions" eller liknande)
- Priser, budget, fastpris, ersättning, fakturabelopp, "UE står för…", kronor/SEK-belopp
- Konfidentialitetsklausuler eller juridisk boilerplate ("får inte spridas vidare" osv.)
- Eventuella interna referenser/ordernummer kopplade till uppdragsgivaren

Ta MED:
- Slutkundens adress och kontaktperson på plats (den som bor där / släpper in hantverkaren) – detta behövs på plats
- Allt tekniskt: arbetsbeskrivning, mått, material, antal, kulörer, produktnamn, säkerhet, bygglov, ROT, tidsplan

Strukturera svaret som markdown med rubriker:

## Översikt
Kort sammanfattning (1-2 meningar). Inga belopp, ingen uppdragsgivare.

## Adress & kontakt på plats
Slutkundens adress och eventuell kontaktperson på plats. INTE uppdragsgivaren.

## Arbete som ska utföras
Punktlista – var konkret, behåll alla mått, material, antal, kulörer och produktnamn.

## Material & verktyg
Vad ska tas med eller beställas? Skriv inte vem som betalar.

## Säkerhet & särskilda krav
Ställning, fallskydd, bygglov, ROT, tidsbegränsningar osv.

## Övriga noteringar
Allt annat viktigt – men hoppa över priser, uppdragsgivare och sekretessklausuler.

Hitta inte på något. Om en sektion saknas i arbetsordern, skriv "Ej angivet". Inga emojis.`;

        let summary: string | undefined;
        try {
          const aiJson = (await callOpenAIChat({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Tolka denna arbetsorder och skriv om den enligt instruktionerna.\n\n--- ARBETSORDER (extraherad text) ---\n${workOrderText}`,
              },
            ],
          })) as { choices?: Array<{ message?: { content?: string } }> };
          summary = aiJson.choices?.[0]?.message?.content?.trim();
        } catch (e) {
          return jsonResponse({ error: e instanceof Error ? e.message : "AI-fel" }, 500);
        }
        if (!summary) return jsonResponse({ error: "Tomt svar från AI" }, 500);

        const { error: updErr } = await admin
          .from("jobs")
          .update({
            work_order_summary: summary,
            work_order_processed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        if (updErr) return jsonResponse({ error: updErr.message }, 500);

        return jsonResponse({ summary });
      },
    },
  },
});
