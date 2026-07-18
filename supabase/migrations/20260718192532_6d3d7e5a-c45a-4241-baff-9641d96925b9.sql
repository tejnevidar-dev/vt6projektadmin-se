
-- Auto-create an internal calendar event when a lead is booked (pipeline_stage='bokad' with a booking_date)
CREATE OR REPLACE FUNCTION public.sync_booking_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_job_id uuid;
  v_event_id uuid;
  v_title text;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NEW.pipeline_stage <> 'bokad'::pipeline_stage OR NEW.booking_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only run when booking newly set/changed or stage just became bokad
  IF TG_OP = 'UPDATE'
     AND OLD.pipeline_stage IS NOT DISTINCT FROM NEW.pipeline_stage
     AND OLD.booking_date IS NOT DISTINCT FROM NEW.booking_date
     AND OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN
    RETURN NEW;
  END IF;

  v_owner := COALESCE(NEW.assigned_to, NEW.created_by);
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_job_id FROM public.jobs WHERE lead_id = NEW.id LIMIT 1;

  v_start := NEW.booking_date;
  v_end := NEW.booking_date + interval '1 hour';
  v_title := 'Bokning: ' || COALESCE(NEW.name, 'Kund');

  -- Find existing auto-created event for this lead (internal side)
  SELECT id INTO v_event_id
  FROM public.calendar_events
  WHERE lead_id = NEW.id AND side = 'intern'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_event_id IS NULL THEN
    INSERT INTO public.calendar_events (side, owner_id, title, lead_id, job_id, start_at, end_at, all_day)
    VALUES ('intern', v_owner, v_title, NEW.id, v_job_id, v_start, v_end, false)
    RETURNING id INTO v_event_id;
  ELSE
    UPDATE public.calendar_events
    SET title = v_title,
        start_at = v_start,
        end_at = v_end,
        job_id = COALESCE(v_job_id, job_id),
        owner_id = v_owner,
        updated_at = now()
    WHERE id = v_event_id;
  END IF;

  -- Share with assigned user (idempotent)
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> v_owner THEN
    INSERT INTO public.calendar_event_shares_users (event_id, user_id)
    VALUES (v_event_id, NEW.assigned_to)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_calendar_event ON public.leads;
CREATE TRIGGER trg_sync_booking_calendar_event
AFTER INSERT OR UPDATE OF pipeline_stage, booking_date, assigned_to ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_booking_calendar_event();
