-- Tracks every pipeline_stage transition so "time spent in each stage" can be
-- computed (previously untracked -- leads only had a generic updated_at). A trigger,
-- not app code, so every code path that touches pipeline_stage (single-lead update,
-- bulk move, future paths) is covered automatically.

CREATE TABLE public.lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage public.pipeline_stage,
  to_stage public.pipeline_stage NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_stage_history_lead ON public.lead_stage_history(lead_id, changed_at);

GRANT SELECT ON public.lead_stage_history TO authenticated;
GRANT ALL ON public.lead_stage_history TO service_role;
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;

-- Matches leads' own shared-pool visibility model (all staff see all leads' activity).
CREATE POLICY "Authenticated can view lead stage history"
ON public.lead_stage_history FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_stage_history (lead_id, from_stage, to_stage)
    VALUES (NEW.id, NULL, NEW.pipeline_stage);
  ELSIF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    INSERT INTO public.lead_stage_history (lead_id, from_stage, to_stage)
    VALUES (NEW.id, OLD.pipeline_stage, NEW.pipeline_stage);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_lead_stage_change
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();
