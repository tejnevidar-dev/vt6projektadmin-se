-- Create job_type enum
CREATE TYPE public.job_type AS ENUM ('roof_replacement', 'roof_cleaning', 'light_roof_work');

-- Add job_type column to leads, defaulting to roof_replacement (Takbyten)
ALTER TABLE public.leads
ADD COLUMN job_type public.job_type NOT NULL DEFAULT 'roof_replacement';

-- Index for faster filtering
CREATE INDEX idx_leads_job_type ON public.leads(job_type);