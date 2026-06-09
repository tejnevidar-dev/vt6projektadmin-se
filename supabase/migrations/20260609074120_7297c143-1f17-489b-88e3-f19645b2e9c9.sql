
-- Allow jobs without an assignee yet (so a lead moving to "pågående" auto-creates a job that admin assigns later)
ALTER TABLE public.jobs ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN assignment_type DROP NOT NULL;

-- Update the lead booking trigger to also create a job when a lead moves to "pågående"
CREATE OR REPLACE FUNCTION public.handle_lead_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment_type public.job_assignment_type;
  v_has_job boolean;
BEGIN
  -- (1) Booked with assignee → upsert job (existing behavior)
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
      v_assignment_type := NULL;
    END IF;

    INSERT INTO public.jobs (lead_id, assigned_to, assignment_type, fixed_price)
    VALUES (NEW.id, NEW.assigned_to, v_assignment_type,
            CASE WHEN v_assignment_type = 'underentreprenor' THEN NEW.subcontractor_price ELSE NULL END)
    ON CONFLICT (lead_id) DO UPDATE
      SET assigned_to = EXCLUDED.assigned_to,
          assignment_type = COALESCE(EXCLUDED.assignment_type, public.jobs.assignment_type),
          fixed_price = COALESCE(EXCLUDED.fixed_price, public.jobs.fixed_price),
          updated_at = now();
  END IF;

  -- (2) Sync job status when pipeline moves to pågående or slutförd.
  -- If no job exists yet (e.g. moved directly from any stage to pågående without assignee), create one.
  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    IF NEW.pipeline_stage = 'pagaende'::pipeline_stage THEN
      SELECT EXISTS(SELECT 1 FROM public.jobs WHERE lead_id = NEW.id) INTO v_has_job;
      IF NOT v_has_job THEN
        IF NEW.assigned_to IS NOT NULL THEN
          IF private.has_role(NEW.assigned_to, 'underentreprenor'::app_role) THEN
            v_assignment_type := 'underentreprenor';
          ELSIF private.has_role(NEW.assigned_to, 'arbetsledare'::app_role) THEN
            v_assignment_type := 'arbetsledare';
          ELSE
            v_assignment_type := NULL;
          END IF;
        ELSE
          v_assignment_type := NULL;
        END IF;

        INSERT INTO public.jobs (lead_id, assigned_to, assignment_type, status, fixed_price)
        VALUES (NEW.id, NEW.assigned_to, v_assignment_type, 'pagaende'::job_status,
                CASE WHEN v_assignment_type = 'underentreprenor' THEN NEW.subcontractor_price ELSE NULL END);
      ELSE
        UPDATE public.jobs
           SET status = 'pagaende'::job_status, updated_at = now()
         WHERE lead_id = NEW.id AND status = 'ej_paborjad'::job_status;
      END IF;
    ELSIF NEW.pipeline_stage = 'slutford'::pipeline_stage THEN
      UPDATE public.jobs
         SET status = 'klar'::job_status, updated_at = now()
       WHERE lead_id = NEW.id AND status <> 'klar'::job_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: create job rows for any leads already in "pågående" (or "slutförd") that don't have one yet
INSERT INTO public.jobs (lead_id, assigned_to, assignment_type, status, fixed_price)
SELECT l.id,
       l.assigned_to,
       CASE
         WHEN l.assigned_to IS NULL THEN NULL
         WHEN private.has_role(l.assigned_to, 'underentreprenor'::app_role) THEN 'underentreprenor'::job_assignment_type
         WHEN private.has_role(l.assigned_to, 'arbetsledare'::app_role) THEN 'arbetsledare'::job_assignment_type
         ELSE NULL
       END,
       CASE WHEN l.pipeline_stage = 'slutford'::pipeline_stage THEN 'klar'::job_status
            ELSE 'pagaende'::job_status END,
       CASE
         WHEN l.assigned_to IS NOT NULL AND private.has_role(l.assigned_to, 'underentreprenor'::app_role)
           THEN l.subcontractor_price
         ELSE NULL
       END
FROM public.leads l
LEFT JOIN public.jobs j ON j.lead_id = l.id
WHERE j.id IS NULL
  AND l.pipeline_stage IN ('pagaende'::pipeline_stage, 'slutford'::pipeline_stage);
