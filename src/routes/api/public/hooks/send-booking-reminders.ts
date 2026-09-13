import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { processBookingReminders } from '@/lib/booking-reminders.server'

// Kept for manual/debug triggering. The recurring 5-minute schedule (previously
// Lovable Cloud's "Jobs" feature) now runs via a Cloudflare Cron Trigger --
// see tasks/send-booking-reminders.ts.

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

        try {
          const result = await processBookingReminders(supabase)
          return Response.json({ ok: true, ...result })
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
        }
      },
    },
  },
})
