-- ÄTA data model (Alternativ B, confirmed 2026-09-05): a dedicated `atas` table
-- anchored on jobs (not leads, not signature_requests), separate from the generic
-- e-signature transport table. This mirrors how `offers` is already kept separate
-- from `calculations` elsewhere in this schema.
--
-- Lead -> accepted offer -> Job (public.jobs, already exists) -> ÄTA (public.atas, new)
--
-- An ÄTA only becomes an actual signature_requests row once someone sends it to the
-- customer for signature; atas.signature_request_id is filled in at that point.
--
-- The amount cap is stored in public.app_settings (key 'ata_approval_threshold', seeded
-- at 10 000 kr) rather than hardcoded, so admin can change it later with a plain UPDATE
-- -- no new migration or RLS change needed to retune it.
--
-- NOTE ON ROLLOUT: as with the previous version of this migration, document_type on
-- signature_requests stays optional (NULL) for admin/saljare so the live offer-signing
-- flow (src/lib/signing.functions.ts, which never sets document_type today) keeps
-- working. Only the new arbetsledare/ÄTA path requires it explicitly.

-- ===== atas =====
CREATE TABLE public.atas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  ata_number TEXT, -- set by trigger below, e.g. 'ÄTA-001', sequential per job
  created_by UUID NOT NULL REFERENCES auth.users(id),
  total_amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  approval_status TEXT NOT NULL DEFAULT 'none'
    CHECK (approval_status IN ('none', 'pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  signature_request_id UUID REFERENCES public.signature_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, ata_number)
);

CREATE INDEX idx_atas_job ON public.atas(job_id);
CREATE INDEX idx_atas_created_by ON public.atas(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atas TO authenticated;
GRANT ALL ON public.atas TO service_role;
ALTER TABLE public.atas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_atas_updated_at
BEFORE UPDATE ON public.atas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Per-job ÄTA numbering, mirrors public.reserve_offer_number() but keyed by job =====
CREATE TABLE public.ata_number_counters (
  job_id UUID PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  last_number INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ata_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view ata counters"
  ON public.ata_number_counters FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.reserve_ata_number(_job_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ata_number_counters (job_id, last_number)
  VALUES (_job_id, 1)
  ON CONFLICT (job_id) DO UPDATE
    SET last_number = public.ata_number_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN 'ÄTA-' || lpad(v_next::text, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ata_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ata_number(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_ata_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ata_number IS NULL THEN
    NEW.ata_number := public.reserve_ata_number(NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_ata_number
BEFORE INSERT ON public.atas
FOR EACH ROW EXECUTE FUNCTION public.set_ata_number();

-- ===== app_settings: admin-editable config, no migration/RLS change needed to tune =====
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed today's confirmed threshold. Admin can change this value later with a plain
-- UPDATE (e.g. from a settings screen) -- no migration or RLS change needed.
INSERT INTO public.app_settings (key, value)
VALUES ('ata_approval_threshold', '10000'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_numeric_setting(_key TEXT, _default NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value FROM public.app_settings WHERE key = _key;
  IF v_value IS NULL THEN
    RETURN _default;
  END IF;
  RETURN (v_value #>> '{}')::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.get_numeric_setting(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_numeric_setting(text, numeric) TO authenticated;

-- ===== RLS: atas =====

-- admin: any job, any amount, no approval gate.
-- saljare: any job, any amount, no approval gate (fully trusted, matches leads rules).
-- arbetsledare: only a job that is currently 'pagaende' (public.job_status), and only
-- within/queued-for the approval flow based on the 10 000 kr cap.
CREATE POLICY "Role and amount scoped ata creation"
ON public.atas
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'saljare'::app_role)
    OR (
      private.has_role(auth.uid(), 'arbetsledare'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = atas.job_id AND j.status = 'pagaende'::job_status
      )
      AND (
        (total_amount <= public.get_numeric_setting('ata_approval_threshold', 10000) AND approval_status = 'none')
        OR (total_amount > public.get_numeric_setting('ata_approval_threshold', 10000) AND approval_status = 'pending')
      )
    )
  )
);

CREATE POLICY "View atas for accessible jobs"
ON public.atas
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = atas.job_id AND j.assigned_to = auth.uid())
  OR private.is_job_member(atas.job_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.leads l ON l.id = j.lead_id
    WHERE j.id = atas.job_id AND l.seller_id = auth.uid()
  )
);

-- Admin or the salesperson assigned to the job's lead (leads.seller_id) can manage an
-- ÄTA -- primarily to resolve a pending approval, but also to link signature_request_id
-- once it's sent. The lock trigger below still protects the sensitive fields against
-- the *creator* (arbetsledare); this policy is what lets the assigned seller act at all,
-- since they're not the row's created_by.
CREATE POLICY "Admin or assigned seller manage atas"
ON public.atas
FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.leads l ON l.id = j.lead_id
    WHERE j.id = atas.job_id AND l.seller_id = auth.uid()
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.leads l ON l.id = j.lead_id
    WHERE j.id = atas.job_id AND l.seller_id = auth.uid()
  )
);

-- Creator (arbetsledare) can still touch their own row (e.g. future cancel/description
-- edits) -- the lock trigger below is what actually stops them from moving the fields
-- that matter for the cap/approval gate.
CREATE POLICY "Creator can update own ata"
ON public.atas
FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Prevent the arbetsledare who created an ÄTA from changing amount, job, or approval
-- status after the fact -- otherwise they could lower total_amount post-creation to
-- dodge the approval requirement. Admin and saljare (which includes the assigned-seller
-- approver) are exempt.
CREATE OR REPLACE FUNCTION public.lock_arbetsledare_ata_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role)
     OR private.has_role(auth.uid(), 'saljare'::app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount
     OR OLD.job_id IS DISTINCT FROM NEW.job_id
     OR OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    RAISE EXCEPTION 'Arbetsledare får inte ändra belopp, jobbkoppling eller godkännandestatus efter att en ÄTA skapats.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_arbetsledare_ata_fields
BEFORE UPDATE ON public.atas
FOR EACH ROW EXECUTE FUNCTION public.lock_arbetsledare_ata_fields();

-- ===== signature_requests: document_type + link to atas =====
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS document_type text
    CHECK (document_type IN ('offert', 'avtal', 'tillagg', 'ata')),
  ADD COLUMN IF NOT EXISTS ata_id uuid REFERENCES public.atas(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Staff can create signature requests" ON public.signature_requests;

CREATE POLICY "Role and type scoped signature request creation"
ON public.signature_requests
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    -- Admin: any type, including legacy inserts that don't set document_type yet.
    private.has_role(auth.uid(), 'admin'::app_role)

    -- Saljare: offert, avtal, tillagg, ata -- or NULL (legacy/pre-rollout inserts).
    OR (
      private.has_role(auth.uid(), 'saljare'::app_role)
      AND (document_type IS NULL OR document_type IN ('offert', 'avtal', 'tillagg', 'ata'))
    )

    -- Arbetsledare: only 'ata', and only linked to their own ata row that is actually
    -- sendable (no approval needed, or already approved). All the amount/job-status
    -- gating already happened on public.atas -- this just checks that row's state.
    OR (
      private.has_role(auth.uid(), 'arbetsledare'::app_role)
      AND document_type = 'ata'
      AND ata_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.atas a
        WHERE a.id = signature_requests.ata_id
          AND a.created_by = auth.uid()
          AND a.approval_status IN ('none', 'approved')
      )
    )
  )
);
