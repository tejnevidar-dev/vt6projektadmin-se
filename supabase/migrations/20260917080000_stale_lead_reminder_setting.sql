-- Admin-editable threshold for the stale-lead reminder cron
-- (src/lib/stale-lead-reminders.server.ts), same pattern as ata_approval_threshold --
-- change it later with a plain UPDATE, no migration needed.
INSERT INTO public.app_settings (key, value)
VALUES ('stale_lead_reminder_days', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;
