-- Rollback-test för extern-säljare v2. Körs EFTER de tre migrationerna i samma transaktion
-- (klistra in migrationerna + detta i SQL-editorn). Slutar med RAISE EXCEPTION så att allt rullas
-- tillbaka; resultatet står i felmeddelandet. Skapar inga konton: en befintlig viewer-användare
-- får rollen saljare_extern inuti transaktionen.

CREATE FUNCTION pg_temp.t(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE c bigint;
BEGIN
  EXECUTE q;
  GET DIAGNOSTICS c = ROW_COUNT;
  RETURN 'ok:' || c;
EXCEPTION WHEN others THEN
  RETURN 'ERR:' || left(SQLERRM, 60);
END $f$;

CREATE FUNCTION pg_temp.c(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE 'select count(*) from (' || q || ') s' INTO n;
  RETURN n::text;
EXCEPTION WHEN others THEN
  RETURN 'ERR:' || left(SQLERRM, 60);
END $f$;

DO $$
DECLARE
  E uuid; H uuid; A uuid; L1 uuid; L2 uuid; S1 uuid; S2 uuid; o text := ''; r text;
BEGIN
  SELECT id INTO E FROM profiles WHERE email = 'jannebostrand@gmail.com';
  SELECT id INTO H FROM profiles WHERE email = 'hermanbarth97@gmail.com';
  A := 'da4f1c1c-3cf7-41a1-89dc-89dd5e8301bf';
  INSERT INTO user_roles (user_id, role) VALUES (E, 'saljare_extern');
  INSERT INTO leads (name, created_by, pipeline_stage) VALUES ('ZZ extern', E, 'offererad') RETURNING id INTO L1;
  INSERT INTO leads (name, created_by) VALUES ('ZZ herman', H) RETURNING id INTO L2;
  S1 := gen_random_uuid(); S2 := gen_random_uuid();

  -- ===== EXTERN =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  o := o || E'\nE leads synliga (1): ' || pg_temp.c($q$select 1 from leads$q$);
  o := o || E'\nE kalkyl egen lead (ok:1): ' || pg_temp.t(format($q$insert into calculations(lead_id, created_by) values (%L, %L)$q$, L1, E));
  o := o || E'\nE kalkyl annans lead (ERR): ' || pg_temp.t(format($q$insert into calculations(lead_id, created_by) values (%L, %L)$q$, L2, E));
  o := o || E'\nE kalkyler synliga (1): ' || pg_temp.c($q$select 1 from calculations$q$);
  o := o || E'\nE offert draft (ok:1): ' || pg_temp.t(format($q$insert into offers(lead_id, version, pdf_path, created_by) values (%L, 1, 'x', %L)$q$, L1, E));
  o := o || E'\nE offert accepterad (ERR): ' || pg_temp.t(format($q$insert into offers(lead_id, version, pdf_path, created_by, status) values (%L, 2, 'x', %L, 'accepterad')$q$, L1, E));
  o := o || E'\nE offert annans lead (ERR): ' || pg_temp.t(format($q$insert into offers(lead_id, version, pdf_path, created_by) values (%L, 1, 'x', %L)$q$, L2, E));
  o := o || E'\nE sig awaiting egen lead (ok:1): ' || pg_temp.t(format($q$insert into signature_requests(id, created_by, lead_id, document_type, status, offer_number, customer_name, customer_email, token, base_pdf_path, company_signed_at) values (%L, %L, %L, 'offert', 'awaiting_approval', 'T1', 'Kund', 'k@x.se', 'tok1', 'p', null)$q$, S1, E, L1));
  o := o || E'\nE sig status pending (ERR): ' || pg_temp.t(format($q$insert into signature_requests(created_by, lead_id, document_type, status, offer_number, customer_name, customer_email, token, base_pdf_path) values (%L, %L, 'offert', 'pending', 'T2', 'Kund', 'k@x.se', 'tok2', 'p')$q$, E, L1));
  o := o || E'\nE sig typ ata (ERR): ' || pg_temp.t(format($q$insert into signature_requests(created_by, lead_id, document_type, status, offer_number, customer_name, customer_email, token, base_pdf_path) values (%L, %L, 'ata', 'awaiting_approval', 'T3', 'Kund', 'k@x.se', 'tok3', 'p')$q$, E, L1));
  o := o || E'\nE sig annans lead (ERR): ' || pg_temp.t(format($q$insert into signature_requests(created_by, lead_id, document_type, status, offer_number, customer_name, customer_email, token, base_pdf_path) values (%L, %L, 'offert', 'awaiting_approval', 'T4', 'Kund', 'k@x.se', 'tok4', 'p')$q$, E, L2));
  o := o || E'\nE sig godkann sjalv (ERR): ' || pg_temp.t(format($q$update signature_requests set status = 'pending' where id = %L$q$, S1));
  o := o || E'\nE sig andra token (ERR): ' || pg_temp.t(format($q$update signature_requests set token = 'hack' where id = %L$q$, S1));
  o := o || E'\nE sig satt signerad (ERR): ' || pg_temp.t(format($q$update signature_requests set status = 'signed' where id = %L$q$, S1));
  o := o || E'\nE sigs synliga (1): ' || pg_temp.c($q$select 1 from signature_requests$q$);
  o := o || E'\nE company_signature (0): ' || pg_temp.c($q$select 1 from company_signature$q$);
  o := o || E'\nE company_signature insert (ERR): ' || pg_temp.t($q$insert into company_signature(signer_name, place, signature_png) values ('x','y','z')$q$);
  o := o || E'\nE app_settings (0): ' || pg_temp.c($q$select 1 from app_settings$q$);
  o := o || E'\nE lead -> forhandling (ok:1): ' || pg_temp.t(format($q$update leads set pipeline_stage = 'forhandling' where id = %L$q$, L1));
  o := o || E'\nE lead -> bokad (ERR): ' || pg_temp.t(format($q$update leads set pipeline_stage = 'bokad' where id = %L$q$, L1));
  o := o || E'\nE offer_accepted_at (ERR): ' || pg_temp.t(format($q$update leads set offer_accepted_at = now() where id = %L$q$, L1));
  o := o || E'\nE customer_paid_at (ERR): ' || pg_temp.t(format($q$update leads set customer_paid_at = now() where id = %L$q$, L1));
  o := o || E'\nE commission_rate (ERR): ' || pg_temp.t(format($q$update leads set commission_rate = 50 where id = %L$q$, L1));
  o := o || E'\nE offer_pdf_path (ok:1): ' || pg_temp.t(format($q$update leads set offer_pdf_path = 'x' where id = %L$q$, L1));
  o := o || E'\nE lagg till betald vid insert (ok, men NULL): ' || pg_temp.t(format($q$insert into leads(name, created_by, customer_paid_at) values ('ZZ paid', %L, now())$q$, E));
  o := o || E'\nE storage-funktion egen sig (t): ' || private.own_signature_request(S1::text, E)::text;
  RESET ROLE;
  o := o || E'\n   betald blev NULL (t): ' || ((SELECT customer_paid_at FROM leads WHERE name = 'ZZ paid') IS NULL)::text;

  -- ===== HERMAN (intern saljare) =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', H, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  o := o || E'\nH ser alla leads (>=2): ' || pg_temp.c($q$select 1 from leads$q$);
  o := o || E'\nH sig pending offert (ERR): ' || pg_temp.t(format($q$insert into signature_requests(created_by, lead_id, document_type, status, offer_number, customer_name, customer_email, token, base_pdf_path) values (%L, %L, 'offert', 'pending', 'H1', 'Kund', 'k@x.se', 'tokh1', 'p')$q$, H, L2));
  o := o || E'\nH sig awaiting (ok:1): ' || pg_temp.t(format($q$insert into signature_requests(id, created_by, lead_id, document_type, status, offer_number, customer_name, customer_email, token, base_pdf_path, company_signed_at) values (%L, %L, %L, 'offert', 'awaiting_approval', 'H2', 'Kund', 'k@x.se', 'tokh2', 'p', null)$q$, S2, H, L2));
  o := o || E'\nH sig ata pending (ok:1): ' || pg_temp.t(format($q$insert into signature_requests(created_by, lead_id, document_type, status, offer_number, customer_name, customer_email, token, base_pdf_path) values (%L, %L, 'ata', 'pending', 'H3', 'Kund', 'k@x.se', 'tokh3', 'p')$q$, H, L2));
  o := o || E'\nH godkann sjalv (ERR): ' || pg_temp.t(format($q$update signature_requests set status = 'pending' where id = %L$q$, S2));
  o := o || E'\nH customer_paid_at (ERR): ' || pg_temp.t(format($q$update leads set customer_paid_at = now() where id = %L$q$, L2));
  o := o || E'\nH ordinarie lead-uppdatering (ok:1): ' || pg_temp.t(format($q$update leads set notes = 'x' where id = %L$q$, L2));
  o := o || E'\nH company_signature (0): ' || pg_temp.c($q$select 1 from company_signature$q$);
  RESET ROLE;

  -- ===== ADMIN =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  o := o || E'\nA company_signature insert (ok:1): ' || pg_temp.t($q$insert into company_signature(signer_name, place, signature_png) values ('Vidar','Norrtalje','png')$q$);
  o := o || E'\nA godkann extern sig (ok:1): ' || pg_temp.t(format($q$update signature_requests set status = 'pending', company_signer_name = 'Vidar' where id = %L$q$, S1));
  o := o || E'\nA customer_paid_at (ok:1): ' || pg_temp.t(format($q$update leads set customer_paid_at = now(), customer_paid_amount = 1000 where id = %L$q$, L2));
  o := o || E'\nA ser alla sigs (>=2): ' || pg_temp.c($q$select 1 from signature_requests$q$);
  RESET ROLE;

  -- Servern (service_role) måste kunna skriva: fångar felet "permission denied for schema private".
  SET LOCAL ROLE service_role;
  BEGIN
    INSERT INTO leads (name) VALUES ('ZZ service_role'); UPDATE leads SET notes = 'x' WHERE name = 'ZZ service_role'; r := 'ok';
  EXCEPTION WHEN others THEN r := 'FEL: ' || left(SQLERRM, 80); END;
  o := o || E'
service_role skriver leads (ok): ' || r;
  RESET ROLE;

  RAISE EXCEPTION E'RLS-RESULTAT (rullas tillbaka):%', o;
END $$;
