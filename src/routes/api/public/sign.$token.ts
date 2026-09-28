import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import {
  buildSignedPdf,
  hashOtp,
  maskEmail,
  queueEmail,
  randomOtp,
  signingDocUrl,
  signingUrl,
} from '@/lib/signing.server'
import { markOfferAccepted } from '@/lib/offer-accepted.server'
import { markUeAgreementSigned } from '@/lib/ue-agreement.server'
import { computeWithdrawalDates, parseCustomerTerms } from '@/lib/customer-terms'

const fmtDateSv = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })

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
  // Offert som väntar på godkännande är inte synlig för kund (länken gäller först när den godkänts).
  if (data?.status === 'awaiting_approval') return null
  return data ?? null
}

function publicView(row: any, pdfUrl: string | null, terms: ReturnType<typeof parseCustomerTerms> | null) {
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
    // Kundvillkor (ångerrätt m.m.): bara satt när denna signeringsbegäran skapades i "full"-
    // eller "withdrawal_only"-läge (se customer-terms.ts). NULL/undefined för alla äldre eller
    // inaktiva offerter -- signeringssidan visar då ingenting nytt, exakt som idag. Vilket
    // kryssruta 1-lydelse som visas beror på om allmänna villkor bifogades (terms_pdf_path
    // satt = "full", annars "withdrawal_only") - se resolveCustomerTermsMode.
    termsVersion: row.customer_terms_version ?? null,
    ack1Label: row.customer_terms_version ? (row.terms_pdf_path ? terms?.ack_full_label : terms?.ack_withdrawal_label) ?? null : null,
    earlyStartCheckboxText: row.customer_terms_version ? terms?.early_start_checkbox_text ?? null : null,
    termsUrl: row.customer_terms_version && row.terms_pdf_path ? signingDocUrl(row.token, 'villkor') : null,
    withdrawalUrl: row.customer_terms_version && row.right_of_withdrawal_pdf_path ? signingDocUrl(row.token, 'angerratt') : null,
  }
}

export const Route = createFileRoute('/api/public/sign/$token')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const supabase = admin()
        const row = await loadRow(supabase, params.token)
        if (!row) return bad('not_found', 404)

        // Länkar till kundvillkors-PDF:erna (från mejlen): mintar en färsk, långlivad signerad
        // lagringslänk och skickar en 302-redirect dit, aldrig en rå länk i själva mejlet.
        const doc = new URL(request.url).searchParams.get('doc')
        if (doc === 'villkor' || doc === 'angerratt') {
          if (!row.customer_terms_version) return bad('not_found', 404)
          const path = doc === 'villkor' ? row.terms_pdf_path : row.right_of_withdrawal_pdf_path
          if (!path) return bad('not_found', 404)
          const { data: signed } = await supabase.storage.from('offers').createSignedUrl(path, 60 * 60 * 24 * 30)
          if (!signed?.signedUrl) return bad('not_found', 404)
          return Response.redirect(signed.signedUrl, 302)
        }

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

        let terms: ReturnType<typeof parseCustomerTerms> | null = null
        if (row.customer_terms_version) {
          const { data: cfgRow } = await supabase.from('app_settings').select('value').eq('key', 'customer_terms').maybeSingle()
          terms = parseCustomerTerms(cfgRow?.value)
        }

        return Response.json(publicView(row, signed?.signedUrl ?? null, terms))
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

          const isUeAgreement = row.document_type === 'avtal' && !!row.subcontractor_id
          const res = await queueEmail(supabase, {
            templateName: 'signature-otp',
            recipientEmail: row.customer_email,
            idempotencyKey: `sign-otp-${row.id}-${Date.now()}`,
            templateData: {
              code,
              offerNumber: row.offer_number,
              docLabel: isUeAgreement ? 'Ramavtal' : undefined,
            },
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

          // Kundvillkor (kryssruta 1, obligatorisk) - bara när denna begäran skapades med
          // aktiverade kundvillkor. Kryssruta 2 (tidig start) är alltid frivillig.
          const earlyStart = body.earlyStart === true
          if (row.customer_terms_version) {
            if (body.ack1 !== true) return bad('terms_ack_required')
          }

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

          const termsAck = row.customer_terms_version
            ? { ...(row.customer_terms_ack ?? {}), ack1_at: now.toISOString(), ack1_ip: ip, ack1_ua: userAgent }
            : row.customer_terms_ack

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
              customer_terms_ack: termsAck,
              early_start_requested: row.customer_terms_version ? earlyStart : false,
              early_start_requested_at: row.customer_terms_version && earlyStart ? now.toISOString() : null,
            })
            .eq('id', row.id)

          await markOfferAccepted(supabase, row, now)

          const isUeAgreement = row.document_type === 'avtal' && !!row.subcontractor_id
          if (isUeAgreement) {
            await markUeAgreementSigned(supabase, row, signedBytes, now)
          }

          const docUrl = signingUrl(row.token)
          const docLabel = isUeAgreement ? 'Ramavtal' : undefined
          const companyFallback = isUeAgreement ? 'VT6 Invest' : undefined

          let withdrawalEndDate: string | undefined
          let earlyStartSentence: string | undefined
          if (row.customer_terms_version) {
            const { withdrawalEndsAt } = computeWithdrawalDates(now)
            withdrawalEndDate = fmtDateSv(withdrawalEndsAt)
            if (earlyStart) {
              const { data: cfgRow } = await supabase.from('app_settings').select('value').eq('key', 'customer_terms').maybeSingle()
              const terms = parseCustomerTerms(cfgRow?.value)
              earlyStartSentence = terms.early_start_confirmed_sentence?.replaceAll('{datum}', withdrawalEndDate)
            }
          }

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
              docLabel,
              companyFallback,
              termsUrl: row.terms_pdf_path ? signingDocUrl(row.token, 'villkor') : undefined,
              withdrawalUrl: row.right_of_withdrawal_pdf_path ? signingDocUrl(row.token, 'angerratt') : undefined,
              withdrawalEndDate,
              earlyStartSentence,
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
                docLabel,
                companyFallback,
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
