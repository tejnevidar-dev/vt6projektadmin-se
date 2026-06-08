
CREATE OR REPLACE FUNCTION public.handle_lead_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment_type public.job_assignment_type;
BEGIN
  -- Create/upsert the job when a lead is booked with an assignee
  IF NEW.pipeline_stage = 'bokad'::pipeline_stage
     AND NEW.assigned_to IS NOT NULL
     AND (OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage
          OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  THEN
    IF private.has_role(NEW.assigned_to, 'underentreprenor'::app_role) THEN
      v_assignment_type := 'underentreprenor';
    ELSIF private.has_role(NEW.assigned_to, 'arbetsledare'::app_role) THEN
      v_assignment_type := 'arbetsledare';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.jobs (lead_id, assigned_to, assignment_type, fixed_price)
    VALUES (NEW.id, NEW.assigned_to, v_assignment_type,
            CASE WHEN v_assignment_type = 'underentreprenor' THEN NEW.subcontractor_price ELSE NULL END)
    ON CONFLICT (lead_id) DO UPDATE
      SET assigned_to = EXCLUDED.assigned_to,
          assignment_type = EXCLUDED.assignment_type,
          fixed_price = COALESCE(EXCLUDED.fixed_price, public.jobs.fixed_price),
          updated_at = now();
  END IF;

  -- Sync job status when lead pipeline moves to pågående or slutförd
  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    IF NEW.pipeline_stage = 'pagaende'::pipeline_stage THEN
      UPDATE public.jobs
         SET status = 'pagaende'::job_status, updated_at = now()
       WHERE lead_id = NEW.id AND status = 'ej_paborjad'::job_status;
    ELSIF NEW.pipeline_stage = 'slutford'::pipeline_stage THEN
      UPDATE public.jobs
         SET status = 'klar'::job_status, updated_at = now()
       WHERE lead_id = NEW.id AND status <> 'klar'::job_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
