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

const FROM_ADDRESS = "VT6 <noreply@underlag.vt6.se>";

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

function renderValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "<em>–</em>";
  if (typeof val === "boolean") return val ? "Ja" : "Nej";
  if (typeof val === "string" || typeof val === "number") return escapeHtml(String(val));
  return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(
    JSON.stringify(val, null, 2),
  )}</pre>`;
}

function renderSelfCheck(idx: number, sc: {
  template_key: string;
  data: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
  performer_name?: string | null;
}): string {
  const when = sc.completed_at ?? sc.created_at;
  const dt = new Date(when).toLocaleString("sv-SE");
  const rows = Object.entries(sc.data ?? {})
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;vertical-align:top;width:38%">${escapeHtml(k)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${renderValue(v)}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e5e7eb">
        <strong>Egenkontroll #${idx + 1}</strong>
        <span style="color:#64748b;margin-left:8px">${escapeHtml(sc.template_key)}</span>
        <span style="float:right;color:#64748b;font-size:13px">${escapeHtml(dt)}</span>
        ${
          sc.performer_name
            ? `<div style="color:#64748b;font-size:13px;margin-top:2px">Utförd av: ${escapeHtml(sc.performer_name)}</div>`
            : ""
        }
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows || `<tr><td style="padding:10px;color:#64748b">Inga ifyllda fält</td></tr>`}</table>
    </div>`;
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
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        const resendKey = process.env.RESEND_API_KEY;

        if (!supabaseUrl || !anonKey || !serviceKey) {
          return jsonResponse({ error: "Server misconfigured" }, 500);
        }
        if (!lovableKey || !resendKey) {
          return jsonResponse({ error: "E-postutskick är inte konfigurerat" }, 500);
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

        // Verify access to job via RLS
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

        // Use service role to fetch all self-checks for the job
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: checks, error: scErr } = await admin
          .from("self_checks")
          .select("id, template_key, data, completed_at, created_at, user_id")
          .eq("job_id", jobId)
          .order("created_at", { ascending: true });
        if (scErr) return jsonResponse({ error: scErr.message }, 500);
        if (!checks || checks.length === 0) {
          return jsonResponse(
            { error: "Det finns inga egenkontroller på det här projektet" },
            400,
          );
        }

        // Resolve performer names
        const userIds = Array.from(new Set(checks.map((c) => c.user_id).filter(Boolean) as string[]));
        let nameMap: Record<string, string> = {};
        if (userIds.length) {
          const { data: profs } = await admin
            .from("profiles")
            .select("id, display_name, email")
            .in("id", userIds);
          nameMap = Object.fromEntries(
            (profs ?? []).map((p: { id: string; display_name: string | null; email: string }) => [
              p.id,
              p.display_name || p.email,
            ]),
          );
        }

        const projectLabel = [job.customer_name, job.address].filter(Boolean).join(" – ") || "Projekt";
        const clientLine = [job.client_contact_name, job.client_company]
          .filter(Boolean)
          .join(", ");

        const checksHtml = checks
          .map((sc, i) =>
            renderSelfCheck(i, {
              template_key: sc.template_key,
              data: (sc.data as Record<string, unknown>) ?? {},
              completed_at: sc.completed_at,
              created_at: sc.created_at,
              performer_name: sc.user_id ? nameMap[sc.user_id] ?? null : null,
            }),
          )
          .join("");

        const html = `
<!doctype html>
<html lang="sv">
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:680px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">
        ${job.client_company ? `Hej ${escapeHtml(job.client_company)}!<br/><br/>` : "Hej!<br/><br/>"}
        Nu är projektet på "${escapeHtml(job.address || "")}" avslutat och vi tackar ödmjukt för förtroendet och hoppas på många fler lika lyckade projekt i framtiden.<br/><br/>
        Ni finner alla egenkontroller för "${escapeHtml(job.address || "")}" bifogade i detta mail.<br/><br/>
        Vänligen kontakta eran kontaktperson för projekt om det uppstår frågetecken som rör egenkontroller.
      </p>
      ${
        job.address
          ? `<p style="margin:0 0 4px;font-size:14px"><strong>Adress:</strong> ${escapeHtml(job.address)}</p>`
          : ""
      }
      ${
        job.customer_name
          ? `<p style="margin:0 0 20px;font-size:14px"><strong>Objekt:</strong> ${escapeHtml(job.customer_name)}</p>`
          : ""
      }
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0 20px"/>
      ${checksHtml}
      <p style="margin:24px 0 0;color:#64748b;font-size:12px">
        Skickat automatiskt från VT6 när projektet markerades som klart.
      </p>
    </div>
  </div>
</body>
</html>`.trim();

        const subject = `Egenkontroller – ${projectLabel}`;

        const sendResp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: [job.client_email],
            subject,
            html,
          }),
        });
        const sendBody = await sendResp.json().catch(() => ({}));
        if (!sendResp.ok) {
          return jsonResponse(
            {
              error: `Resend ${sendResp.status}: ${
                (sendBody as { message?: string }).message ?? "okänt fel"
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
