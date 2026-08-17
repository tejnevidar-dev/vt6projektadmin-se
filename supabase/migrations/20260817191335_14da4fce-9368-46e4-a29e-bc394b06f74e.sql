ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE public.leads SET completed_at = updated_at
 WHERE completed_at IS NULL AND pipeline_stage = 'slutford'::public.pipeline_stage;

CREATE OR REPLACE FUNCTION public.set_lead_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pipeline_stage = 'slutford'::public.pipeline_stage
     AND (TG_OP = 'INSERT' OR OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage)
     AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  IF NEW.pipeline_stage <> 'slutford'::public.pipeline_stage THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_completed_at ON public.leads;
CREATE TRIGGER trg_lead_completed_at
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_lead_completed_at();