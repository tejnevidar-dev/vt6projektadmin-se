-- In-app notification system (first use of this pattern in the schema). Rows are
-- created either by a server-side service-role client (e.g. the stale-lead-reminder
-- cron task) or by a SECURITY DEFINER trigger (e.g. notifying admins when an ATA
-- becomes 'pending') -- never directly by an authenticated client, so there is no
-- INSERT policy for `authenticated` below. Recipients can only read/mark-read their
-- own rows.
--
-- NOTE: notification title/body text below uses plain ASCII (no å/ä/ö) -- this exact
-- text is what's actually live on production (applied via Supabase's SQL editor,
-- pasted through a clipboard round-trip where non-ASCII felt riskier to verify byte-
-- for-byte than it was worth for a notification string). Keep any future edits to
-- this function ASCII-only too, or re-verify byte-for-byte after pasting.

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users mark own notifications read"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Live badge updates without a page reload.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ===== Notify all admins when an ATA enters 'pending' approval =====
CREATE OR REPLACE FUNCTION public.notify_admins_on_ata_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.approval_status IS DISTINCT FROM 'pending') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT ur.user_id,
           'ata_pending',
           'ATA vantar pa godkannande',
           coalesce(NEW.ata_number, 'En ATA') || ' pa ' || NEW.total_amount || ' kr behover godkannas.',
           '/jobb/' || NEW.job_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::app_role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_on_ata_pending
AFTER INSERT OR UPDATE ON public.atas
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_ata_pending();
