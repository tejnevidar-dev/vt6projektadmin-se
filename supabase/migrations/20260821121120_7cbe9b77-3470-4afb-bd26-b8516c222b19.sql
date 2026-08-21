ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS offer_accepted_at timestamptz;

UPDATE public.leads
SET offer_accepted_at = COALESCE(completed_at, updated_at)
WHERE offer_accepted_at IS NULL AND pipeline_stage = 'slutford'::public.pipeline_stage;

CREATE INDEX IF NOT EXISTS idx_leads_offer_accepted_at ON public.leads (offer_accepted_at);