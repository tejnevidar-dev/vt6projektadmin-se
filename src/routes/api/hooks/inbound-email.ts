import { Webhook } from "svix";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  bodyText,
  buildActivityDescription,
  buildLeadNotes,
  displayNameFor,
  escapeLike,
  extractPhone,
  normalizeHeaders,
  parseAddress,
  shouldSkipEmail,
} from "@/lib/inbound-email";

// Tar emot mail som skickats till info@roslagstak.se och vidarebefordrats till Resends
// inkommande adress. Resend skickar en `email.received`-webhook (signerad med Svix) som
// bara innehåller metadata -- själva innehållet hämtas via Receiving API.
//
//  - Ny avsändare      -> ny lead i steget "inkommande_webb" (källa "email")
//  - Känd avsändare    -> anteckning på befintlig lead (ingen dublett)
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

async function notify(userIds: string[], title: string, body: string, leadId: string) {
  if (userIds.length === 0) return;
  const rows = userIds.map((user_id) => ({
    user_id,
    type: "lead_email",
    title,
    body,
    link: `/leads?lead=${leadId}`,
  }));
  const { error } = await db.from("notifications").insert(rows);
  if (error) console.error("Failed to insert notifications:", error.message);
}

async function adminIds(): Promise<string[]> {
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
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

        const externalId = `email:${mail.message_id ?? resendId}`;
        const { data: dup } = await db.from("leads").select("id").eq("external_id", externalId).maybeSingle();
        if (dup) {
          await log({ status_code: 200, status: "duplicate", payload: logPayload, lead_id: dup.id });
          return Response.json({ ok: true, status: "duplicate", lead_id: dup.id });
        }

        const subject = mail.subject?.trim() || null;
        const body = bodyText(mail);
        const attachmentNames = (mail.attachments ?? []).map((a) => a.filename ?? "bilaga");

        // Känd avsändare: lägg mailet som anteckning på den befintliga leaden.
        const { data: existing } = await db
          .from("leads")
          .select("id, name, seller_id")
          .ilike("email", escapeLike(sender.email))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          const { error: actErr } = await db.from("lead_activities").insert({
            lead_id: existing.id,
            type: "note",
            description: buildActivityDescription(subject, body),
            metadata: { source: "email", email_id: resendId, message_id: mail.message_id ?? null },
            user_id: null,
          });
          if (actErr) {
            await log({ status_code: 500, status: "activity_insert_failed", error_message: actErr.message, payload: logPayload, lead_id: existing.id });
            return Response.json({ error: "Failed to record activity" }, { status: 500 });
          }
          await notify(
            existing.seller_id ? [existing.seller_id] : await adminIds(),
            "Nytt mail från kund",
            `${existing.name}: ${subject ?? "(inget ämne)"}`,
            existing.id,
          );
          await log({ status_code: 200, status: "activity_added", payload: logPayload, lead_id: existing.id });
          return Response.json({ ok: true, status: "activity_added", lead_id: existing.id });
        }

        // Ny avsändare: skapa fastighet + lead (samma form som hemsidans webhook).
        const { data: property, error: propErr } = await db
          .from("properties")
          .insert({ address: "Adress saknas (mailförfrågan)", municipality: "", region: "Stockholm" })
          .select("id")
          .single();
        if (propErr) {
          await log({ status_code: 500, status: "property_insert_failed", error_message: propErr.message, payload: logPayload });
          return Response.json({ error: "Failed to create property" }, { status: 500 });
        }

        const { data: lead, error: leadErr } = await db
          .from("leads")
          .insert({
            property_id: property.id,
            name: displayNameFor(sender),
            phone: extractPhone(`${subject ?? ""}\n${body}`),
            email: sender.email,
            status: "warm",
            source: "email",
            job_type: "roof_replacement",
            pipeline_stage: "inkommande_webb",
            notes: buildLeadNotes({ fromEmail: sender.email, subject, body, attachmentNames }),
            external_id: externalId,
          })
          .select("id")
          .single();
        if (leadErr) {
          await log({ status_code: 500, status: "lead_insert_failed", error_message: leadErr.message, payload: logPayload });
          return Response.json({ error: "Failed to create lead" }, { status: 500 });
        }

        await notify(
          await adminIds(),
          "Ny lead via mail",
          `${displayNameFor(sender)}: ${subject ?? "(inget ämne)"}`,
          lead.id,
        );
        await log({ status_code: 201, status: "created", payload: logPayload, lead_id: lead.id });
        return Response.json({ ok: true, status: "created", lead_id: lead.id }, { status: 201 });
      },
    },
  },
});
