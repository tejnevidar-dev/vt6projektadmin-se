
# Kalkyl- och offertsystem

Vi bygger allt inuti Lovable — ingen ChatGPT-integration. Motivering: priser måste vara deterministiska, offerten ska auto-kopplas till lead/säljare, och PDF:en ska sparas på leaden precis som idag (`offers`-bucketen finns redan).

## 1. Databas (ny)

**`price_list`** — redigerbar prislista (endast admin)
- `category` (enum: `material`, `arbete`, `plat`, `tillagg`)
- `key` (t.ex. `betongpannor`, `tegelpannor`, `ranndalar_meter`, `skorstensinkladnad`)
- `label`, `unit` (`kvm`, `meter`, `st`, `timme`, `paket`), `unit_price`, `is_active`, `sort_order`
- Seedas med startvärden du får ändra i admin

**`calculations`** — en kalkyl per lead (1:1)
- `lead_id` (FK), `created_by`, `roof_area_kvm`, `material_key` (ref prislista), `ranndalar_meter`
- `plat_items` jsonb (lista av `{key, quantity}` för plåtarbeten som skorstensinklädnad)
- `tillagg` jsonb (fritextrader `{label, qty, unit_price}` för säljaren)
- `arbete_timmar`, `arbete_timpris`, `marginal_procent`, `rot_avdrag` (bool)
- `subtotal`, `moms`, `total`, `rot_belopp`, `att_betala` (räknas server-side vid save)

**`offers`** — genererade offerter (historik, en lead kan ha flera versioner)
- `lead_id`, `calculation_id`, `version` (auto-inkrement per lead)
- `pdf_path` (i befintlig `offers`-bucket), `status` (`draft`, `skickad`, `accepterad`, `avvisad`)
- `sent_at`, `accepted_at`, `total_amount`, `created_by`

**RLS**: säljare ser bara kalkyler/offerter på leads de själva skapat; admin ser allt. Prislistan är läsbar för alla inloggade men bara admin kan skriva.

## 2. Kalkyl-UI (`/kalkyl/$leadId` under `_authenticated`)

En sida med tre kolumner (desktop) / staplat (mobil):
- **Vänster: input** — kvm, materialdropdown (från prislista), ränndalar (m), checkboxar för plåtarbeten (skorstensinklädnad m.fl.), fri "extra rader"-tabell, timmar/timpris, marginal-slider, ROT-toggle
- **Mitten: live-uppdelning** — varje rad med qty × pris = summa, grupperat per kategori
- **Höger: totaler** (sticky) — subtotal, moms 25%, ROT-avdrag, "att betala", knappar: **Spara kalkyl**, **Generera offert**

Auto-räknar i realtid; sparas vid Spara.

## 3. Offert-PDF (server-side)

`createServerFn` `generateOffer({ calculationId })`:
1. Läser lead + kalkyl + prislista + säljarens kontaktuppgifter
2. Genererar PDF med `pdf-lib` (WASM-vänligt, funkar på Cloudflare Worker)
3. Layout: header med VT6-logga + offertnr, kunduppgifter, säljarens kontakt, specificerad radtabell, totaler, ROT-info, villkor (fri textmall vi definierar tillsammans), signaturruta
4. Sparar i `offers/{leadId}/offert-v{n}.pdf`, skapar `offers`-rad, kopplar också till leadens `offer_pdf_path` så befintliga `OfferPdfCard` fortsätter fungera
5. Retur: signed URL för visning + download

Version bumpas varje gång man klickar "Generera offert" så du har full historik.

## 4. Admin-vy för prislistan

Ny flik i `/settings` (eller `/admin`): tabell med inline-redigering av priser, lägg till/ta bort rader, aktivera/inaktivera. Bara admin kan öppna.

## 5. Access

- Säljare (roll `saljare`): kan öppna `/kalkyl/$leadId` på sina egna leads, generera offert
- Admin: allt + prislistan
- Hantverkare/UE/arbetsledare: ingen tillgång till kalkyl/offert (de ser bara arbetsordern som idag)

## Vad jag INTE bygger nu (kan komma senare)

- E-signering av offert direkt i systemet
- Automatisk e-postutskick av offert till kund (vi genererar PDF, du skickar manuellt tills vidare)
- AI-genererad beskrivningstext i offerten
- Kundens acceptera/avvisa-länk

## Teknisk stack

- DB via Supabase-migration (RLS + GRANT enligt reglerna)
- Kalkyl/offert-logik i `src/lib/calculations.functions.ts` + `src/lib/offers.functions.ts` med `requireSupabaseAuth`
- PDF: `pdf-lib` (bundlas i workern, ingen native binär)
- UI: TanStack-route under `_authenticated`

## Fråga innan vi kör

**Startpriser till prislistan** — vill du att jag seedar med rimliga placeholder-priser (t.ex. betongpannor 450 kr/kvm, tegelpannor 550, ränndalar 350/m, skorstensinklädnad 8500/st, timpris 650) som du sen redigerar i admin? Eller vill du ge mig dina riktiga siffror nu?

**Villkorstext på offerten** — har du en färdig villkorstext (giltighetstid, betalvillkor, garanti, ansvar) jag ska klistra in, eller vill du att jag skriver ett standard-utkast som du sen redigerar?

Svara på de två frågorna så börjar jag med migrationen.
