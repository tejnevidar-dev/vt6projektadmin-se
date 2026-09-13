-- The "Ekonomi can update leads" policy (20260812080329) grants row-level
-- UPDATE access on the whole leads row to anyone with the ekonomi role.
-- Postgres RLS can't restrict by column, so without this trigger an
-- ekonomi-only user could edit name/phone/notes/etc, not just billing/ROT
-- fields. This trigger enforces a column allowlist for that role.
--
-- Admin and saljare are exempt (they already have full-row access via their
-- own policies), so this only constrains users whose leads-UPDATE access
-- comes solely from the ekonomi policy.

CREATE OR REPLACE FUNCTION public.restrict_ekonomi_lead_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_columns text[] := ARRAY[
    'invoiced', 'invoiced_at', 'invoice_due_date',
    'rot_eligible', 'rot_amount', 'rot_paid', 'rot_applied_at',
    'economy_note', 'personal_number',
    'updated_at'
  ];
  col text;
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role)
     OR private.has_role(auth.uid(), 'saljare'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NOT private.has_role(auth.uid(), 'ekonomi'::app_role) THEN
    RETURN NEW;
  END IF;

  FOR col IN SELECT jsonb_object_keys(to_jsonb(OLD)) LOOP
    IF col = ANY(allowed_columns) THEN
      CONTINUE;
    END IF;
    IF (to_jsonb(OLD) ->> col) IS DISTINCT FROM (to_jsonb(NEW) ->> col) THEN
      RAISE EXCEPTION 'Ekonomi-rollen får bara ändra faktura-/ROT-fält (otillåten kolumn: "%")', col;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_ekonomi_lead_columns ON public.leads;
CREATE TRIGGER trg_restrict_ekonomi_lead_columns
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.restrict_ekonomi_lead_columns();
