
CREATE TABLE public.seo_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  site_url TEXT NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('total','query','page','device','country','query_page')),
  key1 TEXT NOT NULL DEFAULT '',
  key2 TEXT NOT NULL DEFAULT '',
  metric_date DATE NOT NULL,
  clicks NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  position NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_url, dimension, key1, key2, metric_date)
);
CREATE INDEX seo_daily_metrics_lookup ON public.seo_daily_metrics (site_url, dimension, metric_date DESC);

CREATE TABLE public.seo_page_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  status_code INTEGER,
  title TEXT,
  meta_description TEXT,
  h1 TEXT[],
  headings JSONB NOT NULL DEFAULT '[]'::jsonb,
  word_count INTEGER,
  canonical TEXT,
  robots TEXT,
  in_sitemap BOOLEAN NOT NULL DEFAULT false,
  internal_links_out TEXT[] NOT NULL DEFAULT '{}',
  images_total INTEGER NOT NULL DEFAULT 0,
  images_missing_alt INTEGER NOT NULL DEFAULT 0,
  structured_data TEXT[] NOT NULL DEFAULT '{}',
  html_bytes INTEGER,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  health_score INTEGER,
  psi JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  impact INTEGER NOT NULL DEFAULT 50,
  difficulty INTEGER NOT NULL DEFAULT 50,
  opportunity_score INTEGER NOT NULL DEFAULT 0,
  affected_url TEXT,
  target_keyword TEXT,
  problem TEXT,
  recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','ignored')),
  source TEXT NOT NULL DEFAULT 'manual',
  source_key TEXT UNIQUE,
  baseline JSONB,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_local_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  locality TEXT NOT NULL,
  landing_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service, locality)
);

CREATE TABLE public.seo_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  rows_written INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_daily_metrics TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.seo_daily_metrics_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.seo_daily_metrics_id_seq TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_local_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_competitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_sync_log TO authenticated;
GRANT ALL ON public.seo_daily_metrics TO service_role;
GRANT ALL ON public.seo_page_audits TO service_role;
GRANT ALL ON public.seo_tasks TO service_role;
GRANT ALL ON public.seo_local_targets TO service_role;
GRANT ALL ON public.seo_competitors TO service_role;
GRANT ALL ON public.seo_sync_log TO service_role;

ALTER TABLE public.seo_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_page_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_local_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_daily_metrics_admin" ON public.seo_daily_metrics FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "seo_page_audits_admin" ON public.seo_page_audits FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "seo_tasks_admin" ON public.seo_tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "seo_local_targets_admin" ON public.seo_local_targets FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "seo_competitors_admin" ON public.seo_competitors FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "seo_sync_log_admin" ON public.seo_sync_log FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER seo_tasks_updated_at BEFORE UPDATE ON public.seo_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
