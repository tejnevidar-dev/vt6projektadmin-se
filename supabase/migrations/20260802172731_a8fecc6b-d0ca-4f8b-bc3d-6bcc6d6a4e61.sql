INSERT INTO public.offer_number_counters (year, last_number)
VALUES (2026, 2024)
ON CONFLICT (year) DO UPDATE SET last_number = 2024, updated_at = now();

CREATE OR REPLACE FUNCTION public.peek_offer_number()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_next := CASE WHEN v_year = 2026 THEN 2025 ELSE 1 END;
  ELSE
    v_next := v_last + 1;
  END IF;

  RETURN v_year::TEXT || '-' || lpad(v_next::TEXT, 4, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_offer_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_next INT;
  v_start INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  v_start := CASE WHEN v_year = 2026 THEN 2025 ELSE 1 END;

  INSERT INTO public.offer_number_counters (year, last_number)
  VALUES (v_year, v_start)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.offer_number_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN v_year::TEXT || '-' || lpad(v_next::TEXT, 4, '0');
END;
$function$;