CREATE OR REPLACE FUNCTION public.handle_lead_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment_type public.job_assignment_type;
BEGIN
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
  RETURN NEW;
END;
$function$;