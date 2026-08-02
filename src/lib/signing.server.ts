import * as React from 'react'
import { render } from 'react-email'
import { TEMPLATES } from '@/lib/email-templates/registry'
export { buildSignedPdf } from './signing-pdf.server'
export type { SignatureParty, SignedPdfMeta } from './signing-pdf.server'

const SITE_NAME = 'vt6projektadmin-se'
const SENDER_DOMAIN = 'notify.vt6projektadmin.se'
const FROM_DOMAIN = 'vt6projektadmin.se'

export const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://vt6projektadmin.se'

export function signingUrl(token: string): string {
  return `${PUBLIC_SITE_URL}/signera/${token}`
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomOtp(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(100000 + (arr[0] % 900000))
}

export async function hashOtp(token: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${token}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const head = local.slice(0, 1)
  return `${head}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Queues a transactional email using the project's email queue. */
export async function queueEmail(
  supabase: any,
  params: {
    templateName: string
    recipientEmail: string
    templateData: Record<string, any>
    idempotencyKey: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const tpl = TEMPLATES[params.templateName]
  if (!tpl) return { ok: false, error: 'template_not_found' }
  const messageId = crypto.randomUUID()
  const normalized = params.recipientEmail.toLowerCase()

  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalized)
    .maybeSingle()
  if (suppressed) return { ok: false, error: 'suppressed' }

  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  let unsubscribeToken: string
  if (existingToken?.token && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = randomToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalized)
      .maybeSingle()
    if (!stored?.token) return { ok: false, error: 'token_store_failed' }
    unsubscribeToken = stored.token
  } else {
    return { ok: false, error: 'unsubscribed' }
  }

  const element = React.createElement(tpl.component, params.templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(params.templateData) : tpl.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: params.templateName,
    recipient_email: params.recipientEmail,
    status: 'pending',
  })

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: params.recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: params.templateName,
      idempotency_key: params.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) return { ok: false, error: 'enqueue_failed:' + error.message }
  return { ok: true }
}
