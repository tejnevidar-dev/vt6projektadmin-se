import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'
type LogStatus = 'bounced' | 'complained' | 'suppressed'

function adminClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function record(
  recipient: string,
  messageId: string | null | undefined,
  reason: SuppressionReason,
  status: LogStatus,
  message: string,
) {
  const supabase = adminClient()
  const normalized = recipient.toLowerCase()

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email: normalized, reason, metadata: null }, { onConflict: 'email' })
  if (suppressError) {
    console.error('Failed to record suppression', {
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('suppression_write_failed')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId ?? null,
    template_name: 'system',
    recipient_email: normalized,
    status,
    error_message: message,
    metadata: null,
  })
  if (logError) {
    console.error('Failed to record email event log', {
      code: logError.code,
      message: logError.message,
    })
    throw new Error('log_write_failed')
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await record(
                event.data.recipient,
                event.data.message_id,
                'bounce',
                'bounced',
                'Permanent bounce — email address is invalid or rejected',
              )
              console.log('Email bounced', { event_id: event.event_id })
            },
            'email.complaint': async (event) => {
              await record(
                event.data.recipient,
                event.data.message_id,
                'complaint',
                'complained',
                'Spam complaint — recipient marked email as spam',
              )
              console.log('Email complaint', { event_id: event.event_id })
            },
            'email.unsubscribed': async (event) => {
              await record(
                event.data.recipient,
                event.data.message_id,
                'unsubscribe',
                'suppressed',
                'Recipient unsubscribed',
              )
              console.log('Email unsubscribed', { event_id: event.event_id })
            },
          },
        })
        return handler(request)
      },
    },
  },
})
