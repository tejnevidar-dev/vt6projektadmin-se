import { sendAndLogEmail } from '@/lib/email-send-log.server'
export { buildSignedPdf } from './signing-pdf.server'
export type { SignatureParty, SignedPdfMeta } from './signing-pdf.server'

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

/** Sends a transactional email through Lovable's managed email delivery. */
export async function queueEmail(
  supabase: any,
  params: {
    templateName: string
    recipientEmail: string
    templateData: Record<string, any>
    idempotencyKey: string
  },
): Promise<{ ok: boolean; error?: string }> {
  return sendAndLogEmail(supabase, params)
}
