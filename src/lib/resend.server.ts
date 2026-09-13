import { Resend } from "resend";

// Replaces Lovable's managed email API. Lovable checked the suppression list
// server-side before every send (a `recipient_suppressed` EmailAPIError) --
// Resend has no equivalent for a custom suppression list, so we check our own
// `suppressed_emails` table (already populated, see supabase/migrations) ourselves
// before calling Resend.

export class EmailSuppressedError extends Error {
  constructor(recipient: string) {
    super(`Recipient is suppressed: ${recipient}`);
    this.name = "EmailSuppressedError";
  }
}

let client: Resend | undefined;
function resendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (!client) client = new Resend(apiKey);
  return client;
}

export interface SendResendEmailInput {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Used as Resend's idempotency key -- retries of the same logical send won't double-send. */
  idempotencyKey?: string;
}

export interface SendResendEmailResult {
  messageId: string;
}

/**
 * Checks our own suppression list, then sends via Resend. Throws
 * EmailSuppressedError (caller should treat this the same way the old
 * `{ sent: false, reason: 'recipient_suppressed' }` result was treated) or
 * whatever error Resend's SDK throws for a hard send failure.
 */
export async function sendResendEmail(
  supabase: { from: (table: string) => any },
  input: SendResendEmailInput,
): Promise<SendResendEmailResult> {
  const normalizedRecipient = input.to.trim().toLowerCase();

  const { data: suppressed, error: suppressionCheckError } = await supabase
    .from("suppressed_emails")
    .select("email")
    .eq("email", normalizedRecipient)
    .maybeSingle();
  if (suppressionCheckError) {
    console.error("Failed to check suppressed_emails", suppressionCheckError);
    // Fail closed on infra errors would block all mail; fail open and let it send --
    // the suppression check is a courtesy, not the only safety net (Resend still
    // won't retry a hard bounce into a mailbox that rejects it).
  }
  if (suppressed) {
    throw new EmailSuppressedError(normalizedRecipient);
  }

  const result = await resendClient().emails.send({
    to: input.to,
    from: input.from,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    headers: input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : undefined,
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  if (!result.data?.id) {
    throw new Error("Resend send returned no message id");
  }
  return { messageId: result.data.id };
}
