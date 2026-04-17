-- Create pipeline_stage enum
CREATE TYPE public.pipeline_stage AS ENUM ('saljpanel', 'bokad', 'pagaende', 'slutford');

-- Add pipeline_stage column to leads
ALTER TABLE public.leads
ADD COLUMN pipeline_stage public.pipeline_stage NOT NULL DEFAULT 'saljpanel';

-- Index for filtering by pipeline stage
CREATE INDEX idx_leads_pipeline_stage ON public.leads(pipeline_stage);