import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/public/self-check-pdf/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404, headers: corsHeaders });
        }
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
        }
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await admin.storage
          .from("self-check-pdfs")
          .download(path);
        if (error || !data) {
          return new Response("Inte tillgänglig", { status: 404, headers: corsHeaders });
        }
        return new Response(data, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${encodeURIComponent(path.split("/").pop() ?? "egenkontroll.pdf")}"`,
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
