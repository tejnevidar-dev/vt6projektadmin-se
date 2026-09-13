import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

// Direct replacement for src/routes/lovable/email/events.ts. Configure this URL as a
// webhook endpoint in the Resend dashboard (Webhooks -> Add Endpoint), subscribed to
// at least email.bounced and email.complained. Resend signs webhooks via Svix --
// RESEND_WEBHOOK_SECRET below is the "signing secret" Resend shows you for that
// endpoint (starts with "whsec_").
//
// NOTE -- known gap versus the old Lovable-based flow: Lovable auto-generated a
// per-email unsubscribe link/landing page and fired an `email.unsubscribed` event back
// to us. Resend doesn't provide that same automatic mechanism for transactional sends.
// The `email_unsubscribe_tokens` table still exists (migrated) but nothing in this app
// reads/writes it -- a real unsubscribe link + landing page would need to be built if
// that's still wanted. Not done here; flagging it rather than silently dropping it.

type SuppressionReason = "bounce" | "complaint";
type LogStatus = "bounced" | "complained";

function adminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function record(
  recipient: string,
  messageId: string | null | undefined,
  reason: SuppressionReason,
  status: LogStatus,
  message: string,
) {
  const supabase = adminClient();
  const normalized = recipient.toLowerCase();

  const { error: suppressError } = await supabase
    .from("suppressed_emails")
    .upsert({ email: normalized, reason, metadata: null }, { onConflict: "email" });
  if (suppressError) {
    console.error("Failed to record suppression", { code: suppressError.code, message: suppressError.message });
    throw new Error("suppression_write_failed");
  }

  const { error: logError } = await supabase.from("email_send_log").insert({
    message_id: messageId ?? null,
    template_name: "system",
    recipient_email: normalized,
    status,
    error_message: message,
    metadata: null,
  });
  if (logError) {
    console.error("Failed to record email event log", { code: logError.code, message: logError.message });
    throw new Error("log_write_failed");
  }
}

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    bounce?: { message?: string };
  };
}

export const Route = createFileRoute("/api/hooks/resend-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!secret) {
          console.error("RESEND_WEBHOOK_SECRET is not configured");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const rawBody = await request.text();
        let event: ResendWebhookEvent;
        try {
          const wh = new Webhook(secret);
          const headers: Record<string, string> = {};
          request.headers.forEach((value, key) => (headers[key] = value));
          event = wh.verify(rawBody, headers) as ResendWebhookEvent;
        } catch (err) {
          console.error("Resend webhook signature verification failed", err);
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        const recipient = event.data.to?.[0];
        if (!recipient) return Response.json({ ok: true }); // nothing to record against

        try {
          if (event.type === "email.bounced") {
            await record(
              recipient,
              event.data.email_id,
              "bounce",
              "bounced",
              event.data.bounce?.message ?? "Permanent bounce — email address is invalid or rejected",
            );
          } else if (event.type === "email.complained") {
            await record(recipient, event.data.email_id, "complaint", "complained", "Spam complaint — recipient marked email as spam");
          }
          // Other event types (delivered, opened, clicked, ...) are acknowledged but not recorded.
        } catch (err) {
          console.error("Failed to process Resend webhook event", event.type, err);
          return Response.json({ error: "Processing failed" }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
