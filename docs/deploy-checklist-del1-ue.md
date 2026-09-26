# Deploy- och testchecklista: CRM del 1 + UE-paket 1

Förutsättning: Vidar har kört de fyra migrationerna i Supabase (SQL-editorn), i ordning:
`20260927090000_extern_seller_base_rls.sql`, `20260927090100_offer_flow_and_approval.sql`,
`20260927090200_customer_paid.sql`, `20260927100000_ue_package1.sql`. Pusha och deploya inte före det.

## Snabbväg: kör `cd crm && bun run scripts/live-test.ts` (med WEBHOOK_SECRET satt för webbformuläret). Skriptet kör alla publika kontroller och städar. Resten nedan är det som måste göras manuellt.

## 0. Verifiera migrationerna (skrivskyddat)
- [ ] `select column_name from information_schema.columns where table_name='leads' and column_name in ('customer_paid_at','customer_paid_amount')` ger 2 rader.
- [ ] Tabellerna `company_signature`, `work_orders`, `work_order_offers` finns; `subcontractors.pipeline_status` finns.
- [ ] `select public.ue_missing_requirements(id) from subcontractors limit 1` fungerar.
- [ ] `app_settings` har `ue_dispatch_config` och `ue_requirements_config`.

## 1. Deploy
1. `bun run build` (vid EBUSY: `bunx vite build`), `bun x tsc --noEmit`, `bunx vitest run` (ska vara helt grön).
2. Pusha `main`. `bunx wrangler deploy`.
3. Kontrollera att cron-triggrarna finns: `*/5`, `0 6`, `*/10` (lead-alerts + work-order-timeouts), `0 7` (ue-compliance).

## 2. Publika endpoints (regel 4, direkt efter deploy)
- [ ] Webbformulär (roslagstak-webhook): skicka testlead, se den i CRM. Radera efteråt.
- [ ] Webbformulär utan e-post (`"email": ""` och utelämnat fält): 201, lead skapas med e-post tom, notis och SLA fungerar. Radera efteråt.
- [ ] `POST /api/public/lead-inbox` med `x-inbox-secret`: 200, lead skapas. Radera efteråt.
- [ ] Inbound-email: skicka testmail till info@ från egen adress, lead skapas. Radera efteråt.
- [ ] `GET /api/public/morning-stats` med `X-Report-Secret`: 200, innehåller `paid`-blocket. Utan nyckel: 401.
- [ ] `/signera/<token>` och `/arbetsorder/<token>` svarar (404 för ogiltig token, inte 500).

## 3. Skarptest del 1 (vidar@roslagstak.se som kund, testlead)
- [ ] Intern säljare (Herman): skapa kalkyl och offert på testlead, "Skicka till godkännande": status "Väntar på godkännande", kunden får INGET mail.
- [ ] Vidar får notis (klockan + mail). Första godkännandet: rita bolagssignaturen, sedan ett klick.
- [ ] Kunden (Vidars mail) får signeringslänk, signerar med engångskod. Leaden får `offer_accepted_at` och steg Vunnen, notis till säljare och admin.
- [ ] Extern säljare (rollen saljare_extern): ser bara egna leads, kan skapa kalkyl/offert på egen lead, inte flytta till Vunnen, inte ändra provision/pris. Avslag: säljaren får besked, kunden inget.
- [ ] Ekonomi: markera testleaden betald med belopp; `morning-stats` visar den under `paid`.
- [ ] Rollback-testerna i `supabase/tests/` körs i SQL-editorn (slutar med RAISE EXCEPTION, ändrar inget).

## 4. Skarptest UE-kedjan (test-UE = Vidars mail)
- [ ] Skapa UE-post (Vidars mail), bjud in användare med rollen underentreprenor, fyll i alla krav, status Aktiv.
- [ ] Testa spärren: sätt status Hittad, försök tilldela: nekas.
- [ ] Signering av testoffert (avsnitt 3) skapar arbetsorder; sätt UE-pris på /arbetsorder; UE får mail, bell och uppdrag i /ue.
- [ ] Öppna PDF (sv + en) och tokenlänken utan inloggning. Acceptera: jobb skapas, säljaren notifieras.
- [ ] Avböj/utebliven svar: sätt `accept_hours` kort, kontrollera att den går vidare eller larmar.
- [ ] I /ue/<jobb>: "Klart" är låst utan före- och efterfoto och slutförd egenkontroll; ÄTA-begäran hamnar som väntande.

## 5. Städa
- [ ] Radera testleads, testoffert, signeringsbegäran, arbetsorder/erbjudanden, testjobb, UE-testposten och testanvändaren. Bekräfta 0 kvarvarande rader.
- [ ] Uppdatera statustavlan.

## 6. Tillägg efter UE-paket 2 (migration 140000)
- [ ] Test-UE:n behöver också "Skatteverkets intyg kontrollerat" (datum idag) i /underentreprenorer, annars blockeras tilldelning (skatteverket_intyg). Månadsintyg krävs först när UE haft jobb en tidigare månad.
- [ ] UE-faktura: försök godkänna utan lönebevis: nekas med "Ladda upp lönebevis". Ladda upp lönebevis på fakturan, godkänn: går.
- [ ] Foto med fas "Dagslut (tätat tak)" kan laddas upp i /ue/<jobb>. Kl. 17 vardagar utan dagens foto: bell + mail till UE (cron `*/10`, task ue-day-end).
