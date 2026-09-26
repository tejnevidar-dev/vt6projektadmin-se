-- Externa säljare v2, del 2 av 3: offertflödet + godkännandesteg.
--
-- 1) Egna leads (created_by/seller_id = uid) får kalkyl, offert och signeringsbegäran, samt
--    läsa/ladda upp offert-PDF:er i egna mappar i bucketen "offers".
-- 2) Varje offert från en säljare (intern eller extern, inte admin) skapas med status
--    'awaiting_approval' och skickas till kund först när admin godkänner (företagets signatur
--    läggs på då). Admins egna offerter påverkas inte.
-- Provision, fakturering, rot_paid, completed_at, assigned_to, seller_id och andras leads
-- förblir låsta (se del 1).

-- ---------- Godkännande: nya kolumner/status på signature_requests ----------
ALTER TABLE public.signature_requests
  ALTER COLUMN company_signer_name DROP NOT NULL,
  ALTER COLUMN company_signature_png DROP NOT NULL,
  ALTER COLUMN company_place DROP NOT NULL,
  ALTER COLUMN company_date DROP NOT NULL,
  ALTER COLUMN company_signed_at DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.signature_requests DROP CONSTRAINT IF EXISTS signature_requests_status_chk;
ALTER TABLE public.signature_requests ADD CONSTRAINT signature_requests_status_chk
  CHECK (status IN ('awaiting_approval','pending','viewed','signed','expired','cancelled'));

-- Företagets signatur sparas en gång och läggs på vid godkännande. Bara admin.
CREATE TABLE IF NOT EXISTS public.company_signature (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  signer_name text NOT NULL,
  place text NOT NULL,
  signature_png text NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_signature ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.company_signature TO authenticated;
GRANT ALL ON public.company_signature TO service_role;

CREATE POLICY "Admin reads company signature" ON public.company_signature
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin inserts company signature" ON public.company_signature
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin updates company signature" ON public.company_signature
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------- signature_requests: INSERT ----------
DROP POLICY IF EXISTS "Role and type scoped signature request creation" ON public.signature_requests;

CREATE POLICY "Role and type scoped signature request creation"
ON public.signature_requests
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    -- Admin: valfri typ (godkänner sina egna offerter direkt).
    private.has_role(auth.uid(), 'admin'::public.app_role)

    -- Säljare: som förut, men allt utom ÄTA måste gå via godkännande innan det skickas till kund.
    OR (
      private.has_role(auth.uid(), 'saljare'::public.app_role)
      AND (document_type IS NULL OR document_type IN ('offert', 'avtal', 'tillagg', 'ata'))
      AND (document_type = 'ata' OR status = 'awaiting_approval')
    )

    -- Arbetsledare: bara egen, skickbar ÄTA (oförändrat).
    OR (
      private.has_role(auth.uid(), 'arbetsledare'::public.app_role)
      AND document_type = 'ata'
      AND ata_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.atas a
        WHERE a.id = signature_requests.ata_id
          AND a.created_by = auth.uid()
          AND a.approval_status IN ('none', 'approved')
      )
    )

    -- Extern säljare: bara offert på egen lead, alltid via godkännande.
    OR (
      private.is_restricted_seller(auth.uid())
      AND document_type = 'offert'
      AND status = 'awaiting_approval'
      AND lead_id IS NOT NULL
      AND private.own_lead(lead_id, auth.uid())
    )
  )
);

-- Extern säljare ser signeringsbegäran för egna leads (även sådana en admin skapat åt dem).
CREATE POLICY "Extern saljare can read own lead signature requests" ON public.signature_requests
  FOR SELECT TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND lead_id IS NOT NULL AND private.own_lead(lead_id, auth.uid()));

-- RLS kan inte begränsa kolumner: icke-admin får aldrig godkänna sin egen begäran, ändra
-- företagets signatur, token eller kundens/signerade fält. Servern (service role, auth.uid() = null)
-- undantas, så godkännande och kundens signering går via servern.
CREATE OR REPLACE FUNCTION public.lock_signature_request_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF OLD.status = 'awaiting_approval' AND NEW.status NOT IN ('awaiting_approval', 'cancelled') THEN
      RAISE EXCEPTION 'Offerten maste godkannas av admin innan den skickas' USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'awaiting_approval' AND OLD.status <> 'awaiting_approval' THEN
      RAISE EXCEPTION 'Status kan inte aterga till vantar pa godkannande' USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'signed' AND OLD.status <> 'signed' THEN
      RAISE EXCEPTION 'Bara kundens signering kan markera offerten som signerad' USING ERRCODE = '42501';
    END IF;
    IF NEW.token IS DISTINCT FROM OLD.token
       OR NEW.company_signer_name IS DISTINCT FROM OLD.company_signer_name
       OR NEW.company_signature_png IS DISTINCT FROM OLD.company_signature_png
       OR NEW.company_place IS DISTINCT FROM OLD.company_place
       OR NEW.company_date IS DISTINCT FROM OLD.company_date
       OR NEW.company_signed_at IS DISTINCT FROM OLD.company_signed_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.base_pdf_path IS DISTINCT FROM OLD.base_pdf_path
       OR NEW.signed_pdf_path IS DISTINCT FROM OLD.signed_pdf_path
       OR NEW.customer_signer_name IS DISTINCT FROM OLD.customer_signer_name
       OR NEW.customer_signature_png IS DISTINCT FROM OLD.customer_signature_png
       OR NEW.customer_signed_at IS DISTINCT FROM OLD.customer_signed_at
       OR NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.lead_id IS DISTINCT FROM OLD.lead_id
    THEN
      RAISE EXCEPTION 'Detta falt far inte andras' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_lock_signature_request_fields ON public.signature_requests;
CREATE TRIGGER aa_lock_signature_request_fields
  BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.lock_signature_request_fields();

-- ---------- calculations ----------
-- Befintliga policyer ger redan läs för created_by = uid och uppdatering av egen kalkyl.
-- Här läggs bara extern säljare till, och bara på egna leads.
CREATE POLICY "Extern saljare can read own lead calculations" ON public.calculations
  FOR SELECT TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()));

CREATE POLICY "Extern saljare can insert own lead calculations" ON public.calculations
  FOR INSERT TO authenticated
  WITH CHECK (private.is_restricted_seller(auth.uid()) AND created_by = auth.uid() AND private.own_lead(lead_id, auth.uid()));

CREATE POLICY "Extern saljare can update own lead calculations" ON public.calculations
  FOR UPDATE TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()))
  WITH CHECK (private.is_restricted_seller(auth.uid()) AND created_by = auth.uid() AND private.own_lead(lead_id, auth.uid()));

-- ---------- offers ----------
-- 'accepterad' sätts bara av kundens signering (servern), aldrig av en extern säljare.
CREATE POLICY "Extern saljare can read own lead offers" ON public.offers
  FOR SELECT TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()));

CREATE POLICY "Extern saljare can insert own lead offers" ON public.offers
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_restricted_seller(auth.uid()) AND created_by = auth.uid() AND private.own_lead(lead_id, auth.uid())
    AND status IN ('draft', 'skickad', 'avvisad') AND accepted_at IS NULL
  );

CREATE POLICY "Extern saljare can update own lead offers" ON public.offers
  FOR UPDATE TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()))
  WITH CHECK (
    private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid())
    AND status IN ('draft', 'skickad', 'avvisad') AND accepted_at IS NULL
  );

-- offer_drafts: befintliga policyer är redan "created_by = auth.uid()" utan rollkrav. Inget att lägga till.

-- ---------- Storage: bucket "offers" ----------
-- Två mappstrukturer används: <lead-id>/<fil> (uppladdad offert-PDF) och signering/<signeringsid>/<fil>.
CREATE OR REPLACE FUNCTION private.own_signature_request(_sig text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signature_requests s
    WHERE s.id::text = _sig
      AND (s.created_by = _uid OR (s.lead_id IS NOT NULL AND private.own_lead(s.lead_id, _uid)))
  );
$$;
GRANT EXECUTE ON FUNCTION private.own_signature_request(text, uuid) TO authenticated;

CREATE POLICY "Extern saljare can read own offer files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'offers' AND private.is_restricted_seller(auth.uid())
    AND (
      private.own_lead((storage.foldername(name))[1], auth.uid())
      OR ((storage.foldername(name))[1] = 'signering' AND private.own_signature_request((storage.foldername(name))[2], auth.uid()))
    )
  );

CREATE POLICY "Extern saljare can upload own offer files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'offers' AND private.is_restricted_seller(auth.uid())
    AND private.own_lead((storage.foldername(name))[1], auth.uid())
  );

CREATE POLICY "Extern saljare can delete own offer files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'offers' AND private.is_restricted_seller(auth.uid()) AND owner = auth.uid()
    AND private.own_lead((storage.foldername(name))[1], auth.uid())
  );
