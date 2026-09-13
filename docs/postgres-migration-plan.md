# Postgres-migreringsplan: Lovable Cloud → eget Supabase-projekt

Status: **pågående.** Detaljerar fas 5 ("Migrera databas + Storage") i
[lovable-exit-plan.md](./lovable-exit-plan.md).
Senast uppdaterad: 2026-09-07.

**Grundprincip, gäller hela planen:** Lovable Cloud-projektet (`daexufvunqqjvfuopdrc`)
förblir oförändrat och i drift under HELA migreringen. Allt vi gör mot källan är
**läsande** (SQL `SELECT`-frågor i Lovables SQL editor) — inget `DROP`/`ALTER`/`DELETE`/
`UPDATE`/`TRUNCATE` körs någonsin mot Lovable Cloud-databasen.

**Viktig metodändring sedan planen skrevs första gången:** Lovable Cloud exponerar
**varken en direkt Postgres connection-sträng eller `SUPABASE_SERVICE_ROLE_KEY`** i sitt
UI (bekräftat 2026-09-06/07 — inget under Cloud → Secrets, ingen synlig databasanslutning).
Det utesluter `pg_dump`/`supabase db push --db-url <källa>` mot källan helt. Metoden är
istället: **Lovables SQL editor → CSV-export → CSV-import direkt i det nya projektets
SQL editor/Table editor**, körd av dig lokalt utan att filerna passerar den här chatten
(gäller särskilt `auth.users` som innehåller lösenordshashar).

Verktyg på plats: **Supabase CLI v2.116.0** (`C:\Users\tejne\bin\supabase.exe`) — används
för `supabase db push` mot det **nya** projektet (det har en riktig connection-sträng),
inte mot Lovable Cloud.

---

## Status just nu

| Del | Status |
|---|---|
| Schema/RLS/funktioner/triggers (~96 migrationsfiler) | **Klart 2026-09-07** — `supabase db push` kört mot nya projektet (`xkyygppcatpkxiyyfeiy`), alla migrationer applicerade utan fel |
| Buckets + policyer för `self-check-images`/`self-check-pdfs`/`subcontractor-docs` | **Klart** — del av db push ovan |
| Fyra saknade e-posttabeller (`email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`) + två döda funktioner (`email_queue_dispatch`/`wake`) | **Upptäckt och åtgärdat under db push** — samma "skapat direkt i databasen, aldrig migrerat"-mönster som Storage-bucketsen. Ny migration: [20260707050000](../supabase/migrations/20260707050000_add_missing_email_tables.sql) |
| `auth.users` | **Klart 2026-09-07** — alla 8 användare importerade (via genererade INSERT-satser i SQL editor, eftersom Table Editors CSV-import är blockerad för `auth`-schemat) |
| `auth.identities` | **Klart 2026-09-07** — samma metod |
| `public`/`private`-tabelldata | **Klart 2026-09-08** — alla ~30 tabeller med data migrerade (CSV export/import), i tre beroende-ordnade grupper. Flera tabeller behövde `truncate` först: antingen för att våra migrationer förifyller platshållardata (`price_list`, `quick_price_items`, `quick_price_settings`, `offer_number_counters`) eller för att triggers auto-genererade rader som bieffekt av att importera `leads`/`jobs`/`calendar_events` (`jobs`, `calendar_events`, `booking_reminders`, `calendar_event_shares_users`) — se [[project-roslagstak-lovable-migration-progress]]-minnet för fulla listan |
| Storage-filer | **Klart 2026-09-07** — `offers` och `lead-documents` överförda till nya projektet, samma mappstruktur/paths. Övriga tre skippade avsiktligt (inget affärsvärde/tomt) |
| Edge Functions-fliken (finns kod där?) | **Tom, bekräftat 2026-09-07 — inget att portera** |
| Jobs-fliken (vad innehåller den?) | **Klart 2026-09-07** — ett aktivt jobb: `send-booking-reminders` var 5:e minut. Inte en databasfråga, utan Lovables schemaläggning som anropar vår befintliga endpoint. Se [lovable-exit-plan.md §1.8](./lovable-exit-plan.md) för ersättning (Cloudflare Cron Triggers) |

## 0. Vad som INTE behöver migreras

- **Inga Supabase Edge Functions** i vårt repo (`supabase/functions/` finns inte) — men
  Lovable Clouds UI har en "Edge Functions"-flik. Om något faktiskt ligger deployat där
  är det odokumenterad kod som aldrig hamnat i git — måste kollas manuellt (öppen fråga).
- **Inga extra Postgres-extensions** utöver Supabase-standard — `gen_random_uuid()` kommer
  från `pgcrypto`, påslaget som standard på alla Supabase-projekt.
- **Inga `vault`/`pgsodium`-hemligheter eller auth-hooks** i databasen.

## 1. Schema, RLS-policyer, funktioner, triggers och buckets: `supabase db push`

Körs mot det **nya** projektets connection-sträng (inte källan):
```
supabase db push --db-url "<nya projektets URL, percent-encoded lösenord>"
```
Det applicerar alla ~90 migrationsfiler i ordning — RLS-policyer, funktioner
(`private.has_role`, `reserve_offer_number`, `reserve_ata_number`, `handle_lead_booking`
osv.), triggers, och nu även alla sex Storage-buckets med rätt policyer, helt automatiskt.

**Kontrollpunkt innan vi litar på detta:** finns ändringar gjorda direkt i Lovables SQL
editor som aldrig blev en migrationsfil hos oss? Vi har redan hittat och åtgärdat ett
sånt fall (de tre Storage-bucketsen) genom att fråga `pg_policies` direkt i produktionen.
Samma metod kan användas för andra tabeller om du är osäker — fråga mig så ger jag dig
en verifieringsfråga att köra i SQL editorn.

## 2. `auth.users` / `auth.identities` — redan påbörjat

Metod (redan körd av dig för dessa två tabeller):
1. I Lovable Cloud SQL editor: `select * from auth.users;` → exportera CSV.
2. Importera CSV:n direkt i nya projektets SQL editor/Table editor, i `auth.users`.
3. Upprepa för `auth.identities` (**efter** users, eftersom identities pekar på users via `user_id`).

**Känt läge:** endast e-postinloggning är aktiverat i källan (inga OAuth-providers), vilket
förenklade detta steg. Lösenordshashar migreras med — inloggningsuppgifterna fortsätter
fungera, men alla måste logga in på nytt efter cutover eftersom varje Supabase-projekt har
sin egen JWT-hemlighet (sessioner/tokens går inte att flytta, och det är förväntat).

**Återstår:** bekräfta att importen i det nya projektet faktiskt gick igenom utan fel
(kolumn-mismatchar mellan Postgres/GoTrue-versioner kan i teorin strula — kolla att
raderna faktiskt syns i nya projektets `auth.users` innan vi går vidare).

## 3. Data i `public`/`private`-tabeller — KLART 2026-09-08

Alla tabeller med data migrerade, CSV export/import, i tre grupper (exakta radantal togs
fram via `count(*)` — de uppskattade `pg_stat_user_tables`-siffrorna visade sig vara
otillförlitliga för flera tabeller, lita inte på dem):

- **Grupp 1** (inga leads/jobs-beroenden): `profiles`, `user_roles`, `invitations`,
  `employees`, `price_list`, `quick_price_items`, `quick_price_settings`,
  `seo_daily_metrics`, `seo_page_audits`, `seo_sync_log`, `offer_number_counters`,
  `email_send_state`, `email_unsubscribe_tokens`, `email_send_log`, `properties`, `leads`
  (i den ordningen — `leads.property_id` kräver att `properties` importeras först).
- **Grupp 2** (beroende av leads): `jobs`, `lead_activities`, `lead_documents`,
  `signature_requests`, `calendar_events`, `booking_reminders`, `webhook_logs`,
  `job_estimate_audit`, `sales_goals`.
- **Grupp 3** (beroende av jobs/calendar_events): `job_members`, `time_entries`,
  `self_checks`, `calendar_event_shares_users`, `calendar_event_shares_roles`.

**Två typer av "oväntat redan fyllda tabeller" stöttes på och löstes med `truncate`
innan import:**
1. Tabeller våra egna migrationer förifyller med platshållardata:
   `price_list`, `quick_price_items`, `quick_price_settings`, `offer_number_counters`.
2. Tabeller som triggers automatiskt skriver till som bieffekt av att importera en
   tidigare tabell (t.ex. `handle_lead_booking`-triggern skapar en `jobs`-rad när en
   `leads`-rad med `pipeline_stage='bokad'` importeras): `jobs`, `calendar_events`,
   `booking_reminders`, `calendar_event_shares_users`. Alla tömdes och importerades om
   med de riktiga raderna från Lovable istället för de trigger-genererade.

0-radstabellerna skippades helt (se lista i status-tabellen ovan/tidigare version).

## 4. Storage — scope medvetet begränsat (beslutat 2026-09-07)

**Beslut, per bucket (klart för alla sex 2026-09-07):**
- **Migreras**, samma mappstruktur/filnamn/paths: `offers` (12 mappar, ~hälften med
  innehåll), `lead-documents` (3 filer, ~672 KB).
- **Skippas** (inget kvarstående affärsvärde, eller tomt): `self-check-images`,
  `self-check-pdfs`, `work-orders`, `subcontractor-docs` (bekräftat helt tom). Bucketen
  och policyerna återskapas ändå av migrationen från steg 1 så att appen fungerar
  framåt — det är bara det gamla filinnehållet som inte flyttas.

**Metod för de två bucketsen som ska migreras:** bekräftat att Lovable Cloud stödjer
flervalsnedladdning ("Download"-knapp vid markerade filer). Per bucket som ska migreras:
1. Testa först att nedladdningen ger en zip som **bevarar mappstrukturen** vid uppackning
   (viktigt att verifiera på den minsta av de valda bucketsen innan vi litar på metoden
   för resten).
2. Packa upp lokalt, dra samma mappstruktur till motsvarande bucket i nya projektets
   Storage-UI.
3. Upprepa per bucket som faktiskt ska migreras.

Ingen kod/export-route behövs längre givet att bulknedladdning finns och scopet är
begränsat till det som har affärsvärde.

## 5. Secrets / miljövariabler — inget att "migrera", bara byta ut

- Nya projektets `anon`/`service_role`-nycklar och projekt-URL blir automatiskt andra än
  dagens — appens `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`
  pekas om till de nya värdena vid cutover, migreras inte.
- Tredjepartsnycklar (Twilio, SEMrush, GSC, Resend, OpenAI) hanteras i den separata
  Lovable-exit-planen — går direkt till den nya hostingmiljön, inte via Supabase.

## Ordning, sammanfattat — vad som faktiskt återstår

1. **Bekräfta** att `auth.users`/`auth.identities`-importen till nya projektet lyckades.
2. **Du ger mig nya projektets connection-sträng** (lokalt, aldrig i klartext här) →
   vi kör `supabase db push` → schema/RLS/funktioner/triggers/buckets på plats.
3. **Du kollar storlek** på `offers`/`lead-documents`/`work-orders`/`subcontractor-docs`
   → vi bestämmer vilka som är värda att migrera → du laddar ner/upp dem manuellt.
4. **Du kollar Edge Functions- och Jobs-flikarna** → vi hanterar eventuell dold kod.
5. CSV-export/import av resten av `public`/`private`-tabellerna (litet jobb givet
   datamängden).
6. Slutlig verifiering av nya projektet innan något pekas om — Lovable Cloud förblir
   produktionsmiljön fram till dess.
