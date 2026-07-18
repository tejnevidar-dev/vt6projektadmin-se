
CREATE TABLE public.offer_number_counters (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.offer_number_counters TO authenticated;
GRANT ALL ON public.offer_number_counters TO service_role;

ALTER TABLE public.offer_number_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view counters"
  ON public.offer_number_counters FOR SELECT
  TO authenticated
  USING (true);

-- Seed 2026 so that next reserve returns 2020
INSERT INTO public.offer_number_counters (year, last_number)
VALUES (2026, 2019)
ON CONFLICT (year) DO NOTHING;

-- Reserve the next number atomically. Returns formatted 'YYYY-NNNN'.
CREATE OR REPLACE FUNCTION public.reserve_offer_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_next INT;
  v_start INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- If current year, start at 2020, else at 1
  v_start := CASE WHEN v_year = 2026 THEN 2020 ELSE 1 END;

  INSERT INTO public.offer_number_counters (year, last_number)
  VALUES (v_year, v_start)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.offer_number_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN v_year::TEXT || '-' || lpad(v_next::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_offer_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_offer_number() TO authenticated;

-- Peek at what the next reserved number would be (does not consume).
CREATE OR REPLACE FUNCTION public.peek_offer_number()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_last INT;
  v_next INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT last_number INTO v_last FROM public.offer_number_counters WHERE year = v_year;

  IF v_last IS NULL THEN
    v_next := CASE WHEN v_year = 2026 THEN 2020 ELSE 1 END;
  ELSE
    v_next := v_last + 1;
  END IF;

  RETURN v_year::TEXT || '-' || lpad(v_next::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.peek_offer_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peek_offer_number() TO authenticated;
