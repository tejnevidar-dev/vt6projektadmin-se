-- email_queue_dispatch()/email_queue_wake() no longer exist in production (confirmed
-- 2026-09-07 -- they predate this migration history's capture and were apparently
-- dropped directly via SQL editor at some point, superseded by the email_send_log/
-- email_send_state/suppressed_emails tables). Guarded so this migration is a safe no-op
-- on any database where they don't exist, instead of failing `supabase db push`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'email_queue_dispatch' AND p.pronargs = 0
  ) THEN
    REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'email_queue_wake' AND p.pronargs = 0
  ) THEN
    REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;
  END IF;
END $$;