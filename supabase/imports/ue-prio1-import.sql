-- Import av prio 1-UE (ledning/ue/prio1-import.csv): 37 rader, pipeline 'hittad'.
-- Idempotent: hoppar över rader där org.nr redan finns (jämförs utan bindestreck/mellanslag).
-- Ingen UE får mail eller notis: bara INSERT i subcontractors (inga triggrar skickar något).
WITH src (company_name, org_number, phone, address, trade, team_size, pipeline_status, priority, notes) AS (VALUES
  ($q$Lejonet och Snickaren AB$q$, $q$559095-7568$q$, NULL, $q$Rimbo$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 10::int, $q$Z1 prio1. 8 anst, 14,4 Mkr. UE-signal: jobbar nästan bara åt andra företag (B2B). Snickeri + tak.$q$),
  ($q$MDV Takentreprenad AB$q$, $q$559216-8883$q$, NULL, $q$Brottby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 11::int, $q$Z1 prio1. 4 anst, 7,3 Mkr (2025, vinst). UE-signal: har även bemanning som tjänst.$q$),
  ($q$BFS Pocius Bygg & Städ AB$q$, $q$559159-1143$q$, NULL, $q$Åkersberga$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 12::int, $q$Z1 prio1. 10 anst, 8,6 Mkr (2024). UE-signal: tak, snickeri och byggstäd åt byggföretag. Kontrollera hur stor del som är tak.$q$),
  ($q$Ideala Tak Stockholm AB$q$, $q$559110-6850$q$, NULL, $q$Täby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 13::int, $q$Z1 prio1. 2–7 anst, 7,7 Mkr. Takbyten, pannor, plåttak, tätskikt. Växer snabbt.$q$),
  ($q$Tak och Bygg Sollentuna AB$q$, $q$559215-8850$q$, NULL, $q$Upplands Väsby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 14::int, $q$Z1 prio1. 10 anst, 24,7 Mkr (2025). Tegel, papp, plåt, rivning på flerbostadshus, industri och bostäder.$q$),
  ($q$Märsta Plåt & Bygg AB$q$, $q$556768-9574$q$, NULL, $q$Märsta$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 15::int, $q$Z1 prio1. 14 anst, 17,9 Mkr (2025). B2B (företag, föreningar, fastighetsägare). VARNING: omsättning -24 % och förlust 2,2 Mkr 2025. Gör kreditkontroll före samtal.$q$),
  ($q$Görla Plåtslageri AB$q$, $q$556499-3763$q$, $q$0176-141 45$q$, $q$Norrtälje$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 16::int, $q$Z1 prio1. 7 anst, 13,4 Mkr (2024). Alla tak- och plåtarbeten sedan 1994, takskyddscertifikat, medlem i Plåt & Ventföretagen.$q$),
  ($q$Norrtälje Plåtslageri AB$q$, $q$556499-2385$q$, $q$0176-22 94 80$q$, $q$Norrtälje$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 17::int, $q$Z1 prio1. Ca 4 anst. Samma adress som Norrtälje Takplåtslageri AB (559203-3814), så ett samtal räcker för båda. Fotplåt, rännor, taksäkerhet.$q$),
  ($q$Holmquist Plåtslageri AB$q$, $q$559419-7989$q$, NULL, $q$Norrtälje$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 18::int, $q$Z1 prio1. 1 anst, bolaget från 2023. UE-signal: skriver själva att de jobbar som underentreprenör. Liten kapacitet.$q$),
  ($q$LK08 Plåt AB$q$, $q$556833-0095$q$, NULL, $q$Täby$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 19::int, $q$Z1 prio1. 6 anst, 9,5 Mkr (2025, förlust). Plåttak och takbyten i Storstockholm. Har sökt plåtslagare. VARNING: säljer själv till villaägare.$q$),
  ($q$Täby Plåtslageri AB$q$, $q$556205-9146$q$, $q$08-510 129 48$q$, $q$Täby$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 20::int, $q$Z1 prio1. 4 anst, 4,8 Mkr (2023). Plåt, takpannor, tätskikt sedan 1980.$q$),
  ($q$TJ Säkra Tak AB$q$, $q$556865-0575$q$, $q$08-86 16 80$q$, $q$Vallentuna$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 21::int, $q$Z1 prio1. 9 anst. Plåttak, taksäkerhet. Bra omdömen. VARNING: säljer själv till villaägare.$q$),
  ($q$Knut Olsson Plåt & Bygg AB$q$, $q$556538-2651$q$, $q$08-591 241 21$q$, $q$Arlandastad$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 22::int, $q$Z1 prio1. 11 anst. Plåt + bygg sedan 1997, medlem i Plåt & Ventföretagen.$q$),
  ($q$Odensala Plåtslageri AB$q$, $q$556691-5327$q$, $q$08-591 113 31$q$, $q$Arlandastad$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 23::int, $q$Z1 prio1. 6 anst, 16,8 Mkr (2024). Mycket lönsamt, kan vara nöjda med nuvarande volym.$q$),
  ($q$MW Plåt & Tak AB$q$, $q$559013-7773$q$, NULL, $q$Arlandastad$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 24::int, $q$Z1 prio1. 4 anst. UE-signal: B2B-inriktat, tillverkar plåtdetaljer och hyr ut plåtverkstad.$q$),
  ($q$Kjellboms Plåtslageri AB$q$, $q$559082-0048$q$, NULL, $q$Djurhamn$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 25::int, $q$Z1 prio1. 6 anst, 14,9 Mkr (2024). Takplåt i koppar, zink, rostfritt. Långt från Norrtälje.$q$),
  ($q$Niemi Plåt och Bygg AB$q$, $q$556898-9189$q$, NULL, $q$Knivsta$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 26::int, $q$Z1 prio1. 7 anst. Plåt, bygg och tak åt privat, företag och BRF. Egen plåtverkstad. Passar Uppsala och Knivsta.$q$),
  ($q$Turelunds Plåtslageri AB$q$, $q$556583-8280$q$, NULL, $q$Knivsta$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 27::int, $q$Z1 prio1. 7 anst. Byggnadsplåt sedan 2000, medlem i Plåt & Ventföretagen.$q$),
  ($q$F1 Tak&Plåt AB$q$, $q$559421-2234$q$, NULL, $q$Järfälla$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 30::int, $q$Z2 prio1. 8,1 Mkr (2024, vinst). UE-signal: jobbar uttryckligen som underentreprenör.$q$),
  ($q$SO Tak & Plåt AB$q$, $q$556788-0546$q$, $q$08-767 00 60$q$, $q$Spånga$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 31::int, $q$Z2 prio1. 9 anst, 31 Mkr (2024). Alla taktyper + plåtverkstad sedan 2007. Medlem i Sveriges Takentreprenörer.$q$),
  ($q$Mariedals Tak & Plåt AB$q$, $q$559046-2601$q$, $q$020-10 00 92$q$, $q$Bro$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 32::int, $q$Z2 prio1. 6 anst, 11,4 Mkr (2025). Tak, tätskikt, plåt i hela Mälardalen.$q$),
  ($q$Lassfolks Plåtslageri AB$q$, $q$556973-4592$q$, $q$08-590 841 70$q$, $q$Värmdö$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 33::int, $q$Z2 prio1. 9 anst, 10,2 Mkr (2024). Plåt + byte av tegel- och betongpannor, alltså tak och plåt i samma lag.$q$),
  ($q$Nica Tak Entreprenad AB$q$, $q$559059-1839$q$, NULL, $q$Solna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 34::int, $q$Z2 prio1. 5 anst. Tegel, plåt, papp.$q$),
  ($q$Eddie Tak & Allservice AB$q$, $q$559027-5979$q$, NULL, $q$Järfälla$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 35::int, $q$Z2 prio1. 7 anst, ca 9 Mkr. Takläggning, plåt + byggstäd. Medlem i Plåt & Ventföretagen.$q$),
  ($q$DB Tak & Entreprenad AB$q$, $q$556769-2610$q$, $q$08-663 72 72$q$, $q$Stockholm$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 36::int, $q$Z2 prio1. Ca 10 anst, 32 Mkr. Tegel, papp, plåt. VARNING: säljer själv till villaägare. Fråga om kapacitet under lågsäsong.$q$),
  ($q$AB Stor-Stockholms Plåtslageri$q$, $q$556166-6529$q$, $q$08-29 09 00$q$, $q$Järfälla$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 37::int, $q$Z2 prio1. Ca 10 pers. UE-signal: kunderna är bland annat byggföretag. Sedan 1970.$q$),
  ($q$TLMTAK Stockholm AB$q$, $q$559328-3251$q$, NULL, $q$Handen$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 40::int, $q$Z3 prio1. 10 anst, 9,7 Mkr (2024). UE-signal: B2B mot bostadsbolag och byggentreprenörer. Dotterbolag till Takläggarna i Mälardalen AB.$q$),
  ($q$RH Stockholms TakEntreprenad AB$q$, $q$556802-3377$q$, NULL, $q$Nynäshamn$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 41::int, $q$Z3 prio1. 7 anst, 16,3 Mkr (2024, förlust). UE-signal: har även bemanning som tjänst. Förlusten tyder på att de behöver volym.$q$),
  ($q$NE Nordic Entreprenad AB$q$, $q$559049-8696$q$, $q$08-25 50 91$q$, $q$Huddinge$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 42::int, $q$Z3 prio1. Ca 12 anst, 25,6 Mkr. UE-signal: takbyten, plåt och bygg åt företag. Växer 62 % per år.$q$),
  ($q$M Tak Stockholm AB$q$, $q$556814-3910$q$, NULL, $q$Skogås$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 43::int, $q$Z3 prio1. 17 anst 2024 (25 året innan), 20,3 Mkr. Personalen minskade med 8, vilket kan betyda ledig kapacitet.$q$),
  ($q$Briljant Tak och Bygg Stockholm AB$q$, $q$559136-8336$q$, $q$08-128 554 00$q$, $q$Bandhagen$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 44::int, $q$Z3 prio1. 14,6 Mkr (2025, +38 %). Tegel, papp, plåt på flerbostadshus, industri, bostäder. 4,7 i betyg på 139 omdömen.$q$),
  ($q$Thomas Wall Tak & Fastighet AB$q$, $q$556756-7317$q$, NULL, $q$Handen$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 45::int, $q$Z3 prio1. 7 anst, 13,1 Mkr (2024). Takarbeten (ej plåt) sedan 2008, villakunder med ROT.$q$),
  ($q$Ambar Tak AB$q$, $q$559303-1676$q$, NULL, $q$Bandhagen$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 46::int, $q$Z3 prio1. 5 anst, 7,7 Mkr. Tegel, tätskikt, varmasfalt, plåt. Jobbar i hela Mälardalen.$q$),
  ($q$Uppsala Takentreprenad AB$q$, $q$556976-3864$q$, $q$018-25 13 38$q$, $q$Uppsala$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 50::int, $q$Z4 prio1. 1–4 anst, 6,7 Mkr. Samma adress som Byggentreprenad & Plåtentreprenad i Uppsala AB (559172-4827), så ett samtal räcker för båda. Tak, plåt, sol.$q$),
  ($q$Vittinge Tak, Bygg och Plåtslageri AB$q$, $q$556724-9981$q$, $q$0224-306 60$q$, $q$Heby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 51::int, $q$Z4 prio1. 4 anst, 4,8 Mkr (2025, förlust). Uppsala och Enköping. Förlusten tyder på att de behöver volym.$q$),
  ($q$Tuuls Tak, Fönster & Byggtjänster AB$q$, $q$556788-2310$q$, NULL, $q$Eskilstuna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 52::int, $q$Z4 prio1. 3 anst. Tegel, plåt, papp. Inga anmärkningar. För Eskilstuna och Strängnäs.$q$),
  ($q$Täta Tak JR AB$q$, $q$556916-5383$q$, NULL, $q$Mellösa$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 53::int, $q$Z4 prio1. 5 anst, 7,6 Mkr (2023). Familjeföretag, papp och tegel. För Sörmland.$q$)
), ins AS (
  INSERT INTO public.subcontractors (company_name, org_number, phone, address, trade, team_size, pipeline_status, priority, notes)
  SELECT s.company_name, s.org_number, s.phone, s.address, s.trade, s.team_size, s.pipeline_status, COALESCE(s.priority, 100), s.notes
  FROM src s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.subcontractors e
    WHERE regexp_replace(COALESCE(e.org_number, ''), 'D', '', 'g') = regexp_replace(COALESCE(s.org_number, ''), 'D', '', 'g')
      AND regexp_replace(COALESCE(s.org_number, ''), 'D', '', 'g') <> ''
  )
  RETURNING id
)
SELECT (SELECT count(*) FROM ins) AS importerade, (SELECT count(*) FROM src) AS i_filen;
