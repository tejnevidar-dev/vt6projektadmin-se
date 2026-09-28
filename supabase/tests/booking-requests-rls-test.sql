-- RLS-test för booking_requests + leads.review_*-spärren. Körs EFTER
-- 20260928000000_booking_requests_and_reviews.sql i samma transaktion (klistra in migrationen +
-- detta i SQL-editorn). Slutar med RAISE EXCEPTION så att allt rullas tillbaka; resultatet står
-- i felmeddelandet. Skapar inga konton: en befintlig viewer-användare får rollen
-- underentreprenor inuti transaktionen (samma mönster som ue-package1-rollback-test.sql).

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
  U uuid; L uuid; B uuid; o text := '';
BEGIN
  SELECT id INTO U FROM profiles WHERE email = 'petterjohansson65@gmail.com';
  INSERT INTO user_roles (user_id, role) VALUES (U, 'underentreprenor');

  INSERT INTO leads (name, phone) VALUES ('ZZ booking-test', '070 000 00 99') RETURNING id INTO L;
  INSERT INTO booking_requests (lead_id, slot, requested_date) VALUES (L, 'formiddag', current_date + 3) RETURNING id INTO B;
  UPDATE leads SET customer_paid_at = now() - interval '10 days' WHERE id = L;

  -- Som admin/service-role (nuvarande session): ska fungera.
  o := o || E'\n[admin] antal bokningar synliga: ' || pg_temp.c('select 1 from booking_requests where id = ''' || B || '''');
  o := o || E'\n[admin] satt review_status=redo: ' || pg_temp.t('update leads set review_status = ''redo'' where id = ''' || L || '''');

  -- Som UE-rollen: ska INTE kunna se eller ändra bokningen, och INTE kunna ändra review_status.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  o := o || E'\n[UE] antal bokningar synliga (ska vara 0): ' || pg_temp.c('select 1 from booking_requests where id = ''' || B || '''');
  o := o || E'\n[UE] försök sätta status=bekraftad (ska nekas): ' || pg_temp.t('update booking_requests set status = ''bekraftad'' where id = ''' || B || '''');
  o := o || E'\n[UE] försök sätta review_status=redo på lead (ska nekas): ' || pg_temp.t('update leads set review_status = ''redo'' where id = ''' || L || '''');
  -- UE ska fortfarande kunna göra ANDRA ändringar på en lead den har åtkomst till (spärren
  -- rör bara review_*-fälten) - testar en ofarlig kolumn som redan är skrivbar för rollen.
  o := o || E'\n[UE] försök sätta notes (ska funka om UE annars får skriva på leaden): ' || pg_temp.t('update leads set notes = ''ue-test'' where id = ''' || L || '''');

  RESET ROLE;
  RAISE EXCEPTION 'ROLLBACK (avsiktligt) - resultat: %', o;
END $$;
