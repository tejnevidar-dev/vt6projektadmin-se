import * as React from 'react'
import { render } from 'react-email'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'vt6projektadmin-se'
const SENDER_DOMAIN = 'notify.vt6projektadmin.se'
const FROM_DOMAIN = 'vt6projektadmin.se'

const TWILIO_GATEWAY = 'https://connector-gateway.lovable.dev/twilio'

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm',
    }).format(new Date(iso))
  } catch { return iso }
}

function intervalLabel(mins: number): string {
  if (mins >= 1440) {
    const d = Math.round(mins / 1440)
    return d === 1 ? 'imorgon' : `om ${d} dagar`
  }
  const h = Math.round(mins / 60)
  return h === 1 ? 'om 1 timme' : `om ${h} timmar`
}

function normalizePhone(raw: string): string | null {
  const trimmed = raw.replace(/[\s\-()]/g, '')
  if (!trimmed) return null
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('00')) return '+' + trimmed.slice(2)
  if (trimmed.startsWith('0')) return '+46' + trimmed.slice(1) // default Sweden
  return '+' + trimmed
}

async function generateUnsubscribeToken(): Promise<string> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sendEmail(supabase: any, params: {
  templateName: string
  recipientEmail: string
  templateData: Record<string, any>
  idempotencyKey: string
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const tpl = TEMPLATES[params.templateName]
  if (!tpl) return { ok: false, error: 'template_not_found' }
  const messageId = crypto.randomUUID()
  const normalized = params.recipientEmail.toLowerCase()

  const { data: suppressed } = await supabase
    .from('suppressed_emails').select('id').eq('email', normalized).maybeSingle()
  if (suppressed) return { ok: false, error: 'suppressed' }

  // Unsubscribe token
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalized).maybeSingle()
  let unsubscribeToken: string
  if (existingToken?.token && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = await generateUnsubscribeToken()
    await supabase.from('email_unsubscribe_tokens').upsert(
      { token: unsubscribeToken, email: normalized },
      { onConflict: 'email', ignoreDuplicates: true },
    )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens').select('token').eq('email', normalized).maybeSingle()
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

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
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
  if (enqueueError) return { ok: false, error: 'enqueue_failed:' + enqueueError.message }
  return { ok: true, messageId }
}

async function sendSms(params: { to: string; body: string }): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY
  const twilioKey = process.env.TWILIO_API_KEY
  const from = process.env.TWILIO_FROM_NUMBER
  if (!lovableKey || !twilioKey || !from) {
    return { ok: false, error: 'twilio_not_configured' }
  }
  const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': twilioKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: params.to, From: from, Body: params.body }),
  })
  const txt = await res.text()
  if (!res.ok) return { ok: false, error: `twilio_${res.status}:${txt.slice(0, 200)}` }
  try { const j = JSON.parse(txt); return { ok: true, sid: j.sid } } catch { return { ok: true } }
}

export const Route = createFileRoute('/api/public/hooks/send-booking-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get('apikey') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
        const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
        if (!authHeader || !expected || authHeader !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) return new Response('Config error', { status: 500 })
        const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

        // Grab due reminders — cap the batch
        const { data: due, error } = await supabase
          .from('booking_reminders')
          .select('id, lead_id, offset_minutes, channel, recipient_type, recipient_email, recipient_phone, recipient_name, attempts')
          .eq('status', 'pending')
          .lte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(50)
        if (error) return Response.json({ error: error.message }, { status: 500 })

        let sent = 0, failed = 0, skipped = 0
        for (const r of due ?? []) {
          // Load lead
          const { data: lead } = await supabase
            .from('leads').select('id, name, booking_date, property_id')
            .eq('id', r.lead_id).maybeSingle()
          if (!lead?.booking_date) {
            await supabase.from('booking_reminders').update({ status: 'cancelled', error_message: 'lead_or_booking_missing' }).eq('id', r.id)
            skipped++; continue
          }

          let address: string | undefined
          if (lead.property_id) {
            const { data: prop } = await supabase
              .from('properties').select('address, city, postal_code').eq('id', lead.property_id).maybeSingle()
            if (prop) address = [prop.address, prop.postal_code, prop.city].filter(Boolean).join(', ')
          }

          const bookingDate = fmtDate(lead.booking_date)
          const label = intervalLabel(r.offset_minutes)

          if (r.channel === 'email') {
            if (!r.recipient_email) {
              await supabase.from('booking_reminders').update({ status: 'skipped', error_message: 'no_email' }).eq('id', r.id)
              skipped++; continue
            }
            const result = await sendEmail(supabase, {
              templateName: 'booking-reminder',
              recipientEmail: r.recipient_email,
              idempotencyKey: `booking-reminder-${r.id}`,
              templateData: {
                greetName: r.recipient_name?.split(' ')[0],
                bookingDate,
                address,
                recipientType: r.recipient_type,
                intervalLabel: label,
              },
            })
            if (result.ok) {
              await supabase.from('booking_reminders').update({
                status: 'sent', sent_at: new Date().toISOString(), message_id: result.messageId, attempts: (r.attempts ?? 0) + 1,
              }).eq('id', r.id)
              sent++
            } else if (result.error === 'suppressed' || result.error === 'unsubscribed') {
              await supabase.from('booking_reminders').update({ status: 'skipped', error_message: result.error, attempts: (r.attempts ?? 0) + 1 }).eq('id', r.id)
              skipped++
            } else {
              const attempts = (r.attempts ?? 0) + 1
              await supabase.from('booking_reminders').update({
                status: attempts >= 3 ? 'failed' : 'pending',
                error_message: result.error,
                attempts,
              }).eq('id', r.id)
              failed++
            }
          } else if (r.channel === 'sms') {
            if (!r.recipient_phone) {
              await supabase.from('booking_reminders').update({ status: 'skipped', error_message: 'no_phone' }).eq('id', r.id)
              skipped++; continue
            }
            const to = normalizePhone(r.recipient_phone)
            if (!to) {
              await supabase.from('booking_reminders').update({ status: 'skipped', error_message: 'invalid_phone' }).eq('id', r.id)
              skipped++; continue
            }
            const isCustomer = r.recipient_type === 'kund'
            const body = isCustomer
              ? `Påminnelse: ditt bokade besök ${label} (${bookingDate}). Vänligen kontakta oss om något behöver ändras. / VT6 Projekt`
              : `Påminnelse: bokat jobb ${label} (${bookingDate})${address ? ' – ' + address : ''}. / admin.vt6`
            const result = await sendSms({ to, body })
            const attempts = (r.attempts ?? 0) + 1
            if (result.ok) {
              await supabase.from('booking_reminders').update({
                status: 'sent', sent_at: new Date().toISOString(), message_id: result.sid ?? null, attempts,
              }).eq('id', r.id)
              sent++
            } else if (result.error === 'twilio_not_configured') {
              await supabase.from('booking_reminders').update({ status: 'skipped', error_message: result.error, attempts }).eq('id', r.id)
              skipped++
            } else {
              await supabase.from('booking_reminders').update({
                status: attempts >= 3 ? 'failed' : 'pending',
                error_message: result.error, attempts,
              }).eq('id', r.id)
              failed++
            }
          }
        }

        return Response.json({ ok: true, processed: (due ?? []).length, sent, failed, skipped })
      },
    },
  },
})
