import * as React from "react";
import { render } from "@react-email/render";
import { Webhook } from "standardwebhooks";
import { createFileRoute } from "@tanstack/react-router";
import { EmailSuppressedError, sendResendEmail } from "@/lib/resend.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

// Direct replacement for src/routes/lovable/email/auth/webhook.ts now that Lovable no
// longer sits between Supabase Auth and this app. Configure this URL as the "Send
// Email" Auth Hook in Supabase Dashboard -> Authentication -> Hooks, with a secret
// (SUPABASE_AUTH_HOOK_SECRET below) matching what Supabase gives you there.
//
// Payload shape below (user/email_data, Standard Webhooks signing) is Supabase's
// documented Auth Hook format as of when this was written -- verify against the
// current Supabase docs / your dashboard's hook config before relying on this,
// auth emails are load-bearing.

const SITE_NAME = "admin.vt6";
// Matches send-email.ts's FROM_DOMAIN -- a subdomain isolates sending reputation
// from any regular company email on the root domain, and matches what Lovable used.
const FROM_DOMAIN = "notify.vt6projektadmin.se";

type AuthActionType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "reauthentication";

interface SupabaseAuthHookPayload {
  user: { id: string; email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

// Supabase's own hosted verify endpoint -- exchanges the token_hash for a session and
// redirects to redirect_to. Same link shape Supabase's built-in default emails use.
function buildVerifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo: string): string {
  const url = new URL(`${supabaseUrl}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

export const Route = createFileRoute("/api/hooks/supabase-auth-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        if (!rawSecret) {
          console.error("SUPABASE_AUTH_HOOK_SECRET is not configured");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }
        // Supabase gives secrets as "v1,whsec_...", but the standardwebhooks library only
        // recognizes the bare "whsec_..." prefix (it silently fails to strip anything else
        // and then fails to base64-decode the leftover "v1,whsec_" text). Strip the "v1,"
        // ourselves before handing it to the library.
        const secret = rawSecret.startsWith("v1,") ? rawSecret.slice(3) : rawSecret;

        const rawBody = await request.text();
        let payload: SupabaseAuthHookPayload;
        try {
          const wh = new Webhook(secret);
          const headers: Record<string, string> = {};
          request.headers.forEach((value, key) => (headers[key] = value));
          payload = wh.verify(rawBody, headers) as SupabaseAuthHookPayload;
        } catch (err) {
          console.error("Supabase auth hook signature verification failed", err);
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        const { user, email_data } = payload;
        const supabaseUrl = process.env.SUPABASE_URL;
        if (!supabaseUrl) return Response.json({ error: "Server configuration error" }, { status: 500 });

        const confirmationUrl = buildVerifyUrl(
          supabaseUrl,
          email_data.token_hash,
          email_data.email_action_type,
          email_data.redirect_to,
        );

        let subject: string;
        let element: React.ReactElement;
        switch (email_data.email_action_type) {
          case "signup":
            subject = "Confirm your email";
            element = React.createElement(SignupEmail, {
              siteName: SITE_NAME,
              siteUrl: email_data.site_url,
              recipient: user.email,
              confirmationUrl,
            });
            break;
          case "invite":
            subject = "Du har blivit inbjuden till admin.vt6";
            element = React.createElement(InviteEmail, {
              siteName: SITE_NAME,
              siteUrl: email_data.site_url,
              confirmationUrl,
            });
            break;
          case "magiclink":
            subject = "Your login link";
            element = React.createElement(MagicLinkEmail, { siteName: SITE_NAME, confirmationUrl });
            break;
          case "recovery":
            subject = "Reset your password";
            element = React.createElement(RecoveryEmail, { siteName: SITE_NAME, confirmationUrl });
            break;
          case "email_change":
            subject = "Confirm your new email";
            element = React.createElement(EmailChangeEmail, {
              siteName: SITE_NAME,
              oldEmail: user.email ?? "",
              email: user.email,
              newEmail: user.new_email ?? "",
              confirmationUrl,
            });
            break;
          case "reauthentication":
            subject = "Your verification code";
            element = React.createElement(ReauthenticationEmail, { token: email_data.token ?? "" });
            break;
          default:
            // Unknown action type: permanent failure, not retryable.
            return Response.json({ error: `Unknown email_action_type: ${email_data.email_action_type}` }, { status: 400 });
        }

        const html = await render(element);
        const text = await render(element, { plainText: true });

        try {
          await sendResendEmail(supabaseAdmin, {
            to: user.email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            subject,
            html,
            text,
            idempotencyKey: `auth-${user.id}-${email_data.email_action_type}-${email_data.token_hash}`,
          });
        } catch (err) {
          if (err instanceof EmailSuppressedError) {
            // A suppressed recipient can't receive auth emails either -- this is a
            // permanent failure for this send, not something to retry.
            return Response.json({ error: "Recipient is suppressed" }, { status: 400 });
          }
          console.error("Failed to send auth email via Resend", err);
          return Response.json({ error: "Send failed" }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
