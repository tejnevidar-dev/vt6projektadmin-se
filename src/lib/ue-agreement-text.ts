// Ramavtal för underentreprenad (VT6 Invest AB) – textkälla för den digitala signeringen.
// Källa: ledning/ue/avtal/01-ramavtal-ue-sv.md (Agent – Jurist, version 2.0, 2026-09-27).
// Håll UE_AGREEMENT_VERSION/UE_AGREEMENT_DATE i synk med den filens versionsrad manuellt när
// källtexten ändras – ingen automatisk läsning av ledning/ i produktion (fel repo-mapp/runtime).
//
// {{TOKEN}}-platshållare fylls i per underentreprenör av fillUeAgreement(). Kvarvarande
// "[...]"-platshållare (t.ex. "[BESLUT: 1 500]", VT6:s postadress) är INTE UE-specifika utan
// obeslutade affärsvillkor – de ska aldrig fyllas i här. hasUnresolvedPlaceholders() upptäcker
// dem så att ett avtal aldrig kan skickas till en riktig UE innan Vidar beslutat dem.

export const UE_AGREEMENT_VERSION = "2.0";
export const UE_AGREEMENT_DATE = "2026-09-27";
export const UE_AGREEMENT_SOURCE = "ledning/ue/avtal/01-ramavtal-ue-sv.md";

export interface UeAgreementFields {
  companyName: string;
  orgNumber: string | null;
  country: string;
  address: string | null;
  vatNumber: string | null;
}

const RAW_SV = `# RAMAVTAL FÖR UNDERENTREPRENAD – VT6 Invest AB

## Parter
**Beställare:** VT6 Invest AB, org.nr 559539-3595, [postadress – BESLUT/fakta från Vidar], nedan "VT6".
**Underentreprenör:** {{FIRMA}}, org.nr/reg.nr {{ORGNR}}, {{LAND}}, {{ADRESS}}, momsreg.nr {{MOMSNR}}, nedan "UE".

## 1. Omfattning och handlingarnas ordning
1.1 Detta ramavtal reglerar de uppdrag som VT6 erbjuder UE genom arbetsorder och som UE accepterar. Ramavtalet ger ingen rätt till någon viss volym, och ingen skyldighet för UE att acceptera en viss arbetsorder.
1.2 Uppdragen avser takbyten och tillhörande plåtarbeten på bostadshus, främst villor, i Stockholms, Uppsala, Västmanlands och Södermanlands län.
1.3 Vid motstrid gäller handlingarna i denna ordning:
  1. den accepterade arbetsordern, dock bara i fråga om objektsspecifika uppgifter (adress, omfattning, pris, prisberäkning, tider, material och leveranser, BAS-P/BAS-U, vite och betalningsuppgifter). Avviker arbetsordern i övrigt från ramavtalet gäller avvikelsen bara om arbetsordern uttryckligen anger vilken punkt i ramavtalet som ändras
  2. detta ramavtal
  3. Bilaga 5 (betalning och dokumentkrav)
  4. Bilaga 1 (prislista för arbete)
  5. Bilagorna 2, 3, 4 och 6
  6. AB-U 07
  7. AB 04
1.4 AB-U 07 och AB 04 gäller bara i frågor som inte regleras i handlingarna 1–5. Följande gäller inte, eftersom avtalet reglerar frågan på annat sätt: bestämmelserna om besiktning i AB 04 kap. 7 (ersätts av punkt 6), bestämmelserna om garanti- och ansvarstid (ersätts av punkt 6.3) och bestämmelserna om tvistlösning i AB 04 kap. 9 (ersätts av punkt 13).

## 2. Arbetsorder och accept
2.1 Varje uppdrag beskrivs i en arbetsorder som minst anger: arbetsordernummer, adress, omfattning (m², taktyp, moment), foton och protokoll från takkontrollen, material som VT6 levererar, container och ställning, start- och slutdatum, UE:s fasta pris för endast arbete med prisberäkning, kontaktperson hos VT6, BAS-P/BAS-U och en hänvisning till detta ramavtal.
2.2 UE accepterar eller avböjer arbetsordern digitalt i VT6:s system inom den svarstid som arbetsordern anger. Utan svar räknas arbetsordern som avböjd.
2.3 Accepten är bindande. Den gör arbetsordern till ett avtal mellan parterna, med arbetsorderns fasta pris och tider, på villkoren i detta ramavtal. Den som accepterar för UE:s räkning ska vara behörig att företräda UE. UE ansvarar för att så är fallet.
2.4 Vid accepten anger UE vilka personer som ska arbeta på plats och om var och en är anställd hos UE eller egen företagare med F-skatt. UE intygar att uppgifterna är riktiga och meddelar VT6 före varje ändring.
2.5 UE har innan accepten tagit del av arbetsorderns underlag. Det fasta priset omfattar allt arbete som behövs för ett fackmässigt färdigt resultat inom arbetsorderns omfattning. Det som inte kunde upptäckas i underlaget eller vid en rimlig kontroll på plats hanteras som ÄTA enligt Bilaga 4.

## 3. Pris – endast arbete
3.1 UE får ett fast pris för endast arbete enligt arbetsordern, beräknat enligt Bilaga 1.
3.2 VT6 står för och bekostar material, container och ställning. Dessa ingår aldrig i UE:s pris. UE får inte fakturera dem eller köpa in dem för VT6:s räkning utan skriftlig beställning.
3.3 UE står för egna verktyg, maskiner, personlig skyddsutrustning och personligt fallskydd, samt resor, logi och traktamente för sin personal.
3.4 Ändrings- och tilläggsarbeten (ÄTA) ersätts bara enligt Bilaga 4, alltså bara efter skriftligt förhandsgodkännande i VT6:s system. Undantaget för akuta åtgärder i Bilaga 4 punkt 4 gäller.

## 4. Utförande och kvalitet
4.1 Arbetet utförs fackmässigt enligt tillverkarens monteringsanvisningar, AMA Hus i tillämpliga delar och Boverkets byggregler.
4.2 Ordning och säkerhet enligt Bilaga 2, bland annat att taket ska vara tätt vid varje arbetsdags slut och att fallskydd alltid används.
4.3 Egenkontroll och foton enligt Bilaga 3. Uppdraget räknas inte som färdigställt förrän egenkontroll och foton är inlämnade i VT6:s system.
4.4 UE får inte anlita egna underentreprenörer eller inhyrd personal utan VT6:s skriftliga medgivande i förväg. Ett medgivande befriar inte UE från ansvar enligt detta avtal, och UE ska se till att samma krav (punkt 8) gäller i hela UE:s led.
4.5 Endast de personer som anmälts enligt 2.4 får arbeta på plats.

## 5. Tider och vite
5.1 UE startar och färdigställer enligt arbetsorderns datum.
5.2 Vid försening som UE orsakat betalar UE vite med [BESLUT: 1 500] kr per påbörjad arbetsdag, dock högst [BESLUT: 10] % av arbetsorderns pris. Väder som gör arbetet olämpligt eller osäkert räknas inte som UE:s försening, om UE meddelar VT6 samma dag och taket hålls tätt.
5.3 UE har rätt till skälig förlängning av tiden om förseningen beror på VT6 (till exempel sen leverans av material, container eller ställning), på slutkunden eller på väder enligt 5.2. UE ska begära förlängning skriftligt i VT6:s system utan dröjsmål, annars förloras rätten.
5.4 Vitet är VT6:s ersättning för själva förseningen. Häver VT6 arbetsordern på grund av försening (12.3) har VT6 dessutom rätt till ersättning enligt 12.4.

## 6. Kontroll, fel och garanti
6.1 VT6 gör slutkontroll och får göra kontroller under arbetet. Slutkontrollen dokumenteras i VT6:s system. Den är godkänd när VT6 har markerat den som godkänd där. Är fel anmärkta, räknas slutkontrollen som godkänd först när felen är åtgärdade och VT6 har godkänt åtgärden.
6.2 Fel som anmärks vid kontroll åtgärdar UE utan kostnad inom 5 arbetsdagar, eller omedelbart om felet innebär risk för läckage, skada eller olycka.
6.3 Garanti: UE ansvarar för fel i sitt utförande som visar sig inom 10 år från godkänd slutkontroll. UE är fri från ansvar bara om UE visar att felet beror på material som VT6 tillhandahållit (och som UE inte borde ha upptäckt var felaktigt), på VT6:s föreskrifter, på onormal användning eller på en yttre händelse som UE inte ansvarar för.
6.4 VT6 ska meddela UE fel inom skälig tid efter att VT6 fått kännedom om dem. Ett meddelande inom två månader räknas alltid som i rätt tid.
6.5 Åtgärdar UE inte ett fel i tid får VT6 låta någon annan åtgärda det på UE:s bekostnad och kvitta kostnaden mot UE:s fordringar.
6.6 UE ersätter VT6 för de kostnader, prisavdrag och skadestånd som VT6 blir skyldig slutkunden på grund av fel eller försening som UE ansvarar för, dock med avräkning av vite som betalats för samma försening.
6.7 Punkt 6.3–6.6 gäller även efter att ramavtalet har upphört.

## 7. Betalning och säkerhet
7.1 Betalningsvillkor, innehållen betalning, lönebevis och dokumentkrav enligt Bilaga 5.
7.2 Omvänd betalningsskyldighet för byggtjänster: UE fakturerar utan moms med hänvisning till omvänd betalningsskyldighet och anger båda parters momsregistreringsnummer.
7.3 Säkerhet: VT6 får, innan en arbetsorder erbjuds, kräva bankgaranti eller moderbolagsborgen, på ett belopp som anges i arbetsordern, om UE saknar verksamhetshistorik i Sverige eller om arbetsordrarnas sammanlagda pris överstiger [BESLUT: 300 000] kr.
7.4 VT6 får kvitta alla fordringar som VT6 har på UE enligt detta avtal eller en arbetsorder (bland annat vite, felavhjälpning, skador och belopp enligt 8.6) mot allt som VT6 är skyldig UE, inklusive innehållen betalning och betalningar för andra arbetsorder.

## 8. UE:s skyldigheter avseende personal, skatter och löner
8.1 UE ska under hela avtalstiden:
  - vara godkänd för F-skatt i Sverige, registrerad för moms och registrerad som arbetsgivare i Sverige när UE har anställda som arbetar här
  - ha ansvarsförsäkring med minst [BESLUT: 5] Mkr per skada som gäller för entreprenadarbete i Sverige, och meddela VT6 omedelbart om försäkringen sägs upp, upphör eller ändras
  - se till att all personal har giltigt ID06 kopplat till UE och utbildning för arbete på höjd
  - sakna skulder hos Kronofogden över [BESLUT: 0] kr och sakna förfallna skulder hos Skatteverket
8.2 Utstationering: har UE säte utomlands och arbetar dess anställda tillfälligt i Sverige, ska UE:
  - anmäla utstationeringen till Arbetsmiljöverket och lämna VT6 en kopia av anmälan senast arbetsdagen före arbetets början
  - utse en kontaktperson i Sverige enligt utstationeringsreglerna
  - lämna A1-intyg för varje utstationerad person innan personen börjar arbeta
  - tillämpa de arbets- och anställningsvillkor som gäller för utstationerade arbetstagare i Sverige.
  Utan kopia av anmälan och A1-intyg får arbetet inte påbörjas. En försening som detta orsakar räknas som UE:s försening.
8.3 Löner, skatter och avgifter. UE betalar i rätt tid all lön och ersättning som UE:s anställda har rätt till enligt anställningsavtal, tillämpligt kollektivavtal och lag, och redovisar och betalar skatteavdrag och arbetsgivaravgifter. UE garanterar att ingen person som har arbetat i ett uppdrag åt VT6 har en förfallen, obetald lönefordran mot UE.
8.4 Personalstatus. Den som arbetar på plats som egen företagare ska ha egen F-skatt, eget skriftligt avtal med UE och vara självständig i praktiken (egna verktyg, egen företagsrisk och egen arbetsledning i sitt uppdrag). Om en sådan person ändå bedöms som anställd, bär UE alla följder av detta.
8.5 Bevis på betalda löner lämnas enligt Bilaga 5, före varje utbetalning och varje månad.
8.6 Regress och skadeslöshet. Krävs VT6 på, eller betalar VT6, lön, skatt eller avgift som avser UE:s personal eller personal i UE:s led, oavsett grund (bland annat lag (2018:1472) om entreprenörsansvar för lönefordringar), ska UE ersätta VT6 fullt ut, inklusive skäliga kostnader för utredning och juridisk hjälp. VT6 får kvitta beloppet enligt 7.4.
8.7 Underrättelse om obetald lön. Får VT6 en underrättelse om obetald lön från någon som arbetat i ett uppdrag, ska UE inom 2 arbetsdagar från VT6:s begäran visa att lönen är betald, eller skriftligt redovisa varför kravet bestrids. Visar UE inte detta får VT6 betala arbetstagaren direkt och kvitta beloppet enligt 7.4.
8.8 Brott mot 8.1–8.5 och 8.7 är väsentliga avtalsbrott (se 12.2).

## 9. Arbetsmiljö
9.1 UE ansvarar för arbetsmiljön för sin personal som arbetsgivare och följer arbetsmiljölagen och Arbetsmiljöverkets föreskrifter.
9.2 Byggarbetsmiljösamordnare för planering (BAS-P) och för utförande (BAS-U) anges i arbetsordern. [BESLUT: BAS-P = VT6; BAS-U = UE:s arbetsledare, om han eller hon har dokumenterad BAS-U-utbildning, annars VT6]. Den som är BAS-U har befogenhet att samordna arbetet på plats. UE följer arbetsmiljöplanen och samordnarens anvisningar.
9.3 UE följer reglerna om personalliggare när VT6 meddelar att sådan ska föras på arbetsplatsen, och registrerar all personal med ID06.

## 10. Kundkontakt, sekretess och personuppgifter (se även Bilaga 6)
10.1 All kontakt med slutkunden om pris, tillägg, extraarbeten, tider och reklamationer sker via VT6 och VT6:s säljare/projektledare. UE hänvisar kunden dit.
10.2 UE får aldrig offerera, sälja eller utföra arbete direkt åt en kund som UE har fått kontakt med genom VT6, eller ta emot betalning från kunden. Det gäller under avtalstiden och 12 månader efter det senast utförda uppdraget hos den kunden, om inte VT6 skriftligt medger något annat. Vid brott betalar UE vite med [BESLUT: 25 000] kr per kund, och ersätter dessutom VT6:s skada till den del den överstiger vitet.
10.3 UE behandlar personuppgifter om slutkunden bara för VT6:s räkning och enligt personuppgiftsbiträdesvillkoren i Bilaga 6.
10.4 UE får inte använda bilder eller uppgifter från uppdragen i egen marknadsföring utan VT6:s skriftliga medgivande.
10.5 Sekretessen enligt Bilaga 6 gäller under avtalstiden och 3 år därefter.

## 11. Ansvar för skada och försäkring
11.1 UE ansvarar för skador som UE, dess personal eller någon i UE:s led orsakar på slutkundens egendom, på tredje man eller på VT6:s material och egendom. Detta gäller även vattenskador som uppstår för att taket inte hållits tätt enligt Bilaga 2 punkt 1. UE:s ansvar är inte begränsat till försäkringsbeloppet. Begränsningar av skadeståndsansvaret i AB 04 och AB-U 07 gäller inte för sådana skador.
11.2 UE anmäler skador till VT6 samma dag, och till sitt försäkringsbolag.
11.3 Ingen part ansvarar för den andra partens uteblivna vinst eller andra indirekta förluster, utom vid uppsåt eller grov vårdslöshet. Ersättning som VT6 betalar till slutkunden enligt 6.6 och 11.1 räknas inte som indirekt förlust.

## 12. Avtalstid, uppsägning och hävning
12.1 Avtalet gäller från undertecknandet tills vidare, med 1 månads ömsesidig uppsägningstid. Accepterade arbetsorder slutförs på avtalets villkor.
12.2 VT6 får säga upp ramavtalet med omedelbar verkan vid väsentligt avtalsbrott, bland annat vid:
  - återkallad F-skatt eller upphörd försäkring
  - obetald lön, skatt eller avgift, eller oriktiga lönebevis eller personaluppgifter
  - brott mot kundkontaktregeln (10.1–10.2)
  - upprepade eller allvarliga brister i kvalitet eller säkerhet
  - att UE försätts i konkurs, inleder ackord, går i likvidation eller annars kan antas ha kommit på obestånd.
12.3 I samma fall, och vid väsentlig försening, får VT6 häva en pågående arbetsorder med omedelbar verkan.
12.4 Vid hävning enligt 12.3 får UE betalt bara för det arbete som är fackmässigt utfört, enligt arbetsorderns prisberäkning. VT6 får låta någon annan slutföra arbetet och kvitta de merkostnader som uppstår.
12.5 Avbeställning: avbeställer slutkunden, eller blir uppdraget omöjligt av skäl som UE inte ansvarar för, får VT6 avbeställa arbetsordern. UE får då betalt för utfört arbete enligt prisberäkningen och för styrkta, nödvändiga kostnader som inte kan undvikas, men ingen ersättning för utebliven vinst.
12.6 UE får säga upp ramavtalet och häva en pågående arbetsorder om VT6 inte betalar ett ostridigt och förfallet belopp inom 15 dagar efter skriftlig påminnelse.

## 13. Tvist och tillämplig lag
Svensk lag gäller. Tvist avgörs av allmän domstol, med Stockholms tingsrätt som första instans.

## 14. Språk, ändringar och meddelanden
14.1 Avtalet upprättas på svenska. En engelsk översättning bifogas som hjälp. Vid avvikelse gäller den svenska texten. UE bekräftar genom sin underskrift att UE förstår avtalets innehåll.
14.2 Ändringar i ramavtalet görs skriftligt och undertecknas av båda parter. Arbetsorder, ÄTA och godkännanden i VT6:s system räknas som skriftliga.
14.3 Meddelanden skickas till den e-postadress som respektive part anger i VT6:s system.
14.4 UE får inte överlåta avtalet eller sina fordringar enligt avtalet utan VT6:s skriftliga medgivande.

## Bilagor
1. Prislista – endast arbete
2. Ordning och säkerhet på arbetsplatsen
3. Egenkontroll och fotokrav
4. ÄTA-rutin
5. Betalningsvillkor och dokumentkrav
6. Sekretess, kundkontakt och personuppgiftsbiträde`;

export const UE_AGREEMENT_BODY_SV = RAW_SV;

/** Ersätter {{TOKEN}}-platshållarna med UE:ns egna uppgifter. Rör aldrig "[...]"-texter. */
export function fillUeAgreement(fields: UeAgreementFields): string {
  return RAW_SV
    .replaceAll("{{FIRMA}}", fields.companyName)
    .replaceAll("{{ORGNR}}", fields.orgNumber || "[ej angivet]")
    .replaceAll("{{LAND}}", fields.country || "Sverige")
    .replaceAll("{{ADRESS}}", fields.address || "[ej angivet]")
    .replaceAll("{{MOMSNR}}", fields.vatNumber || fields.orgNumber || "[ej angivet]");
}

/**
 * Sant om texten fortfarande innehåller obeslutade affärsvillkor eller VT6-uppgifter
 * ("[BESLUT: ...]", VT6:s postadress m.fl.) – allt som är kvar inom hakparenteser efter att
 * fillUeAgreement() fyllt i UE:ns egna fältplatshållare. Så länge detta är sant får avtalet
 * ALDRIG skickas till en riktig UE (krävs av ledning/ue/avtal/01-ramavtal-ue-sv.md:s egen
 * statusrad: "INTE klart att signera").
 */
export function hasUnresolvedPlaceholders(filledText: string): boolean {
  return /\[[^\]]*\]/.test(filledText);
}
