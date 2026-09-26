-- Externa säljare v2, del 3 av 3: kundbetalning (kassamålet mäts på detta).
-- customer_paid_at = när kunden betalat jobbet, customer_paid_amount = betalt belopp (kr).
-- Bara admin och ekonomi får sätta dem; säljare (intern/extern) kan inte ändra dem.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS customer_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_paid_amount numeric(12,2);

-- Ekonomi-rollens kolumn-allowlist utökas med de nya fälten (funktionen är i övrigt oförändrad).
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
    'customer_paid_at', 'customer_paid_amount',
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

-- Alla utom admin/ekonomi (och servern, auth.uid() = null) är låsta från betalfälten.
CREATE OR REPLACE FUNCTION public.lock_customer_paid_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT private.has_role(auth.uid(), 'ekonomi'::public.app_role)
     AND (NEW.customer_paid_at IS DISTINCT FROM OLD.customer_paid_at
          OR NEW.customer_paid_amount IS DISTINCT FROM OLD.customer_paid_amount)
  THEN
    RAISE EXCEPTION 'Bara admin/ekonomi far markera betalt' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_lock_customer_paid_fields ON public.leads;
CREATE TRIGGER aa_lock_customer_paid_fields
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.lock_customer_paid_fields();

-- INSERT: en säljare ska inte kunna skapa en lead som redan är betald.
CREATE OR REPLACE FUNCTION public.lock_customer_paid_on_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT private.has_role(auth.uid(), 'ekonomi'::public.app_role) THEN
    NEW.customer_paid_at := NULL;
    NEW.customer_paid_amount := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_lock_customer_paid_on_insert ON public.leads;
CREATE TRIGGER aa_lock_customer_paid_on_insert
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.lock_customer_paid_on_insert();
