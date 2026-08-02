import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import {
  buildSignedPdf,
  hashOtp,
  maskEmail,
  queueEmail,
  randomOtp,
  signingUrl,
} from '@/lib/signing.server'

const OTP_TTL_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 6

function admin() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('server_misconfigured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

function isExpired(row: any): boolean {
  return new Date(row.expires_at).getTime() < Date.now()
}

async function loadRow(supabase: any, token: string) {
  if (!token || token.length < 20) return null
  const { data } = await supabase
    .from('signature_requests')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  return data ?? null
}

function publicView(row: any, pdfUrl: string | null) {
  return {
    offerNumber: row.offer_number,
    customerName: row.customer_name,
    emailMasked: maskEmail(row.customer_email),
    companySigner: row.company_signer_name,
    companyPlace: row.company_place,
    companyDate: row.company_date,
    totalAmount: row.total_amount,
    status: isExpired(row) && row.status !== 'signed' ? 'expired' : row.status,
    signedAt: row.customer_signed_at,
    otpSent: Boolean(row.otp_sent_at) && !row.otp_verified_at,
    pdfUrl,
  }
}

export const Route = createFileRoute('/api/public/sign/$token')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const supabase = admin()
        const row = await loadRow(supabase, params.token)
        if (!row) return bad('not_found', 404)

        const path = row.signed_pdf_path ?? row.base_pdf_path
        const { data: signed } = await supabase.storage.from('offers').createSignedUrl(path, 60 * 30)

        if (!row.viewed_at && row.status === 'pending') {
          await supabase
            .from('signature_requests')
            .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
            .eq('id', row.id)
          row.viewed_at = new Date().toISOString()
          row.status = 'viewed'
        }

        return Response.json(publicView(row, signed?.signedUrl ?? null))
      },

      POST: async ({ params, request }) => {
        const supabase = admin()
        let body: any
        try {
          body = await request.json()
        } catch {
          return bad('invalid_json')
        }

        const row = await loadRow(supabase, params.token)
        if (!row) return bad('not_found', 404)
        if (row.status === 'signed') return bad('already_signed', 409)
        if (row.status === 'cancelled') return bad('cancelled', 409)
        if (isExpired(row)) return bad('expired', 410)

        // ---- Skicka engångskod ----
        if (body.action === 'request-otp') {
          if (row.otp_sent_at && Date.now() - new Date(row.otp_sent_at).getTime() < 45_000) {
            return bad('too_soon', 429)
          }
          const code = randomOtp()
          const hash = await hashOtp(row.token, code)
          await supabase
            .from('signature_requests')
            .update({ otp_code_hash: hash, otp_sent_at: new Date().toISOString(), otp_attempts: 0 })
            .eq('id', row.id)

          const res = await queueEmail(supabase, {
            templateName: 'signature-otp',
            recipientEmail: row.customer_email,
            idempotencyKey: `sign-otp-${row.id}-${Date.now()}`,
            templateData: { code, offerNumber: row.offer_number },
          })
          if (!res.ok) return bad('email_failed:' + (res.error ?? ''), 502)
          return Response.json({ ok: true, emailMasked: maskEmail(row.customer_email) })
        }

        // ---- Signera ----
        if (body.action === 'sign') {
          const code = String(body.code ?? '').trim()
          const name = String(body.name ?? '').trim()
          const place = String(body.place ?? '').trim()
          const png = String(body.signaturePng ?? '')

          if (!/^\d{6}$/.test(code)) return bad('invalid_code_format')
          if (name.length < 2 || name.length > 120) return bad('invalid_name')
          if (place.length < 2 || place.length > 120) return bad('invalid_place')
          if (!png.startsWith('data:image/png;base64,') || png.length > 800_000)
            return bad('invalid_signature')
          if (!row.otp_code_hash || !row.otp_sent_at) return bad('no_code_requested')
          if (Date.now() - new Date(row.otp_sent_at).getTime() > OTP_TTL_MS) return bad('code_expired')
          if ((row.otp_attempts ?? 0) >= MAX_ATTEMPTS) return bad('too_many_attempts', 429)

          const hash = await hashOtp(row.token, code)
          if (hash !== row.otp_code_hash) {
            await supabase
              .from('signature_requests')
              .update({ otp_attempts: (row.otp_attempts ?? 0) + 1 })
              .eq('id', row.id)
            return bad('wrong_code', 401)
          }

          const now = new Date()
          const ip =
            request.headers.get('cf-connecting-ip') ??
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            null
          const userAgent = request.headers.get('user-agent')
          const todayIso = now.toISOString().slice(0, 10)

          // Hämta original-PDF
          const { data: file, error: dlErr } = await supabase.storage
            .from('offers')
            .download(row.base_pdf_path)
          if (dlErr || !file) return bad('pdf_missing', 500)
          const baseBytes = new Uint8Array(await file.arrayBuffer())

          const signedBytes = await buildSignedPdf(baseBytes, {
            documentId: row.id,
            offerNumber: row.offer_number,
            customerEmail: row.customer_email,
            company: {
              name: row.company_signer_name,
              place: row.company_place,
              date: row.company_date,
              signaturePng: row.company_signature_png,
              signedAt: row.company_signed_at
                ? new Date(row.company_signed_at).toLocaleString('sv-SE')
                : null,
            },
            customer: {
              name,
              place,
              date: todayIso,
              signaturePng: png,
              signedAt: now.toLocaleString('sv-SE'),
            },
            verifiedAt: now.toLocaleString('sv-SE'),
            ip,
            userAgent,
          })

          const signedPath = `signering/${row.id}/signerad-offert-${row.offer_number}.pdf`
          const { error: upErr } = await supabase.storage
            .from('offers')
            .upload(signedPath, signedBytes, { contentType: 'application/pdf', upsert: true })
          if (upErr) return bad('upload_failed', 500)

          await supabase
            .from('signature_requests')
            .update({
              status: 'signed',
              signed_pdf_path: signedPath,
              customer_signer_name: name,
              customer_place: place,
              customer_date: todayIso,
              customer_signature_png: png,
              customer_signed_at: now.toISOString(),
              customer_ip: ip,
              customer_user_agent: userAgent,
              otp_verified_at: now.toISOString(),
              otp_code_hash: null,
            })
            .eq('id', row.id)

          const docUrl = signingUrl(row.token)

          // Kopia till kund
          await queueEmail(supabase, {
            templateName: 'signature-completed',
            recipientEmail: row.customer_email,
            idempotencyKey: `sign-done-cust-${row.id}`,
            templateData: {
              recipientName: name,
              offerNumber: row.offer_number,
              documentUrl: docUrl,
              customerName: name,
              companySigner: row.company_signer_name,
              isInternal: false,
            },
          })

          // Kopia internt till den som skapade offerten
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, display_name')
            .eq('id', row.created_by)
            .maybeSingle()
          if (profile?.email) {
            await queueEmail(supabase, {
              templateName: 'signature-completed',
              recipientEmail: profile.email,
              idempotencyKey: `sign-done-int-${row.id}`,
              templateData: {
                recipientName: profile.display_name ?? '',
                offerNumber: row.offer_number,
                documentUrl: docUrl,
                customerName: name,
                companySigner: row.company_signer_name,
                isInternal: true,
              },
            })
          }

          const { data: signedUrl } = await supabase.storage
            .from('offers')
            .createSignedUrl(signedPath, 60 * 30)

          return Response.json({ ok: true, pdfUrl: signedUrl?.signedUrl ?? null })
        }

        return bad('unknown_action')
      },
    },
  },
})
