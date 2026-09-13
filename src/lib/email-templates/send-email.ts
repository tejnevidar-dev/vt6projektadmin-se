import * as React from 'react'
import { render } from '@react-email/render'
import { EmailSuppressedError, sendResendEmail } from '@/lib/resend.server'
import { TEMPLATES } from './registry'

// Server-only: reads RESEND_API_KEY. Never import from client components.

// Configuration
const SITE_NAME = "admin.vt6"
// FROM_DOMAIN must have Resend domain verification (SPF/DKIM) set up in the Resend
// dashboard before sending will work. NEVER use an unverified domain. A subdomain
// (not the root domain) isolates sending reputation from any regular company email
// on the root domain -- matches the sender domain Lovable used before.
const FROM_DOMAIN = "notify.vt6projektadmin.se"

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string
  replyTo?: string
}

/**
 * Renders a registered template and sends it via Resend. Checks our own
 * `suppressed_emails` table first (Resend has no built-in equivalent to
 * Lovable's server-side suppression check). A suppressed recipient is an
 * expected outcome ({ sent: false }); any other failure throws.
 */
export async function sendTemplateEmail(
  supabase: { from: (table: string) => any },
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  try {
    await sendResendEmail(supabase, {
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      subject,
      html,
      text,
      idempotencyKey: options.idempotencyKey || crypto.randomUUID(),
      replyTo: options.replyTo,
    })
  } catch (error) {
    if (error instanceof EmailSuppressedError) {
      return { sent: false, reason: 'recipient_suppressed' }
    }
    throw error
  }

  return { sent: true }
}
