ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_type public.job_type;

-- Backfill from associated lead where possible
UPDATE public.jobs j
SET job_type = l.job_type
FROM public.leads l
WHERE j.lead_id = l.id AND j.job_type IS NULL;