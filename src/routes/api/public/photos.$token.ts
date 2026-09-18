import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public gallery endpoint, mirrors src/routes/api/public/sign.$token.ts's pattern:
// service-role client looks up the token, no anon RLS policy needed on job_photos/
// job_photo_share_links at all -- only an authenticated staff member can ever create
// a share link or upload a photo (enforced by those tables' real RLS policies).

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("server_misconfigured");
  return createClient(url, key, { auth: { persistSession: false } });
}

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/public/photos/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 20) return bad("not_found", 404);

        const supabase = admin();
        const { data: link } = await supabase
          .from("job_photo_share_links")
          .select("job_id")
          .eq("token", token)
          .maybeSingle();
        if (!link) return bad("not_found", 404);

        const { data: job } = await supabase
          .from("jobs")
          .select("customer_name, address")
          .eq("id", link.job_id)
          .maybeSingle();

        const { data: photos } = await supabase
          .from("job_photos")
          .select("storage_path, phase, caption, created_at")
          .eq("job_id", link.job_id)
          .order("phase", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        const withUrls = await Promise.all(
          (photos ?? []).map(async (p) => {
            const { data: signed } = await supabase.storage
              .from("self-check-images")
              .createSignedUrl(p.storage_path, 60 * 60);
            return { url: signed?.signedUrl ?? null, phase: p.phase, caption: p.caption, createdAt: p.created_at };
          }),
        );

        return Response.json({
          customerName: job?.customer_name ?? null,
          address: job?.address ?? null,
          photos: withUrls.filter((p) => p.url),
        });
      },
    },
  },
});
