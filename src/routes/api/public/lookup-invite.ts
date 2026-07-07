import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/lookup-invite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let token: string | null = null;
        try {
          const body = await request.json();
          token = typeof body?.token === "string" ? body.token : null;
        } catch {
          return Response.json({ error: "Invalid body" }, { status: 400 });
        }
        if (!token || token.length < 8 || token.length > 256) {
          return Response.json({ error: "Invalid token" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("invitations")
          .select("email, role, used_at, expires_at")
          .eq("token", token)
          .maybeSingle();

        if (error || !data) return Response.json({ invitation: null });
        if (data.used_at || new Date(data.expires_at) <= new Date()) {
          return Response.json({ invitation: null });
        }
        return Response.json({ invitation: { email: data.email, role: data.role } });
      },
    },
  },
});
