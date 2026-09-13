-- Four tables used by the email-sending code (src/lib/email-send-log.server.ts and
-- related) were created directly in the database (Lovable/Supabase SQL editor) and were
-- never captured in a migration -- discovered because migration 20260707051337 (which
-- adds a policy on email_send_state) fails on a fresh database with "relation does not
-- exist". Reproduced here from the LIVE schema (columns, constraints, indexes, RLS
-- policies all queried directly from production, 2026-09-07) so this matches actual
-- current behavior exactly.

-- ===== email_send_log =====
CREATE TABLE public.email_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_send_log_created ON public.email_send_log USING btree (created_at DESC);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log USING btree (recipient_email);
CREATE INDEX idx_email_send_log_message ON public.email_send_log USING btree (message_id);
CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique ON public.email_send_log USING btree (message_id) WHERE (status = 'sent'::text);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert send log"
ON public.email_send_log FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can read send log"
ON public.email_send_log FOR SELECT TO public
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can update send log"
ON public.email_send_log FOR UPDATE TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- ===== email_send_state (singleton config row, id defaults to 1) =====
CREATE TABLE public.email_send_state (
  id INTEGER NOT NULL DEFAULT 1 PRIMARY KEY,
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_send_state TO authenticated;
GRANT ALL ON public.email_send_state TO service_role;
ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email send state"
ON public.email_send_state FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage send state"
ON public.email_send_state FOR ALL TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- ===== email_unsubscribe_tokens =====
CREATE TABLE public.email_unsubscribe_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

-- Non-unique index on token duplicates the unique constraint's own index, but it exists
-- in production this way -- kept for exact parity rather than "cleaned up" here.
CREATE INDEX idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens USING btree (token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_unsubscribe_tokens TO authenticated;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert tokens"
ON public.email_unsubscribe_tokens FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can mark tokens as used"
ON public.email_unsubscribe_tokens FOR UPDATE TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can read tokens"
ON public.email_unsubscribe_tokens FOR SELECT TO public
USING (auth.role() = 'service_role'::text);

-- ===== suppressed_emails =====
CREATE TABLE public.suppressed_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Same as above: non-unique index duplicating the unique constraint, kept for parity.
CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails USING btree (email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppressed_emails TO authenticated;
GRANT ALL ON public.suppressed_emails TO service_role;
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert suppressed emails"
ON public.suppressed_emails FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can read suppressed emails"
ON public.suppressed_emails FOR SELECT TO public
USING (auth.role() = 'service_role'::text);
