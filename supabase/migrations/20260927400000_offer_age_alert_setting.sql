-- Admin-editable threshold for the offer-age-alert cron (src/lib/offer-age-alert.server.ts),
-- same pattern as stale_lead_reminder_days/ata_approval_threshold -- change it later with a
-- plain UPDATE, no migration needed. Driftchefens klartecken 2026-09-27: 7 dagar, notis till
-- ansvarig säljare, ingen notis till kund.
INSERT INTO public.app_settings (key, value)
VALUES ('offer_age_alert_days', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;
