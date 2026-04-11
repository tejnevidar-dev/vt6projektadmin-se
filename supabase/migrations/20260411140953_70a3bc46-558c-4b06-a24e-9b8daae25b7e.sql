
CREATE TYPE public.lead_status AS ENUM ('cold', 'warm', 'hot', 'customer', 'lost');
CREATE TYPE public.lead_source AS ENUM ('field', 'telemarketing', 'scan', 'referral', 'csv_import');

CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL,
  municipality TEXT NOT NULL,
  region TEXT NOT NULL,
  build_year INTEGER,
  roof_type TEXT,
  roof_age INTEGER,
  has_roof_permit BOOLEAN NOT NULL DEFAULT false,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  property_designation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  age INTEGER,
  status lead_status NOT NULL DEFAULT 'cold',
  source lead_source NOT NULL DEFAULT 'field',
  notes TEXT DEFAULT '',
  last_contact TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to properties" ON public.properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_properties_region ON public.properties(region);
CREATE INDEX idx_properties_municipality ON public.properties(municipality);
CREATE INDEX idx_properties_build_year ON public.properties(build_year);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_property_id ON public.leads(property_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
