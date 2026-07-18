# Plan: Offert & Kalkyl – sammanslagning + drafts

## 1. Navigation
- Byt namn på "Ny offert"-fliken i sidomenyn till **Offert & Kalkyl**.
- Ta bort separat "Kalkyl"-flik från sidebar (kalkyl per lead nås fortsatt via lead-vyn, men huvudflödet flyttas till den nya sidan).
- Route: behåll `/offert/ny` för URL-stabilitet, men rendera nya sidan där.

## 2. Ny sida `/offert/ny` – två flikar
- **Flik "Offert"**: nuvarande manuella offertformulär (oförändrat innehåll).
- **Flik "Kalkyl"**: bildanalys + formulär från `/kalkyl/$leadId`, fristående (ingen lead krävs).
- Delad state: när kalkylen räknas ut → knapp "Använd i offert" som fyller belopp (entreprenadpris, material) i offert-fliken.

## 3. Drafts (per användare)
- Ny tabell `offer_drafts`:
  - `id`, `created_by`, `kind` ('offer' | 'calc' | 'combined'), `payload jsonb`, `label text`, `lead_id` (nullable), `updated_at`.
  - RLS: ägaren + admin. GRANTs.
- UI: draft-lista i toppen av sidan ("Mina utkast"), knappar **Spara utkast** och **Uppdatera utkast**. Autosave var 30:e sekund vid ändring.
- Öppna draft → laddar payload in i formuläret.

## 4. Historik & status per kund
- Använd befintlig `offers`-tabell. När PDF genereras och en kund är vald (lead_id finns): skapa `offers`-rad med `version` = max+1, `status='draft'`, `total_amount`.
- Panel "Tidigare offerter för kunden" när kund vald: version, datum, status, knappar **Markera skickad / accepterad / avvisad**.

## 5. "Välj kund"-dialog
- Knapp i offert-fliken bredvid Kund-rubriken.
- Dialog med:
  - Sökfält (namn, adress, telefon, mail) – filtrerar client-side över hämtade leads.
  - Lista med lead-namn + adress + status.
  - Klick på lead → fyller `kundNamn`, `objektadress`, `telefon`, `mail`, `fastighetsbeteckning` från lead/property. Sparar `lead_id` internt för historik/drafts.
- Ta bort valet: knapp "Rensa kund".

## Tekniska detaljer
- Filer att skapa:
  - `supabase/migrations/*_offer_drafts.sql`
  - `src/lib/offer-drafts.ts` (CRUD via supabase-klient, RLS-skyddat)
  - `src/components/SelectCustomerDialog.tsx`
  - `src/components/OfferTab.tsx` (extraherad från nuvarande `offert.ny.tsx`)
  - `src/components/CalcTab.tsx` (extraherad från `kalkyl.$leadId.tsx`)
- Filer att ändra:
  - `src/routes/offert.ny.tsx` → wrapper med Tabs + drafts + kundvalslogik
  - `src/components/AppShell.tsx` → byt navlabel, ta bort separat kalkyl-flik
  - `src/lib/calculations-api.ts` → ev. lägg till "orphan calc" (utan lead) om vi vill spara kalkyler utan lead — annars endast draft.

## Vad som INTE ingår (kan komma sen om du vill)
- E-postutskick av PDF till kund.
- Redigering av befintliga offer-rader (bara statusbyte).
- Delning av utkast mellan användare.

Säg till om jag ska köra på detta eller justera något innan jag bygger.