-- Before/after photo gallery per job, with a public shareable link (mirrors the
-- signature_requests token pattern -- a public route uses a service-role client to
-- look up the token, no anon RLS policy needed on these tables at all). Photos are
-- stored in the existing "self-check-images" bucket under a new "<jobId>/gallery/..."
-- path, reusing that bucket's existing job-ownership storage policies for the
-- authenticated upload path -- no new storage bucket/policy needed.

CREATE TABLE public.job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('fore', 'efter')),
  caption TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_photos_job ON public.job_photos(job_id, phase, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_photos TO authenticated;
GRANT ALL ON public.job_photos TO service_role;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- Same visibility model as atas: admin, the job's assigned foreman/UE, job members,
-- or the seller attached via the job's lead.
CREATE POLICY "View photos for accessible jobs"
ON public.job_photos FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_photos.job_id AND j.assigned_to = auth.uid())
  OR private.is_job_member(job_photos.job_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.leads l ON l.id = j.lead_id
    WHERE j.id = job_photos.job_id AND l.seller_id = auth.uid()
  )
);

CREATE POLICY "Manage photos for accessible jobs"
ON public.job_photos FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_photos.job_id AND j.assigned_to = auth.uid())
  OR private.is_job_member(job_photos.job_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.leads l ON l.id = j.lead_id
    WHERE j.id = job_photos.job_id AND l.seller_id = auth.uid()
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_photos.job_id AND j.assigned_to = auth.uid())
  OR private.is_job_member(job_photos.job_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.leads l ON l.id = j.lead_id
    WHERE j.id = job_photos.job_id AND l.seller_id = auth.uid()
  )
);

-- One reusable public link per job (create-or-fetch, not one-time-use).
CREATE TABLE public.job_photo_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.job_photo_share_links TO authenticated;
GRANT ALL ON public.job_photo_share_links TO service_role;
ALTER TABLE public.job_photo_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage share links for accessible jobs"
ON public.job_photo_share_links FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_photo_share_links.job_id AND j.assigned_to = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.leads l ON l.id = j.lead_id
    WHERE j.id = job_photo_share_links.job_id AND l.seller_id = auth.uid()
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_photo_share_links.job_id AND j.assigned_to = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.leads l ON l.id = j.lead_id
      WHERE j.id = job_photo_share_links.job_id AND l.seller_id = auth.uid()
    )
  )
);
