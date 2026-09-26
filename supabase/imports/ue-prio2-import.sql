-- Import av UE-kandidater (prio2-import.csv): 62 rader, pipeline 'hittad'.
-- Idempotent: hoppar över rader där org.nr redan finns (jämförs utan bindestreck/mellanslag).
-- Ingen UE får mail eller notis: bara INSERT i subcontractors (inga triggrar skickar något).
WITH src (company_name, org_number, phone, address, trade, team_size, pipeline_status, priority, notes) AS (VALUES
  ($q$Tak Compagniet Sverige AB$q$, $q$556546-2842$q$, $q$08-667 07 20$q$, $q$Stockholm$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 100::int, $q$Z2 prio2. 2 anst, 17,7 Mkr (2024). Sedan 1983, >5 miljoner m² tak. UE-signal/NAV: arbetar genom ett nätverk av fältarbetare i hela Sverige, så de kan ha lag som har luckor.$q$),
  ($q$Takläggarna i Mälardalen AB$q$, $q$556845-7542$q$, NULL, $q$Strängnäs$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 101::int, $q$Z4 prio2. NAV, inte UE: ca 30 egna yrkesarbetare + egna UE, B2B. Fråga om tips på lag eller delade lag. Moderbolag till TLMTAK (prio 40).$q$),
  ($q$EDSW Tak AB$q$, $q$559447-3984$q$, NULL, $q$Sigtuna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 102::int, $q$Z1 prio2. 2 anst, 11,5 Mkr. Pannor, plåt, papp, tätskikt + sol. Bolaget från 2023.$q$),
  ($q$Takrenoverarna i Stockholm AB$q$, $q$556796-7558$q$, $q$08-767 61 20$q$, $q$Lidingö$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 103::int, $q$Z1 prio2. 2 anst, 20,2 Mkr. Renovering och nya tak åt privat, BRF och företag sedan 2009.$q$),
  ($q$Tureberg Tak AB$q$, $q$559244-8137$q$, NULL, $q$Sollentuna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 104::int, $q$Z1 prio2. 1 anst, 18,5 Mkr (2023, -51 %). Säljer takarbeten och konsultar, så de använder troligen själva UE. Möjligt nav.$q$),
  ($q$PR Tak Renovering AB$q$, $q$559403-1980$q$, $q$08-36 45 80$q$, $q$Sollentuna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 105::int, $q$Z1 prio2. 12 anst, 18,8 Mkr. VARNING: säljer takrenovering direkt till konsument.$q$),
  ($q$SAO Tak & Entreprenad AB$q$, $q$556903-9190$q$, $q$08-13 74 22$q$, $q$Knivsta$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 106::int, $q$Z1 prio2. 9 anst. Tak, isolering, tätskikt, asfalt. Stark ekonomi, mer tätskikt än pannor.$q$),
  ($q$Vallentuna Tak & Pool AB$q$, $q$556255-9855$q$, NULL, $q$Vallentuna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 107::int, $q$Z1 prio2. 6 anst, 10,5 Mkr. Tak + pool.$q$),
  ($q$Projektbygg i Österåker AB$q$, $q$559067-0195$q$, NULL, $q$Åkersberga$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 108::int, $q$Z1 prio2. 8 anst, 25 Mkr. Allmänt bygg + tak (ej plåt).$q$),
  ($q$MB Hantverkstjänst AB$q$, $q$556874-4584$q$, NULL, $q$Rosersberg$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 109::int, $q$Z1 prio2. 5 anst. Brett hantverk: tak, plåt, snickeri, el.$q$),
  ($q$Brinkens Plåtslageri AB$q$, $q$556142-2121$q$, $q$08-18 31 20$q$, $q$Täby$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 110::int, $q$Z1 prio2. 4 anst, 17,8 Mkr. Takbyten i alla material sedan 1966. VARNING: säljer själv till privat och BRF.$q$),
  ($q$Stolpes Entreprenad AB$q$, $q$556798-5824$q$, NULL, $q$Vallentuna$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 111::int, $q$Z1 prio2. 9 anst. Plåt, tak, mark, solel.$q$),
  ($q$Lindbergs Tak & Plåtslageri AB$q$, $q$559346-8738$q$, NULL, $q$Knivsta$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 112::int, $q$Z1 prio2. 3 anst, 6,4 Mkr, hög marginal. Tak och plåt.$q$),
  ($q$BauBygg & Plåtslageri AB$q$, $q$559005-4556$q$, NULL, $q$Upplands Väsby$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 113::int, $q$Z1 prio2. 2 anst, 8,6 Mkr. Tak, plåt, fasad, egen tillverkning av plåtdetaljer. Medlem i Plåt & Ventföretagen.$q$),
  ($q$Jonas Lindgren Plåtslageri AB$q$, $q$559091-8800$q$, NULL, $q$Norrtälje$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 114::int, $q$Z1 prio2. Enmansbolag, 1,3 Mkr. Pannor, plåt, papp. Lokalt men liten kapacitet.$q$),
  ($q$Svealand Takservice AB$q$, $q$559235-4962$q$, $q$08-18 09 70$q$, $q$Järfälla$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 120::int, $q$Z2 prio2. 1–4 anst. Pannor, plåt, papp. Topplacerad på Reco. VARNING: säljer själv.$q$),
  ($q$Svenska Kvalitets Tak AB$q$, $q$559086-3220$q$, NULL, $q$Vällingby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 121::int, $q$Z2 prio2. 2 anst, 2,8 Mkr. Takläggning och renovering + sol. Litet lag som behöver beläggning.$q$),
  ($q$Takdax Bygg AB$q$, $q$556943-2684$q$, $q$08-771 90 22$q$, $q$Solna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 122::int, $q$Z2 prio2. 1 anst, 8,4 Mkr (2025, vinst). Takbyten, pannor, plåt, tätskikt.$q$),
  ($q$MG Tak & Bygg AB$q$, $q$559104-9894$q$, $q$08-735 55 66$q$, $q$Bromma$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 123::int, $q$Z2 prio2. 2 anst, 7,0 Mkr. Tak, plåt, fasad. Tar ett projekt i taget.$q$),
  ($q$Svea tak i Stockholm AB$q$, $q$559454-7811$q$, $q$010-555 88 48$q$, $q$Saltsjö-Boo$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 124::int, $q$Z2 prio2. 1 anst, 5,0 Mkr (2024). Familjeföretag från 2023, takbyten i Storstockholm.$q$),
  ($q$Nytt tak i Sthlm AB$q$, $q$559057-4389$q$, NULL, $q$Hässelby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 125::int, $q$Z2 prio2. 3 anst. Pannor, plåt, papp. VARNING: marknadsför sig även i Norrtälje.$q$),
  ($q$AAA Tak & Bygg AB$q$, $q$559370-9123$q$, NULL, $q$Hässelby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 126::int, $q$Z2 prio2. 2 anst, 7,0 Mkr. Takläggning, mest papp och taksäkerhet.$q$),
  ($q$Enskede Tak AB$q$, $q$559121-7798$q$, NULL, $q$Stockholm$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 127::int, $q$Z2 prio2. 2 anst, 7,7 Mkr (2024, vinst). Mest papp, även plåt och tätskikt.$q$),
  ($q$AB Takentreprenören JC$q$, $q$559252-9282$q$, NULL, $q$Spånga$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 128::int, $q$Z2 prio2. 7 anst, 25 Mkr. Takvård, taktvätt, takbyten. VARNING: säljer själv.$q$),
  ($q$Svevitak och Bygg AB$q$, $q$559125-1532$q$, NULL, $q$Bromma$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 129::int, $q$Z2 prio2. 31,6 Mkr (+172 % sedan 2021). Brett bygg + tak + sol. VARNING: säljer själv.$q$),
  ($q$Nordic Builders G&B AB$q$, $q$559304-3531$q$, NULL, $q$Saltsjö-Boo$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 130::int, $q$Z2 prio2. 9 anst. Brett bygg inkl. tak. Kontrollera hur stor del som är tak.$q$),
  ($q$Takfokus Sverige AB$q$, $q$556799-9932$q$, $q$08-31 28 28$q$, $q$Bromma$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 131::int, $q$Z2 prio2. 10 anst, 25 Mkr. Bara papp (ca 150 000 m²/år). UE-signal: kunderna är till stor del byggföretag.$q$),
  ($q$Konsar Entreprenad AB$q$, $q$559022-3821$q$, NULL, $q$Solna$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 132::int, $q$Z2 prio2. 5 anst, 23,6 Mkr. Takbyten villa. VARNING: betalningsanmärkning 2025, gör kreditkontroll.$q$),
  ($q$Älvsjö Tak AB$q$, $q$556833-6290$q$, $q$08-18 90 02$q$, $q$Stockholm$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 133::int, $q$Z2 prio2. 9 anst, 27 Mkr. Egen plåtverkstad. VARNING: säljer själv.$q$),
  ($q$TAK&PLÅT AT AB$q$, $q$559491-9176$q$, NULL, $q$Spånga$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 134::int, $q$Z2 prio2. 9 anst, 14,9 Mkr. Ingen webbsida hittad, kontrollera på allabolag.$q$),
  ($q$TB Tak Entreprenad AB$q$, $q$559381-6811$q$, NULL, $q$Hägersten$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 140::int, $q$Z3 prio2. 7 anst, 5 Mkr. Brett bygg + takrenovering (bl.a. papp).$q$),
  ($q$Takteamet i Stockholm AB$q$, $q$556837-7328$q$, NULL, $q$Västerhaninge$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 141::int, $q$Z3 prio2. Litet och grundardrivet sedan 2007.$q$),
  ($q$Proffstak Trio AB$q$, $q$559471-2100$q$, NULL, $q$Södertälje$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 142::int, $q$Z3 prio2. 8 anst. Papp, duk, shingel. Kunder även byggare och fastighetsägare.$q$),
  ($q$Takjour Entreprenad i Mälardalen AB$q$, $q$559045-3600$q$, $q$08-428 711 74$q$, $q$Årsta$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 143::int, $q$Z3 prio2. 7,4 Mkr, 0 registrerade anställda, så de använder troligen själva UE. Möjligt nav.$q$),
  ($q$Flygheds Tak AB$q$, $q$559184-5945$q$, NULL, $q$Hägersten$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 144::int, $q$Z3 prio2. 7 anst, 29 Mkr. Starkt eget varumärke. VARNING: säljer själv.$q$),
  ($q$DA Montage & Byggentreprenad AB$q$, $q$559172-7721$q$, NULL, $q$Nynäshamn$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 145::int, $q$Z3 prio2. 11 anst, 19 Mkr. Brett bygg, plåttak, repklättring.$q$),
  ($q$Dalarö Plåt och Tak AB$q$, $q$559458-9268$q$, NULL, $q$Dalarö$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 146::int, $q$Z3 prio2. 6 anst, bolaget från 2023. Tak, plåt, papp.$q$),
  ($q$Kembel Tak och Fasad plåtslageri AB$q$, $q$559048-4282$q$, NULL, $q$Tyresö$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 147::int, $q$Z3 prio2. 6 anst, 13,8 Mkr (2025, vinst). Plåt, fasad, tak.$q$),
  ($q$Haninge Tak & Plåt AB$q$, $q$556567-0402$q$, $q$08-500 126 30$q$, $q$Jordbro$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 148::int, $q$Z3 prio2. 15 anst. Tätskikt + egen plåtverkstad.$q$),
  ($q$Mälardalens Takentreprenad AB$q$, $q$559350-0514$q$, NULL, $q$Västerås$q$, $q$bada$q$, NULL::int, $q$hittad$q$, 160::int, $q$Z4 prio2. 3 anst. Tegel och plåt. VARNING: säljer själv.$q$),
  ($q$Backströms Tak AB$q$, $q$559257-3629$q$, NULL, $q$Västerås$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 161::int, $q$Z4 prio2. 4 anst. Säljer tak och takrenovering.$q$),
  ($q$Svetak Svealandstak AB$q$, $q$556738-5314$q$, $q$021-81 10 00$q$, $q$Västerås$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 162::int, $q$Z4 prio2. 13 anst. Tätskikt/papp i hela Mälardalen, B2B.$q$),
  ($q$Sandin Tak AB$q$, $q$556314-0994$q$, NULL, $q$Heby$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 163::int, $q$Z4 prio2. 8 anst. Auktoriserat av BMI Icopal, mest tätskikt. Medlem i Sveriges Takentreprenörer.$q$),
  ($q$Uppsala Tak & Tätskikt AB$q$, $q$559253-3516$q$, NULL, $q$Uppsala$q$, $q$taklaggare$q$, NULL::int, $q$hittad$q$, 164::int, $q$Z4 prio2. 1 anst.$q$),
  ($q$Larssons Plåt Lidingö AB$q$, $q$556803-6346$q$, NULL, $q$Lidingö$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 200::int, $q$Z1 prio2. 8 anst. Plåtverkstad, även båtar.$q$),
  ($q$Forsbergs Plåtslageri i Östhammar AB$q$, $q$556530-7930$q$, NULL, $q$Östhammar$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 201::int, $q$Z1 prio2. 5 anst. Familjeföretag sedan 1965, även kompletta takbyten.$q$),
  ($q$H&M Lundgrens Plåtslageri AB$q$, $q$556308-3145$q$, $q$0174-102 45$q$, $q$Alunda$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 202::int, $q$Z1 prio2. 3 anst. Plåttak, Uppsala och Östhammar.$q$),
  ($q$Plåtslagargruppen i Stockholm City AB$q$, $q$556856-0204$q$, $q$08-630 00 00$q$, $q$Stockholm$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 210::int, $q$Z2 prio2. 9 anst, 14,6 Mkr. Medlem i Plåt & Ventföretagen.$q$),
  ($q$Top Plåtslageri Stockholm AB$q$, $q$559229-0745$q$, NULL, $q$Järfälla$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 211::int, $q$Z2 prio2. 5 anst, 11,6 Mkr. Rännor, stuprör, plåttak.$q$),
  ($q$Ternvalls Plåtslageri AB$q$, $q$556445-3685$q$, $q$08-564 409 90$q$, $q$Järfälla$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 212::int, $q$Z2 prio2. 15 anst, 43,8 Mkr. Familjeföretag.$q$),
  ($q$Kronans tak & fasad Plåtslageri AB$q$, $q$556999-8510$q$, $q$08-410 337 30$q$, $q$Saltsjö-Boo$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 213::int, $q$Z2 prio2. 8 anst. Tak- och fasadplåt.$q$),
  ($q$P & B Plåtslageri AB$q$, $q$556312-0574$q$, NULL, $q$Saltsjö-Boo$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 214::int, $q$Z2 prio2. 8 anst. Sedan 1987.$q$),
  ($q$Norrmalms Plåtslageri i Stockholm AB$q$, $q$556961-4869$q$, NULL, $q$Saltsjö-Boo$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 215::int, $q$Z2 prio2. Auktoriserat byggnadsplåtslageri.$q$),
  ($q$Birka Plåtslageri Produktion AB$q$, $q$556986-0439$q$, NULL, $q$Saltsjö-Boo$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 216::int, $q$Z2 prio2. 7 anst, 7,5 Mkr.$q$),
  ($q$RMM Byggplåt Lars Rosendahl AB$q$, $q$556039-4685$q$, NULL, $q$Järfälla$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 217::int, $q$Z2 prio2. 10 anst. Plåt + snickeri. Samma koncern som RMM-Takteknik AB (559503-8752), så ett samtal räcker.$q$),
  ($q$A.W. Jonaeson Bleck & Plåtslageri AB$q$, $q$556066-6389$q$, NULL, $q$Stockholm$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 218::int, $q$Z2 prio2. 12 anst, 26,8 Mkr. Etablerat, troligen dyrt.$q$),
  ($q$Westerlunds Tak & Fasad AB$q$, $q$556484-9452$q$, NULL, $q$Jordbro$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 220::int, $q$Z3 prio2. 4 anst. UE-signal: kunderna är bl.a. byggföretag och fastighetsförvaltare.$q$),
  ($q$Tak och Plåtgruppen i Stockholm AB$q$, $q$559026-8180$q$, NULL, $q$Skarpnäck$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 221::int, $q$Z3 prio2. 4 anst, 9,5 Mkr, vinst.$q$),
  ($q$Tik Tak på Södertörn AB$q$, $q$559298-0386$q$, NULL, $q$Grödinge$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 222::int, $q$Z3 prio2. 6 anst. Plåttak, egen verkstad.$q$),
  ($q$DP Plåt & Bygg AB$q$, $q$559244-3559$q$, NULL, $q$Skogås$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 223::int, $q$Z3 prio2. Två plåtslagare. Auktoriserat.$q$),
  ($q$AB GMS Plåtslageri$q$, $q$559007-5874$q$, $q$08-647 80 97$q$, $q$Jordbro$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 224::int, $q$Z3 prio2. 10 anst. Byggnadsplåt åt privat, BRF och företag.$q$),
  ($q$Takspecialisten Holms AB$q$, $q$556710-2396$q$, NULL, $q$Västerås$q$, $q$platslagare$q$, NULL::int, $q$hittad$q$, 230::int, $q$Z4 prio2. 5 anst, 11,3 Mkr, hög vinst.$q$)
), ins AS (
  INSERT INTO public.subcontractors (company_name, org_number, phone, address, trade, team_size, pipeline_status, priority, notes)
  SELECT s.company_name, s.org_number, s.phone, s.address, s.trade, s.team_size, s.pipeline_status, COALESCE(s.priority, 100), s.notes
  FROM src s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.subcontractors e
    WHERE regexp_replace(COALESCE(e.org_number, ''), '\D', '', 'g') = regexp_replace(COALESCE(s.org_number, ''), '\D', '', 'g')
      AND regexp_replace(COALESCE(s.org_number, ''), '\D', '', 'g') <> ''
  )
  RETURNING id
)
SELECT (SELECT count(*) FROM ins) AS importerade, (SELECT count(*) FROM src) AS i_filen;
