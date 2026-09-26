-- AKUT-FIX efter 090000-100000: triggerfunktionerna anropar private.has_role/is_restricted_seller,
-- men service_role (webbformulär, lead-inbox, inbound-email, signering, cron) saknar USAGE på
-- schemat "private". Med SECURITY INVOKER gav det "permission denied for schema private" vid
-- varje INSERT/UPDATE från servern. Med SECURITY DEFINER körs kontrollen som funktionsägaren.
-- auth.uid() läser JWT-claims och fungerar likadant i DEFINER-läge. search_path är redan satt.
ALTER FUNCTION public.lock_customer_paid_on_insert() SECURITY DEFINER;
ALTER FUNCTION public.lock_customer_paid_fields() SECURITY DEFINER;
ALTER FUNCTION public.aa_lock_restricted_seller_lead_fields() SECURITY DEFINER;
ALTER FUNCTION public.lock_signature_request_fields() SECURITY DEFINER;
ALTER FUNCTION public.enforce_ue_requirements() SECURITY DEFINER;
ALTER FUNCTION public.enforce_ue_job_completion() SECURITY DEFINER;
