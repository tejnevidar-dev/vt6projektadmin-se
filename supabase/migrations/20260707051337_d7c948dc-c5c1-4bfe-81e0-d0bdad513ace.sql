
-- Fix: Revoke public execute on SECURITY DEFINER RPC; lookups now happen via server-side admin route.
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon, authenticated;

-- The "Admins can view email send state" policy this migration originally created is
-- now created up front in 20260707050000_add_missing_email_tables.sql (added
-- 2026-09-07, alongside the table itself, which was missing from migration history
-- entirely) -- removed here to avoid a duplicate-policy error on a fresh database.
