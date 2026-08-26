import { sendTemplateEmail } from '@/lib/email-templates/send-email'

/**
 * Sends a registered template through Lovable's managed email API and mirrors
 * the outcome into the app's own email_send_log table (app history only —
 * suppression and retries are enforced by Lovable server-side).
 */
export async function sendAndLogEmail(
  supabase: any,
  params: {
    templateName: string
    recipientEmail: string
    templateData?: Record<string, any>
    idempotencyKey: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const log = async (status: string, errorMessage?: string) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: params.templateName,
      recipient_email: params.recipientEmail,
      status,
      error_message: errorMessage ?? null,
    })
    if (error) {
      console.error('Failed to write email_send_log', {
        code: error.code,
        message: error.message,
      })
    }
  }

  try {
    const result = await sendTemplateEmail(params.templateName, params.recipientEmail, {
      templateData: params.templateData ?? {},
      idempotencyKey: params.idempotencyKey,
    })
    if (!result.sent) {
      await log('suppressed', 'Recipient is suppressed (bounce, complaint or unsubscribe)')
      return { ok: false, error: 'suppressed' }
    }
    await log('sent')
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log('failed', message.slice(0, 1000))
    return { ok: false, error: message }
  }
}
