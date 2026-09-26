-- Rollback-test för UE-paket 1. Körs EFTER 20260927100000_ue_package1.sql i samma transaktion
-- (klistra in migrationen + detta i SQL-editorn). Slutar med RAISE EXCEPTION så att allt rullas
-- tillbaka; resultatet står i felmeddelandet. Skapar inga konton: en befintlig viewer-användare
-- används som UE-användare inuti transaktionen.

DO $$
DECLARE
  U uuid; S uuid; L uuid; J uuid; o text := ''; r text;
BEGIN
  SELECT id INTO U FROM profiles WHERE email = 'petterjohansson65@gmail.com';
  INSERT INTO user_roles (user_id, role) VALUES (U, 'underentreprenor');
  INSERT INTO leads (name) VALUES ('ZZ ue-test') RETURNING id INTO L;
  INSERT INTO subcontractors (company_name, user_id) VALUES ('ZZ UE', U) RETURNING id INTO S;

  o := o || E'\nsaknas alla krav: ' || array_to_string(public.ue_missing_requirements(S), ',');

  -- Spärr: tilldelning utan krav ska nekas
  BEGIN
    INSERT INTO jobs (lead_id, assigned_to, assignment_type, subcontractor_id) VALUES (L, U, 'underentreprenor', S);
    o := o || E'\nJOBB UTAN KRAV SKAPADES (FEL)';
  EXCEPTION WHEN others THEN
    o := o || E'\ntilldelning utan krav nekad (ok): ' || left(SQLERRM, 80);
  END;

  UPDATE subcontractors SET f_skatt = true, f_skatt_checked_at = current_date, insurance_expires_at = current_date + 90,
    agreement_signed_at = current_date, id06_valid_until = current_date + 90 WHERE id = S;
  o := o || E'
saknas trots krav men status hittad: ' || array_to_string(public.ue_missing_requirements(S), ',');
  UPDATE subcontractors SET pipeline_status = 'aktiv' WHERE id = S;
  o := o || E'\nsaknas efter komplettering (tom): [' || array_to_string(public.ue_missing_requirements(S), ',') || ']';

  UPDATE subcontractors SET is_posted_worker = true WHERE id = S;
  o := o || E'\nutstationerad utan A1: ' || array_to_string(public.ue_missing_requirements(S), ',');
  UPDATE subcontractors SET a1_valid_until = current_date + 90, posting_notified_at = current_date WHERE id = S;

  INSERT INTO jobs (lead_id, assigned_to, assignment_type, subcontractor_id, status)
    VALUES (L, U, 'underentreprenor', S, 'pagaende') RETURNING id INTO J;
  o := o || E'\njobb med godkand UE skapat (ok)';

  -- Klart-spärr som UE-användaren
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE jobs SET status = 'klar' WHERE id = J; r := 'FEL: klar utan foton'; EXCEPTION WHEN others THEN r := 'nekad (ok): ' || left(SQLERRM, 60); END;
  o := o || E'\nklar utan foton: ' || r;
  RESET ROLE;

  INSERT INTO job_photos (job_id, storage_path, phase) VALUES (J, 'x/fore.jpg', 'fore'), (J, 'x/efter.jpg', 'efter');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE jobs SET status = 'klar' WHERE id = J; r := 'FEL: klar utan egenkontroll'; EXCEPTION WHEN others THEN r := 'nekad (ok): ' || left(SQLERRM, 60); END;
  o := o || E'\nklar utan egenkontroll: ' || r;
  RESET ROLE;

  INSERT INTO self_checks (job_id, user_id, completed_at) VALUES (J, U, now());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE jobs SET status = 'klar' WHERE id = J; r := 'klar (ok)'; EXCEPTION WHEN others THEN r := 'FEL: ' || left(SQLERRM, 60); END;
  o := o || E'\nklar med foton + egenkontroll: ' || r;
  RESET ROLE;

  -- Arbetsorder: UE ser bara egna erbjudanden
  INSERT INTO work_orders (lead_id, status, ue_price) VALUES (L, 'offered', 1000);
  INSERT INTO work_order_offers (work_order_id, subcontractor_id, token, fixed_price, expires_at)
    SELECT id, S, 'tok-zz', 1000, now() + interval '1 day' FROM work_orders WHERE lead_id = L;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  o := o || E'\nUE ser egna erbjudanden (1): ' || (SELECT count(*) FROM work_order_offers)::text;
  o := o || E'\nUE ser egen arbetsorder (1): ' || (SELECT count(*) FROM work_orders)::text;
  BEGIN INSERT INTO work_orders (lead_id) VALUES (L); r := 'FEL: UE kunde skriva'; EXCEPTION WHEN others THEN r := 'nekad (ok)'; END;
  o := o || E'\nUE skriva work_orders: ' || r;
  RESET ROLE;

  RAISE EXCEPTION E'UE-RESULTAT (rullas tillbaka):%', o;
END $$;
