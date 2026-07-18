
CREATE TABLE public.booking_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  offset_minutes INT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('kund','tilldelad','admin')),
  recipient_user_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped','cancelled')),
  error_message TEXT,
  message_id TEXT,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_reminders_due_idx ON public.booking_reminders (status, scheduled_at) WHERE status = 'pending';
CREATE INDEX booking_reminders_lead_idx ON public.booking_reminders (lead_id);

GRANT SELECT ON public.booking_reminders TO authenticated;
GRANT ALL ON public.booking_reminders TO service_role;

ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all reminders"
  ON public.booking_reminders FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_booking_reminders_updated_at
BEFORE UPDATE ON public.booking_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Schedule reminders for a booked lead
CREATE OR REPLACE FUNCTION public.schedule_booking_reminders(_lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_offset INT;
  v_offsets INT[] := ARRAY[20160, 10080, 7200, 4320, 1440]; -- 14d,7d,5d,3d,24h in minutes
  v_scheduled TIMESTAMPTZ;
  v_admin RECORD;
  v_assigned RECORD;
BEGIN
  SELECT id, name, email, phone, booking_date, pipeline_stage, assigned_to
    INTO v_lead FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Remove any not-yet-sent reminders for this lead so we regenerate cleanly
  DELETE FROM public.booking_reminders
   WHERE lead_id = _lead_id AND status = 'pending';

  IF v_lead.pipeline_stage <> 'bokad'::pipeline_stage OR v_lead.booking_date IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_offset IN ARRAY v_offsets LOOP
    v_scheduled := v_lead.booking_date - make_interval(mins => v_offset);
    -- Skip past intervals
    IF v_scheduled <= now() THEN CONTINUE; END IF;

    -- Kund
    IF v_lead.email IS NOT NULL AND length(trim(v_lead.email)) > 0 THEN
      INSERT INTO public.booking_reminders(lead_id, offset_minutes, channel, recipient_type, recipient_email, recipient_name, scheduled_at)
      VALUES (_lead_id, v_offset, 'email', 'kund', v_lead.email, v_lead.name, v_scheduled);
    END IF;
    IF v_lead.phone IS NOT NULL AND length(trim(v_lead.phone)) > 0 THEN
      INSERT INTO public.booking_reminders(lead_id, offset_minutes, channel, recipient_type, recipient_phone, recipient_name, scheduled_at)
      VALUES (_lead_id, v_offset, 'sms', 'kund', v_lead.phone, v_lead.name, v_scheduled);
    END IF;

    -- Tilldelad
    IF v_lead.assigned_to IS NOT NULL THEN
      SELECT p.email AS email, e.phone AS phone, COALESCE(p.display_name, e.full_name, p.email) AS name
        INTO v_assigned
        FROM public.profiles p
        LEFT JOIN public.employees e ON e.user_id = p.id
       WHERE p.id = v_lead.assigned_to;
      IF v_assigned.email IS NOT NULL THEN
        INSERT INTO public.booking_reminders(lead_id, offset_minutes, channel, recipient_type, recipient_user_id, recipient_email, recipient_name, scheduled_at)
        VALUES (_lead_id, v_offset, 'email', 'tilldelad', v_lead.assigned_to, v_assigned.email, v_assigned.name, v_scheduled);
      END IF;
      IF v_assigned.phone IS NOT NULL AND length(trim(v_assigned.phone)) > 0 THEN
        INSERT INTO public.booking_reminders(lead_id, offset_minutes, channel, recipient_type, recipient_user_id, recipient_phone, recipient_name, scheduled_at)
        VALUES (_lead_id, v_offset, 'sms', 'tilldelad', v_lead.assigned_to, v_assigned.phone, v_assigned.name, v_scheduled);
      END IF;
    END IF;

    -- Admins
    FOR v_admin IN
      SELECT p.id AS user_id, p.email AS email, e.phone AS phone,
             COALESCE(p.display_name, e.full_name, p.email) AS name
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        LEFT JOIN public.employees e ON e.user_id = p.id
       WHERE ur.role = 'admin'::app_role
    LOOP
      IF v_admin.email IS NOT NULL THEN
        INSERT INTO public.booking_reminders(lead_id, offset_minutes, channel, recipient_type, recipient_user_id, recipient_email, recipient_name, scheduled_at)
        VALUES (_lead_id, v_offset, 'email', 'admin', v_admin.user_id, v_admin.email, v_admin.name, v_scheduled);
      END IF;
      IF v_admin.phone IS NOT NULL AND length(trim(v_admin.phone)) > 0 THEN
        INSERT INTO public.booking_reminders(lead_id, offset_minutes, channel, recipient_type, recipient_user_id, recipient_phone, recipient_name, scheduled_at)
        VALUES (_lead_id, v_offset, 'sms', 'admin', v_admin.user_id, v_admin.phone, v_admin.name, v_scheduled);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.schedule_booking_reminders(UUID) FROM PUBLIC, anon, authenticated;

-- Trigger: on lead insert/update, (re)schedule reminders when booking-related fields change
CREATE OR REPLACE FUNCTION public.trg_leads_schedule_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pipeline_stage = 'bokad'::pipeline_stage AND NEW.booking_date IS NOT NULL THEN
      PERFORM public.schedule_booking_reminders(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage
     OR NEW.booking_date IS DISTINCT FROM OLD.booking_date
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    PERFORM public.schedule_booking_reminders(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_leads_schedule_reminders() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_leads_booking_reminders ON public.leads;
CREATE TRIGGER trg_leads_booking_reminders
AFTER INSERT OR UPDATE OF pipeline_stage, booking_date, assigned_to ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_leads_schedule_reminders();
