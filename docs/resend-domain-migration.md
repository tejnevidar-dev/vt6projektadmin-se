# Mailavsändaren notify.vt6projektadmin.se: kontroll och flytt vid behov

Skrivskyddad kontroll 2026-09-27 (DNS-uppslag; inget ändrat i prod). Gäller CRM och utbildning, som båda skickar via Resend-SDK:t med
Worker-secreten `RESEND_API_KEY`, avsändare `notify.vt6projektadmin.se`.

## Vad DNS visar (domänen vt6projektadmin.se ligger hos Simply, ns1-3.simply.com, alltså vår egen DNS)
| Post | Värde (förkortat) | Vem styr det |
|---|---|---|
| `resend._domainkey.notify` TXT | DKIM-publik nyckel (`p=MIGf...`) | Resend-kontot som domänen är verifierad i |
| `send.notify` | CNAME till `send.forge.rmta.net` (MX feedback.forge.rmta.net, SPF `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all`) | **Lovable** (return-path och SPF ligger hos deras `forge.rmta.net`) |
| `_dmarc` (vt6projektadmin.se) TXT | `v=DMARC1; p=none; pct=100; rua=mailto:dmarcreports@lovable.dev` | Rapporterna går till **Lovable** |
| `_dmarc.notify` | finns inte | ärver rotens policy |

## Slutsats
- Utskick fungerar i dag: email_send_log visar `sent` för lead-alert och signeringsmail så sent som 2026-09-25.
- Två av tre delar hör till Lovable: return-path/SPF (`send.notify` -> `forge.rmta.net`) och DMARC-rapporterna. När Lovable avslutas kan
  `forge.rmta.net`-posten sluta gälla. Då faller SPF och studsar (bounce) för domänen. DKIM (`resend._domainkey.notify`) klarar DMARC så länge
  Resend-kontot bakom `RESEND_API_KEY` är vårt, men det är okänt vems konto det är (den nyckel som ligger i `crm/.env` är ogiltig, och
  Worker-secretens ägare kan jag inte läsa).
- Osäkert utan Resend-inloggning: vilket Resend-konto äger domänen. Om det är ett Lovable-hanterat konto kan nyckeln sluta fungera helt.

## 1. Verifiera (Vidar, 5 minuter, Resend-inloggning)
1. Logga in på resend.com med kontot som skapade nyckeln för Workern (om du inte vet: testa tejnevidar@gmail.com och vidar@roslagstak.se).
2. Domains: står `notify.vt6projektadmin.se` som **Verified** (DKIM, SPF, MX)? Notera vilka poster Resend själv visar för domänen.
3. API Keys: finns nyckeln för Workern där (namn, senast använd)?
Svar A: domänen finns och är verifierad i vårt konto: gå till steg 3 (bara return-path/DMARC behöver städas).
Svar B: domänen finns inte i vårt konto: flytta enligt steg 2.

## 2. Flytt till vårt eget Resend-konto (om svar B)
1. Resend > Domains > Add Domain: `notify.vt6projektadmin.se`, region EU (Ireland) om möjligt.
2. Resend visar tre poster. Lägg dem i Simply DNS (IT-stöd gör detta), och **ersätt** de gamla:
   - TXT `resend._domainkey.notify` = Resends nya DKIM-värde (ersätter dagens).
   - MX `send.notify` = Resends värde (`feedback-smtp...amazonses.com`, prioritet 10), och TXT `send.notify` = `v=spf1 include:amazonses.com ~all`.
     Ta bort CNAME `send.notify` -> `send.forge.rmta.net` (en CNAME kan inte samexistera med MX/TXT på samma namn).
3. Klicka Verify i Resend. Vänta tills alla tre är gröna.
4. DMARC: byt `_dmarc.vt6projektadmin.se` till `v=DMARC1; p=none; pct=100; rua=mailto:vidar@roslagstak.se` (behåll p=none tills allt är verifierat, skärp senare).
5. Skapa API-nyckel (Sending access, domän notify.vt6projektadmin.se). Sätt den i båda Workers:
   - CRM: `cd crm; bunx wrangler secret put RESEND_API_KEY`
   - Utbildning: `cd utbildning; bunx wrangler secret put RESEND_API_KEY`
   (Kör CRM-flödet först: det skickar SLA-larm och signeringsmail. Ingen kodändring eller deploy behövs.)
6. Test: skicka en signeringsförfrågan eller lead-notis och kontrollera att mailet kommer fram och att `email_send_log` visar `sent`.

## 3. Städa return-path och DMARC även om domänen redan är vår (svar A)
- Om Resend själv anger `send.notify` MX/SPF: följ dem (som i steg 2 punkt 2) så att inget längre pekar på `forge.rmta.net`.
- Ändra DMARC-rapporternas mottagare enligt steg 2 punkt 4.

## Vad som INTE kräver åtgärd
- Inbound-mailet (info@ -> Zoho -> Resend receiving) använder ett annat Resend-konto och `phirvro.resend.app`, opåverkat.
- Kod: CRM och utbildning anropar Resend via SDK:t och `RESEND_API_KEY`, så flytten är ren konfiguration.
