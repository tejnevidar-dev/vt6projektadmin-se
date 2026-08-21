CREATE TABLE public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_ads','meta_ads')),
  account_id text not null,
  campaign_id text not null default '',
  campaign_name text not null default '',
  spend_date date not null,
  cost numeric(12,2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  lead_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, account_id, campaign_id, spend_date)
);

GRANT SELECT ON public.ad_spend TO authenticated;
GRANT ALL ON public.ad_spend TO service_role;
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin och ekonomi kan läsa annonskostnader"
ON public.ad_spend FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'ekonomi'::public.app_role));

CREATE TRIGGER trg_ad_spend_updated_at BEFORE UPDATE ON public.ad_spend
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ad_source_map (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_ads','meta_ads')),
  campaign_pattern text,
  lead_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_source_map TO authenticated;
GRANT ALL ON public.ad_source_map TO service_role;
ALTER TABLE public.ad_source_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin kan hantera kampanjmappning"
ON public.ad_source_map FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Ekonomi kan läsa kampanjmappning"
ON public.ad_source_map FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'ekonomi'::public.app_role));

CREATE TRIGGER trg_ad_source_map_updated_at BEFORE UPDATE ON public.ad_source_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ad_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_ads','meta_ads')),
  status text not null default 'ok',
  rows_upserted integer not null default 0,
  period_start date,
  period_end date,
  error_message text,
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.ad_sync_runs TO authenticated;
GRANT ALL ON public.ad_sync_runs TO service_role;
ALTER TABLE public.ad_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin och ekonomi kan läsa synklogg"
ON public.ad_sync_runs FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'ekonomi'::public.app_role));

CREATE INDEX idx_ad_spend_date ON public.ad_spend (spend_date DESC);
CREATE INDEX idx_ad_spend_source ON public.ad_spend (lead_source);