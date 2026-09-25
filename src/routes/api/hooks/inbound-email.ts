import { Webhook } from "svix";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  bodyText,
  buildActivityDescription,
  buildLeadNotes,
  displayNameFor,
  extractPhone,
  normalizeHeaders,
  parseAddress,
  shouldSkipEmail,
} from "@/lib/inbound-email";
import { ingestLead, loadConfig } from "@/lib/lead-intake.server";

// Tar emot mail som skickats till info@roslagstak.se och vidarebefordrats till Resends
// inkommande adress. Resend skickar en `email.received`-webhook (signerad med Svix) som
// bara innehåller metadata -- själva innehållet hämtas via Receiving API.
//
//  - Ny avsändare      -> ny lead i steget "inkommande_webb" (källa "email")
//  - Känd avsändare    -> anteckning på befintlig öppen lead (dubblettskydd i ingestLead)
//  - Automatmail/egna  -> loggas som "skipped", skapar inget
// Alla utfall loggas i webhook_logs (source = "email").

const db = supabaseAdmin as any;

async function log(args: {
  status_code: number;
  status: string;
  error_message?: string | null;
  payload?: unknown;
  lead_id?: string | null;
}) {
  try {
    await db.from("webhook_logs").insert({
      source: "email",
      status_code: args.status_code,
      status: args.status,
      error_message: args.error_message ?? null,
      payload: (args.payload as object) ?? null,
      headers: null,
      lead_id: args.lead_id ?? null,
    });
  } catch (e) {
    console.error("Failed to write webhook_logs:", e);
  }
}

export const Route = createFileRoute("/api/hooks/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
        // Egen nyckel för inkommande mail: mottagningsadressen kan ligga i ett annat
        // Resend-konto än det vi skickar utgående mail från.
        const apiKey = process.env.RESEND_INBOUND_API_KEY || process.env.RESEND_API_KEY;
        if (!secret || !apiKey) {
          console.error("RESEND_INBOUND_WEBHOOK_SECRET or RESEND_INBOUND_API_KEY is not configured");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const rawBody = await request.text();
        let event: { type: string; data?: { email_id?: string } };
        try {
          const headers: Record<string, string> = {};
          request.headers.forEach((value, key) => (headers[key] = value));
          event = new Webhook(secret).verify(rawBody, headers) as typeof event;
        } catch (err) {
          console.error("Inbound email webhook signature verification failed", err);
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        if (event.type !== "email.received") return Response.json({ ok: true, ignored: event.type });
        const resendId = event.data?.email_id;
        if (!resendId) return Response.json({ ok: true, ignored: "no_email_id" });

        // Hämta själva mailet (webhooken innehåller bara metadata).
        const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(resendId)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          const msg = `Resend receiving API ${res.status}`;
          await log({ status_code: 502, status: "fetch_failed", error_message: msg, payload: { resendId } });
          return Response.json({ error: msg }, { status: 502 }); // Resend försöker igen
        }
        const mail = (await res.json()) as {
          id: string;
          from?: string;
          reply_to?: string[];
          subject?: string;
          text?: string | null;
          html?: string | null;
          message_id?: string;
          headers?: unknown;
          attachments?: { filename?: string }[];
        };

        const headers = normalizeHeaders(mail.headers);
        const sender = parseAddress(mail.reply_to?.[0]) ?? parseAddress(mail.from);
        const original = parseAddress(mail.from);
        const skip = shouldSkipEmail(original ?? sender, headers);
        const logPayload = { resendId, from: mail.from, subject: mail.subject ?? null };
        if (skip || !sender) {
          await log({ status_code: 200, status: "skipped", error_message: skip ?? "ingen_avsandare", payload: logPayload });
          return Response.json({ ok: true, status: "skipped", reason: skip });
        }

        const subject = mail.subject?.trim() || null;
        const body = bodyText(mail);
        const attachmentNames = (mail.attachments ?? []).map((a) => a.filename ?? "bilaga");

        const cfg = await loadConfig(db);
        const result = await ingestLead(db, cfg, {
          source: "email",
          sourceLabel: "Mail (info@)",
          externalId: `email:${mail.message_id ?? resendId}`,
          name: displayNameFor(sender),
          phone: extractPhone(`${subject ?? ""}\n${body}`),
          email: sender.email,
          status: "warm",
          notes: buildLeadNotes({ fromEmail: sender.email, subject, body, attachmentNames }),
          summary: subject ?? body,
          mergeNote: buildActivityDescription(subject, body),
          meta: { channel: "mail", email_id: resendId, message_id: mail.message_id ?? null, subject },
        });
        if (result.status === "error") {
          await log({ status_code: 500, status: result.stage, error_message: result.message, payload: logPayload });
          return Response.json({ error: "Failed to record lead" }, { status: 500 });
        }
        const code = result.status === "created" ? 201 : 200;
        await log({ status_code: code, status: result.status, payload: logPayload, lead_id: result.leadId });
        return Response.json({ ok: true, status: result.status, lead_id: result.leadId }, { status: code });
      },
    },
  },
});
