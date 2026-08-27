import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { sendAndLogEmail } from '@/lib/email-send-log.server'

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

async function sendEmail(supabase: any, params: {
  templateName: string
  recipientEmail: string
  templateData: Record<string, any>
  idempotencyKey: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await sendAndLogEmail(supabase, params)
  if (!result.ok) return { ok: false, error: result.error ?? 'send_failed' }
  return { ok: true }
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
              .from('properties').select('address, municipality').eq('id', lead.property_id).maybeSingle()
            if (prop) address = [prop.address, prop.municipality].filter(Boolean).join(', ')
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
                status: 'sent', sent_at: new Date().toISOString(), attempts: (r.attempts ?? 0) + 1,
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
