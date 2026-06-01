-- ===== Enums =====
CREATE TYPE public.job_status AS ENUM ('ej_paborjad', 'pagaende', 'klar');
CREATE TYPE public.job_assignment_type AS ENUM ('arbetsledare', 'underentreprenor');
CREATE TYPE public.time_entry_status AS ENUM ('pending', 'approved', 'rejected');

-- ===== jobs =====
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL,
  assignment_type public.job_assignment_type NOT NULL,
  status public.job_status NOT NULL DEFAULT 'ej_paborjad',
  fixed_price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);
CREATE INDEX idx_jobs_assigned_to ON public.jobs(assigned_to);
CREATE INDEX idx_jobs_lead ON public.jobs(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- ===== job_members =====
CREATE TABLE public.job_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
CREATE INDEX idx_job_members_user ON public.job_members(user_id);
CREATE INDEX idx_job_members_job ON public.job_members(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_members TO authenticated;
GRANT ALL ON public.job_members TO service_role;
ALTER TABLE public.job_members ENABLE ROW LEVEL SECURITY;

-- ===== time_entries =====
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  work_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  description TEXT,
  status public.time_entry_status NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_job ON public.time_entries(job_id);
CREATE INDEX idx_time_entries_date ON public.time_entries(work_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- ===== self_checks =====
CREATE TABLE public.self_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  template_key TEXT NOT NULL DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_self_checks_job ON public.self_checks(job_id);
CREATE INDEX idx_self_checks_user ON public.self_checks(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.self_checks TO authenticated;
GRANT ALL ON public.self_checks TO service_role;
ALTER TABLE public.self_checks ENABLE ROW LEVEL SECURITY;

-- ===== Helper: is user member of job =====
CREATE OR REPLACE FUNCTION public.is_job_member(_job_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_members
    WHERE job_id = _job_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_job_owner(_job_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = _job_id AND assigned_to = _user_id
  )
$$;

-- ===== RLS: jobs =====
CREATE POLICY "Admins manage jobs"
ON public.jobs FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners see own jobs"
ON public.jobs FOR SELECT TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "Owners update own jobs"
ON public.jobs FOR UPDATE TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Members see jobs they belong to"
ON public.jobs FOR SELECT TO authenticated
USING (public.is_job_member(id, auth.uid()));

-- ===== RLS: job_members =====
CREATE POLICY "Admins manage job members"
ON public.job_members FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Job owners manage members"
ON public.job_members FOR ALL TO authenticated
USING (public.is_job_owner(job_id, auth.uid()))
WITH CHECK (public.is_job_owner(job_id, auth.uid()));

CREATE POLICY "Members see own membership"
ON public.job_members FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ===== RLS: time_entries =====
CREATE POLICY "Admins manage time entries"
ON public.time_entries FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users see own time entries"
ON public.time_entries FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own time entries"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (public.is_job_owner(job_id, auth.uid()) OR public.is_job_member(job_id, auth.uid()))
);

CREATE POLICY "Users update own pending entries"
ON public.time_entries FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Job owners see job time entries"
ON public.time_entries FOR SELECT TO authenticated
USING (public.is_job_owner(job_id, auth.uid()));

CREATE POLICY "Job owners approve time entries"
ON public.time_entries FOR UPDATE TO authenticated
USING (public.is_job_owner(job_id, auth.uid()))
WITH CHECK (public.is_job_owner(job_id, auth.uid()));

-- ===== RLS: self_checks =====
CREATE POLICY "Admins manage self checks"
ON public.self_checks FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users manage own self checks"
ON public.self_checks FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  AND (public.is_job_owner(job_id, auth.uid()) OR public.is_job_member(job_id, auth.uid()))
)
WITH CHECK (
  user_id = auth.uid()
  AND (public.is_job_owner(job_id, auth.uid()) OR public.is_job_member(job_id, auth.uid()))
);

CREATE POLICY "Job owners see job self checks"
ON public.self_checks FOR SELECT TO authenticated
USING (public.is_job_owner(job_id, auth.uid()));

-- ===== updated_at triggers =====
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_time_entries_updated_at BEFORE UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_self_checks_updated_at BEFORE UPDATE ON public.self_checks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Auto-create job when lead is booked & assigned =====
CREATE OR REPLACE FUNCTION public.handle_lead_booking()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_assignment_type public.job_assignment_type;
BEGIN
  IF NEW.pipeline_stage = 'bokat'::pipeline_stage
     AND NEW.assigned_to IS NOT NULL
     AND (OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage
          OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  THEN
    -- Determine assignment type from role of assigned user
    IF private.has_role(NEW.assigned_to, 'underentreprenor'::app_role) THEN
      v_assignment_type := 'underentreprenor';
    ELSIF private.has_role(NEW.assigned_to, 'arbetsledare'::app_role) THEN
      v_assignment_type := 'arbetsledare';
    ELSE
      RETURN NEW; -- assigned user is not an internal role we auto-create jobs for
    END IF;

    INSERT INTO public.jobs (lead_id, assigned_to, assignment_type, fixed_price)
    VALUES (NEW.id, NEW.assigned_to, v_assignment_type,
            CASE WHEN v_assignment_type = 'underentreprenor' THEN NEW.subcontractor_price ELSE NULL END)
    ON CONFLICT (lead_id) DO UPDATE
      SET assigned_to = EXCLUDED.assigned_to,
          assignment_type = EXCLUDED.assignment_type,
          fixed_price = COALESCE(EXCLUDED.fixed_price, public.jobs.fixed_price),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_booking
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.handle_lead_booking();
