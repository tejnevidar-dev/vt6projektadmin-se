import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
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
        const base64 = bytesToBase64(new Uint8Array(arrayBuf));

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return jsonResponse({ error: "AI not configured" }, 500);

        const systemPrompt = `Du är en assistent som tolkar svenska arbetsordrar för takläggare. Läs hela arbetsordern noggrant och skriv om innehållet i klartext på svenska så att en hantverkare/arbetsledare direkt förstår vad som ska göras på plats. Strukturera svaret som markdown med rubriker:

## Översikt
Kort sammanfattning (1-2 meningar).

## Adress & kontakt
Adress, kund och eventuell kontaktperson på plats.

## Arbete som ska utföras
Punktlista – var konkret, behåll alla mått, material, antal, kulörer och produktnamn.

## Material & verktyg
Vad ska tas med eller beställs?

## Säkerhet & särskilda krav
Ställning, fallskydd, bygglov, ROT, tidsbegränsningar osv.

## Övriga noteringar
Allt annat viktigt.

Hitta inte på något. Om en sektion saknas i arbetsordern, skriv "Ej angivet". Inga emojis.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: "Tolka denna arbetsorder och skriv om den enligt instruktionerna." },
                  {
                    type: "file",
                    file: {
                      filename: "arbetsorder.pdf",
                      file_data: `data:application/pdf;base64,${base64}`,
                    },
                  },
                ],
              },
            ],
          }),
        });

        if (!aiResp.ok) {
          const text = await aiResp.text();
          if (aiResp.status === 429) return jsonResponse({ error: "AI-tjänsten är överbelastad, försök igen om en stund." }, 429);
          if (aiResp.status === 402) return jsonResponse({ error: "AI-krediter slut. Lägg till krediter under Workspace > Usage." }, 402);
          return jsonResponse({ error: `AI-fel: ${text.slice(0, 300)}` }, 500);
        }

        const aiJson = (await aiResp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const summary = aiJson.choices?.[0]?.message?.content?.trim();
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
