import type { ComponentType } from 'react'
import { template as selfChecksClientTemplate } from './self-checks-client'
import { template as bookingReminderTemplate } from './booking-reminder'

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
}
