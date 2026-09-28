# Live-testplan: aktivering av ångerrätten (avsnitt 3-4, "angerratt_only")

Körs EFTER att Vidar har: 1) kört migration `20260927420000_customer_terms_scaffold.sql`,
2) kört `UPDATE public.app_settings SET value = value || jsonb_build_object('withdrawal_active', true) WHERE key = 'customer_terms';`,
3) deployat. Kör inte före dess - `isWithdrawalReady()` är annars falskt och inget nedan syns.

Förutsättning: `bun run scripts/live-test.ts` har körts och är grönt (publika endpoints, se
`docs/deploy-checklist-del1-ue.md`). Den här planen testar bara det nya ångerrätts-flödet.

## 0. Verifiera konfigurationen (skrivskyddat)
- [ ] `select value from app_settings where key='customer_terms'` – `withdrawal_active` är `true`,
      `villkor_active` är fortfarande `false` (allmänna villkor väntar på K1/K2/K3/K5).
- [ ] `select column_name from information_schema.columns where table_name='signature_requests' and column_name in ('customer_terms_mode','early_start_requested','right_of_withdrawal_pdf_path')` ger 3 rader.

## 1. Skapa en testoffert (vidar@roslagstak.se som kund, testlead med namn "ZZ Live-test")
- [ ] Skapa kalkyl + offert på testleaden som vanligt (admin eller Herman), skicka för
      signering till vidar@roslagstak.se.
- [ ] **Offertmailet:** innehåller meningen om 14 dagars ångerrätt och en länk till
      informationen om ångerrätt (`?doc=angerratt`). Öppna länken: ska visa en PDF med
      ångerrätt + ångerblankett, med RÄTT postadress (Stångholmsbacken 77, 127 40
      Skärholmen) och vidar@roslagstak.se. **INGEN** länk till "allmänna villkor" ska finnas
      i mailet (villkor_active är false).

## 2. Signeringssidan (`/signera/<token>`)
- [ ] Ovanför signaturen: kryssruta 1 med den fristående "övergångslydelsen" ("Jag har tagit
      del av offerten och av informationen om ångerrätt..."), **inte** den kombinerade
      texten som nämner "de allmänna villkoren".
- [ ] Kryssruta 2 (tidig start) syns, är **inte** förkryssad, och är märkt frivillig.
- [ ] Länkar till ångerrätts-PDF:en finns och fungerar; ingen länk till allmänna villkor.
- [ ] Under signaturknappen: "Genom att signera ingår du ett avtal med RoslagsTak (VT6 Invest
      AB) enligt offerten. Du har 14 dagars ångerrätt från i dag." (inte standardtexten).
- [ ] **Negativt test:** fyll i namn, ort, signatur och kod, men lämna kryssruta 1 tom –
      "Signera offerten"-knappen ska vara inaktiv (disabled), går inte att klicka.
- [ ] Kryssa i kryssruta 1 (lämna kryssruta 2 av), signera. Ska gå igenom.

## 3. Efter signering
- [ ] `select customer_terms_version, customer_terms_mode, customer_terms_ack, early_start_requested, terms_pdf_path, right_of_withdrawal_pdf_path from signature_requests where id='<id>'`:
      `customer_terms_version='1.0'`, `customer_terms_mode='angerratt_only'`,
      `customer_terms_ack` innehåller `ack1_at`/`ack1_ip`/`ack1_ua`, `early_start_requested=false`,
      `terms_pdf_path IS NULL` (inga allmänna villkor bifogade), `right_of_withdrawal_pdf_path` satt.
- [ ] **Bekräftelsemailet** till kunden: innehåller ångerfristens slutdatum (signeringsdag + 14
      dagar) och en länk till ångerrätts-PDF:en. Ingen mening om tidig start (kryssruta 2 var
      av). Ingen länk till allmänna villkor.
- [ ] Interna kopian (till den som skapade offerten): samma dokumentlänk, ingen
      ångerrätts-text (isInternal-grenen i mallen).

## 4. Tidig-start-spärren (hård DB-trigger)
- [ ] Skapa en NY testoffert (samma mönster), signera med **kryssruta 2 ikryssad** den här
      gången. Kontrollera: `early_start_requested=true`, `early_start_requested_at` satt.
      Bekräftelsemailet innehåller meningen om tidig start med rätt ångerfrist-slutdatum.
- [ ] Försök sätta `work_orders.start_date` till ett datum **före** dag 15 efter signeringen
      på ett jobb kopplat till den FÖRSTA testleaden (kryssruta 2 av): ska ge felet
      `ANGERFRIST_SPARR` (testa via SQL-editorn med en rollback-transaktion, inte i UI).
- [ ] Samma försök på jobbet kopplat till den ANDRA testleaden (kryssruta 2 på): ska gå igenom.

## 5. Städa
- [ ] Radera båda testleadsen, deras signature_requests-rader (och lagringsobjekten
      `signering/<id>/angerratt.pdf` + `original.pdf` + ev. signerad PDF i "offers"-bucketen),
      ev. testjobb/arbetsorder som skapades. Bekräfta 0 kvarvarande "ZZ Live-test"-rader.
- [ ] Uppdatera statustavlan med resultatet (grönt/rött, datum).
