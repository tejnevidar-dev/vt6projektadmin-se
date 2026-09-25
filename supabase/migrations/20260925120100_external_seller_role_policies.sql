-- Externa säljare ('saljare_extern'): får bara se och ändra leads de själva skapat eller
-- tilldelats (created_by / seller_id = auth.uid()) samt tillhörande fastighet, aktiviteter,
-- dokument och filer. Interna roller (admin, saljare, ekonomi ...) påverkas inte:
--   * alla nya tillåtande policyer gäller bara restricted sellers
--   * alla nya RESTRICTIVE policyer har formen NOT restricted OR <ägar-villkor>
-- En användare som även har admin/saljare räknas som intern (is_restricted_seller = false).

-- ---------- Hjälpfunktioner ----------
CREATE OR REPLACE FUNCTION private.is_restricted_seller(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _uid IS NOT NULL
     AND private.has_role(_uid, 'saljare_extern'::public.app_role)
     AND NOT private.has_role(_uid, 'admin'::public.app_role)
     AND NOT private.has_role(_uid, 'saljare'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION private.own_lead(_lead uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = _lead AND (l.created_by = _uid OR l.seller_id = _uid));
$$;

CREATE OR REPLACE FUNCTION private.own_lead(_lead text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads l WHERE l.id::text = _lead AND (l.created_by = _uid OR l.seller_id = _uid));
$$;

CREATE OR REPLACE FUNCTION private.own_property(_prop uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads l WHERE l.property_id = _prop AND (l.created_by = _uid OR l.seller_id = _uid));
$$;

GRANT EXECUTE ON FUNCTION private.is_restricted_seller(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.own_lead(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.own_lead(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.own_property(uuid, uuid) TO authenticated;

-- properties saknade ägare; behövs för att en ny fastighet ska gå att läsa direkt efter INSERT.
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- ---------- leads ----------
CREATE POLICY "Extern saljare can select own leads" ON public.leads
  FOR SELECT TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND (created_by = auth.uid() OR seller_id = auth.uid()));

CREATE POLICY "Extern saljare can insert own leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_restricted_seller(auth.uid())
    AND created_by = auth.uid()
    AND (seller_id IS NULL OR seller_id = auth.uid())
    AND assigned_to IS NULL
    AND pipeline_stage IN ('saljpanel', 'kontaktad', 'mote_bokat', 'mote_genomfort')
  );

CREATE POLICY "Extern saljare can update own leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND (created_by = auth.uid() OR seller_id = auth.uid()))
  WITH CHECK (private.is_restricted_seller(auth.uid()) AND (created_by = auth.uid() OR seller_id = auth.uid()));

-- RLS kan inte jämföra OLD/NEW: lås ekonomi-, ägar- och tilldelningsfält för externa säljare i en trigger.
-- Namnet börjar på "aa_" så att den körs före övriga BEFORE UPDATE-triggers.
CREATE OR REPLACE FUNCTION public.aa_lock_restricted_seller_lead_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF private.is_restricted_seller(auth.uid()) THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.assignment_type IS DISTINCT FROM OLD.assignment_type
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.material_cost IS DISTINCT FROM OLD.material_cost
       OR NEW.rot_amount IS DISTINCT FROM OLD.rot_amount
       OR NEW.invoiced IS DISTINCT FROM OLD.invoiced
       OR NEW.invoiced_at IS DISTINCT FROM OLD.invoiced_at
       OR NEW.invoice_due_date IS DISTINCT FROM OLD.invoice_due_date
       OR NEW.rot_paid IS DISTINCT FROM OLD.rot_paid
       OR NEW.rot_applied_at IS DISTINCT FROM OLD.rot_applied_at
       OR NEW.economy_note IS DISTINCT FROM OLD.economy_note
       OR NEW.subcontractor_name IS DISTINCT FROM OLD.subcontractor_name
       OR NEW.subcontractor_price IS DISTINCT FROM OLD.subcontractor_price
       OR NEW.foreman_name IS DISTINCT FROM OLD.foreman_name
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.offer_accepted_at IS DISTINCT FROM OLD.offer_accepted_at
       OR NEW.offer_pdf_path IS DISTINCT FROM OLD.offer_pdf_path
       OR NEW.external_id IS DISTINCT FROM OLD.external_id
    THEN
      RAISE EXCEPTION 'Externa saljare far inte andra detta falt' USING ERRCODE = '42501';
    END IF;
    IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage
       AND NEW.pipeline_stage NOT IN ('saljpanel', 'kontaktad', 'mote_bokat', 'mote_genomfort', 'forlorad') THEN
      RAISE EXCEPTION 'Externa saljare far inte flytta leaden till detta steg' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_lock_restricted_seller_lead_fields ON public.leads;
CREATE TRIGGER aa_lock_restricted_seller_lead_fields
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.aa_lock_restricted_seller_lead_fields();

-- ---------- properties ----------
CREATE POLICY "Extern saljare can insert properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (private.is_restricted_seller(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Extern saljare can select own properties" ON public.properties
  FOR SELECT TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND (created_by = auth.uid() OR private.own_property(id, auth.uid())));

CREATE POLICY "Extern saljare can update own properties" ON public.properties
  FOR UPDATE TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND (created_by = auth.uid() OR private.own_property(id, auth.uid())))
  WITH CHECK (private.is_restricted_seller(auth.uid()) AND (created_by = auth.uid() OR private.own_property(id, auth.uid())));

-- ---------- lead_activities ----------
CREATE POLICY "Extern saljare can read own lead activities" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()));

CREATE POLICY "Extern saljare can insert own lead activities" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()) AND user_id = auth.uid());

-- ---------- lead_documents ----------
CREATE POLICY "Extern saljare can read own lead documents" ON public.lead_documents
  FOR SELECT TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()));

CREATE POLICY "Extern saljare can insert own lead documents" ON public.lead_documents
  FOR INSERT TO authenticated
  WITH CHECK (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Extern saljare can delete own uploaded documents" ON public.lead_documents
  FOR DELETE TO authenticated
  USING (private.is_restricted_seller(auth.uid()) AND private.own_lead(lead_id, auth.uid()) AND uploaded_by = auth.uid());

-- ---------- Storage: bara bucketen lead-documents, bara mappar (= lead-id) de äger ----------
CREATE POLICY "Extern saljare can read own lead-documents files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead-documents' AND private.is_restricted_seller(auth.uid())
         AND private.own_lead((storage.foldername(name))[1], auth.uid()));

CREATE POLICY "Extern saljare can upload own lead-documents files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-documents' AND private.is_restricted_seller(auth.uid())
              AND private.own_lead((storage.foldername(name))[1], auth.uid()));

CREATE POLICY "Extern saljare can delete own lead-documents files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents' AND private.is_restricted_seller(auth.uid())
         AND owner = auth.uid() AND private.own_lead((storage.foldername(name))[1], auth.uid()));

-- ---------- RESTRICTIVE: stäng tabeller som är öppna för alla inloggade ----------
CREATE POLICY "Extern saljare blocked from app_settings" ON public.app_settings
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.is_restricted_seller(auth.uid()));

CREATE POLICY "Extern saljare blocked from sales_goals" ON public.sales_goals
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.is_restricted_seller(auth.uid()));

CREATE POLICY "Extern saljare only own lead_stage_history" ON public.lead_stage_history
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.is_restricted_seller(auth.uid()) OR private.own_lead(lead_id, auth.uid()));

-- Offerter/kalkyler hanteras av företaget; läsbara via "lead.created_by = auth.uid()" i de gamla policyerna.
CREATE POLICY "Extern saljare blocked from offers" ON public.offers
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.is_restricted_seller(auth.uid()));

CREATE POLICY "Extern saljare blocked from calculations" ON public.calculations
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.is_restricted_seller(auth.uid()));

CREATE POLICY "Extern saljare blocked from offer_drafts" ON public.offer_drafts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.is_restricted_seller(auth.uid()));
