-- Kundvillkor (ångerrätt, allmänna villkor inkl. byggherreansvar/garanti, ångerblankett) i
-- offert-/signeringsflödet. Källa: ledning/jurist/kundvillkor-v1.md (Agent - Jurist, version
-- 1.0, 2026-09-27) - "INTE klar att använda mot kund" förrän [BESLUT] K1-K5 är beslutade och
-- Vidar godkänt versionen (via Driftchef -> Projektledare).
--
-- TVÅ OBEROENDE BLOCK (Projektledarens prio 2026-09-28: ångerrätten är HÖG juridisk risk och
-- ska kunna aktiveras separat, långt innan de allmänna villkoren som väntar på K1/K2/K3/K5):
--   - withdrawal_active: ångerrätt + ångerblankett (avsnitt 3-4). Inga [BESLUT] i själva
--     texten förutom K4 (VT6:s postadress/e-post för kundärenden), som krävs enligt lag.
--   - villkor_active: Allmänna villkor (avsnitt 2, byggherreansvar §6, garanti §8). Blockerad
--     tills K1 (betalningsplan), K2 (betalningsvillkor), K3 (MATAKI-garantin) och K5 (ARN) är
--     beslutade.
-- Se src/lib/customer-terms.ts: isWithdrawalReady()/isVillkorReady()/resolveCustomerTermsMode()
-- vägrar aktivera respektive block så länge en enda text i det blocket fortfarande innehåller
-- en "[...]"-platshållare, oavsett vem som sätter active:true - samma säkerhetsmönster som
-- UE-ramavtalets hasUnresolvedPlaceholders(). BEFINTLIGA offerter och signeringar (inkl. de 12
-- utestående v40-v42) är helt opåverkade: NULL i signature_requests.customer_terms_version =
-- dagens beteende, för alltid, oavsett vad som händer med den här konfigurationen senare.
--
-- ack_withdrawal_label (kryssruta 1 när BARA ångerrätt bifogas) är satt till NULL med avsikt:
-- juristens givna kryssruta 1-text ("...offerten, de allmänna villkoren och informationen om
-- ångerrätt...", sparad som ack_full_label) nämner uttryckligen de allmänna villkoren, vilket
-- blir missvisande om det dokumentet inte bifogas. Det är den enda återstående biten som krävs
-- från Jurist för att kunna aktivera avsnitt 3-4 för sig - allt annat i withdrawal-blocket är
-- klart. Se passrapport till Driftchefen 2026-09-28.
--
-- Uppdatera med en enkel UPDATE när fler K-punkter är beslutade, ingen ny migration behövs:
--   UPDATE public.app_settings SET value = value || jsonb_build_object(
--     'withdrawal_active', true, 'ack_withdrawal_label', '...'
--   ) WHERE key = 'customer_terms';
INSERT INTO public.app_settings (key, value)
VALUES ('customer_terms', $json$
{"withdrawal_active":false,"withdrawal_version":"1.0","angerratt_text":"Ångerrätt\nDu har rätt att frånträda (ångra) detta avtal inom 14 dagar utan att ange något skäl. Ångerfristen löper ut 14 dagar efter den dag då avtalet ingicks, alltså den dag du signerade offerten.\n\nFör att utöva ångerrätten ska du meddela oss, RoslagsTak (VT6 Invest AB), [postadress – BESLUT K4], [e-post – BESLUT K4], 070-154 36 39, ditt beslut att frånträda avtalet. Gör det i ett tydligt meddelande, till exempel ett brev eller ett mejl. Du kan använda den bifogade ångerblanketten, men det är inget krav.\n\nFör att du ska hinna ångra dig i tid räcker det att du skickar ditt meddelande om att du utövar ångerrätten innan ångerfristen har gått ut.\n\nEffekter av att du ångrar dig\nOm du frånträder avtalet betalar vi tillbaka alla betalningar vi har fått från dig utan onödigt dröjsmål, och senast 14 dagar från den dag vi fick ditt meddelande. Återbetalningen görs med samma betalningsmetod som du använde, om du inte uttryckligen har godkänt något annat. Du debiteras inga avgifter för återbetalningen.\n\nOm arbetet har börjat under ångerfristen\nArbetet börjar inte under ångerfristen om du inte uttryckligen har begärt det. Har du begärt att arbetet ska börja under ångerfristen och sedan ångrar dig, ska du betala ett belopp som motsvarar den del av arbetet som har utförts fram till att du meddelade oss, i förhållande till hela avtalet.\n\nNär ångerrätten upphör\nOm arbetet har utförts helt efter att du uttryckligen samtyckt till att det började under ångerfristen och gått med på att ångerrätten då upphör, har du inte längre någon ångerrätt.","angerblankett_text":"Till: RoslagsTak (VT6 Invest AB), [postadress – BESLUT K4], [e-post – BESLUT K4]\n\nJag meddelar härmed att jag frånträder mitt avtal om följande tjänst:\nOffertnummer: ……………………\nAvtalet ingicks (datum då offerten signerades): ……………………\nNamn: ……………………\nAdress: ……………………\nUnderskrift (endast om blanketten skickas på papper): ……………………\nDatum: ……………………","ack_withdrawal_label":null,"early_start_checkbox_text":"Jag begär att arbetet får börja innan ångerfristen på 14 dagar har gått ut. Jag förstår att om jag ångrar mig efter att arbetet har börjat, betalar jag för den del som har utförts. Jag förstår också att jag inte längre har någon ångerrätt när arbetet är helt utfört.","early_start_confirmed_sentence":"Du har begärt att arbetet får börja under ångerfristen. Ångrar du dig efter att vi har börjat betalar du för den del som har utförts. När arbetet är helt klart upphör ångerrätten. Ångerfristen går ut {datum}.","villkor_active":false,"villkor_version":"1.0","allmanna_villkor_text":"RoslagsTak (VT6 Invest AB, org.nr 559539-3595), [postadress – BESLUT K4], 070-154 36 39, [e-post för kundärenden – BESLUT K4]. Villkorsversion 1.0.\n\n1. Avtalet\n1.1 Avtalet består av den signerade offerten och dessa villkor. Vid motstrid gäller offerten. Konsumenttjänstlagen (1985:716) gäller, och villkor som är sämre för dig än lagen gäller inte.\n1.2 Avtalet ingås när du signerar offerten.\n\n2. Pris och tilläggsarbeten\n2.1 Priset är fast och anges i offerten inklusive moms. Det omfattar det arbete och material som står i offerten.\n2.2 Arbete som inte ingår i offerten (tilläggsarbete) utför vi bara efter ditt skriftliga godkännande, med pris och påverkan på tiden angivna i förväg. Undantag: om något måste åtgärdas direkt för att förhindra skada, till exempel för att hålla taket tätt, gör vi den minsta nödvändiga åtgärden och kontaktar dig samma dag, enligt konsumenttjänstlagen.\n2.3 Upptäcker vi dolda skador när det gamla taket rivits (till exempel röta i råsponten) visar vi dig foton och ett skriftligt prisförslag innan vi åtgärdar dem.\n\n3. ROT-avdrag\n3.1 Om offerten anger ROT-avdrag har vi räknat preliminärt med ROT-avdrag på arbetskostnaden enligt de uppgifter du har lämnat. Vi begär utbetalningen från Skatteverket.\n3.2 Du ansvarar för att uppgifterna om dig (bland annat att du äger bostaden och hur mycket avdrag du har kvar för året) är riktiga. Nekar Skatteverket avdraget helt eller delvis betalar du mellanskillnaden inom 30 dagar från vår faktura, om det inte beror på ett fel från vår sida.\n\n4. Betalning\n4.1 [BESLUT K1: betalningsplan] Vi fakturerar enligt betalningsplanen i offerten. Betalningsvillkor [BESLUT K2: 10] dagar från fakturadatum.\n4.2 Vi tar aldrig emot betalning, handpenning eller kontanter via säljaren. Betalning sker bara mot faktura från VT6 Invest AB.\n4.3 Vid sen betalning har vi rätt till dröjsmålsränta enligt räntelagen och till påminnelseavgift enligt lag.\n\n5. Tider\n5.1 Beräknad startvecka och arbetstid framgår av offerten. Vi bekräftar startdagen senast [7] dagar innan.\n5.2 Om väder gör arbetet osäkert eller olämpligt skjuts det fram. Taket hålls alltid tätt under tiden.\n\n6. Arbetsmiljöansvar (byggherreansvar)\n6.1 Du överlåter till oss, och vi tar över, de uppgifter som enligt 3 kap. 6 § arbetsmiljölagen åvilar den som låter utföra byggnadsarbete, både för planeringen och för utförandet av arbetet enligt detta avtal (3 kap. 7 c § arbetsmiljölagen). Vi utser byggarbetsmiljösamordnare och ansvarar för samordningen av arbetsmiljön på arbetsplatsen.\n\n7. Din medverkan\n7.1 Du ger oss tillträde till fastigheten under arbetstid, plats för container och ställning, och tillgång till el om inget annat har avtalats.\n7.2 Du håller dig själv, barn och husdjur borta från det avspärrade området.\n\n8. Garantier (se även garantibeviset)\n8.1 10 års utförandegaranti: vi svarar för att arbetet är fackmässigt utfört under 10 år från slutgenomgången.\n8.2 30 års tätskiktsgaranti via MATAKI: [BESLUT K3 – FAKTA SAKNAS] lämnas för tätskikt av MATAKI-produkter enligt MATAKI:s garantivillkor, som du får tillsammans med garantibeviset.\n8.3 Garantierna gäller utöver dina rättigheter enligt konsumenttjänstlagen och begränsar dem inte.\n\n9. Fel och reklamation\n9.1 Om du upptäcker ett fel ska du meddela oss inom skälig tid. Ett meddelande inom två månader räknas alltid som i rätt tid. Reklamation kan göras upp till tio år efter att arbetet avslutades (konsumenttjänstlagen 17 §).\n9.2 Vi åtgärdar fel utan kostnad för dig enligt konsumenttjänstlagen.\n\n10. Skador\n10.1 Vi har ansvarsförsäkring. Orsakar vi skada på din egendom ansvarar vi enligt konsumenttjänstlagen.\n\n11. Avbeställning\n11.1 Utöver ångerrätten har du rätt att avbeställa arbetet innan det är slutfört. Vi har då rätt till ersättning enligt konsumenttjänstlagen 42 §, bland annat för utfört arbete och material som inte kan användas till annat.\n\n12. Personuppgifter\n12.1 Vi behandlar dina uppgifter för att utföra avtalet, hantera ROT-avdraget och ta hand om garantin. Mer information finns på roslagstak.se [VERIFIERA: integritetstext på sajten].\n\n13. Tvister\n13.1 Kan vi inte komma överens kan du vända dig till Allmänna reklamationsnämnden (ARN), arn.se. Vi följer ARN:s rekommendationer [BESLUT K5: rek. JA]. Tvisten kan också prövas av allmän domstol.","ack_full_label":"Jag har tagit del av offerten, de allmänna villkoren och informationen om ångerrätt, inklusive ångerblanketten.","garantibevis_text":"Garantibevis – RoslagsTak (VT6 Invest AB, org.nr 559539-3595)\nFastighet: [adress] · Offertnummer: [nr] · Slutgenomgång: [datum]\n\n10 års utförandegaranti\nVi garanterar att takarbetet enligt offerten är fackmässigt utfört. Visar sig ett fel i vårt utförande inom 10 år från slutgenomgången, åtgärdar vi det utan kostnad för dig.\nGarantin omfattar inte:\n- normalt slitage\n- skador av yttre händelser som storm, fallande träd, brand eller åverkan\n- skador av ändringar eller ingrepp som någon annan än vi har gjort\n- bristande underhåll, till exempel igensatta hängrännor eller att snö inte har skottats när det krävts\n- material eller delar som vi inte har levererat eller monterat.\n\nAnmäl fel till oss så snart du har märkt dem. Garantin gäller utöver dina rättigheter enligt konsumenttjänstlagen och begränsar dem inte.\n\n30 års tätskiktsgaranti via MATAKI [BESLUT K3]\n[Text fylls i när MATAKI:s villkor är bekräftade: vilka produkter, vem som är garantigivare, hur garantin registreras och vad den täcker.]"}
$json$::jsonb)
ON CONFLICT (key) DO NOTHING;

-- NULL = befintligt beteende (dagens offerter: inga extra PDF:er, ingen spärr vid signering).
-- Sätts bara av createSigningRequest när resolveCustomerTermsMode() ger "withdrawal_only"
-- eller "full" vid den tidpunkt offerten skapas - äldre/redan skapade rader förblir NULL.
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS customer_terms_version text,
  ADD COLUMN IF NOT EXISTS customer_terms_ack jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS early_start_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_start_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_pdf_path text,
  ADD COLUMN IF NOT EXISTS right_of_withdrawal_pdf_path text;

-- Hård spärr (kundvillkor-v1.md avsnitt 5): en arbetsorder får inte ha ett startdatum före
-- dag 15 efter kundens signering, om kunden inte uttryckligen begärt tidig start (kryssruta 2).
-- Gäller BARA leads vars signerade offert har customer_terms_version satt - alltså aldrig för
-- dagens/äldre offerter (kolumnen är NULL för dem), så detta är helt inert tills Vidar
-- aktiverar minst withdrawal-blocket.
CREATE OR REPLACE FUNCTION public.enforce_early_start_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sr RECORD;
  earliest date;
BEGIN
  IF NEW.start_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT customer_signed_at, early_start_requested INTO sr
  FROM public.signature_requests
  WHERE lead_id = NEW.lead_id
    AND customer_terms_version IS NOT NULL
    AND status = 'signed'
  ORDER BY customer_signed_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND OR sr.customer_signed_at IS NULL OR sr.early_start_requested THEN
    RETURN NEW;
  END IF;

  earliest := (sr.customer_signed_at::date + 15);
  IF NEW.start_date < earliest THEN
    RAISE EXCEPTION 'ANGERFRIST_SPARR: arbetsorder kan inte fa startdatum fore % utan kundens begaran om tidig start (kundvillkor-v1.md avsnitt 5)', earliest;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_early_start_gate ON public.work_orders;
CREATE TRIGGER trg_enforce_early_start_gate
BEFORE INSERT OR UPDATE OF start_date ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_early_start_gate();
