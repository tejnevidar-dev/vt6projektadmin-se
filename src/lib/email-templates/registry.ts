import type { ComponentType } from 'react'
import { template as selfChecksClientTemplate } from './self-checks-client'
import { template as bookingReminderTemplate } from './booking-reminder'
import { template as signatureRequestTemplate } from './signature-request'
import { template as signatureOtpTemplate } from './signature-otp'
import { template as signatureCompletedTemplate } from './signature-completed'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'self-checks-client': selfChecksClientTemplate,
  'booking-reminder': bookingReminderTemplate,
  'signature-request': signatureRequestTemplate,
  'signature-otp': signatureOtpTemplate,
  'signature-completed': signatureCompletedTemplate,
}
