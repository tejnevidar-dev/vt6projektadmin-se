# Sätt ROSLAGSTAK_WEBHOOK_SECRET (steg för steg)

Bakgrund: sajtens formulär anropar `POST https://admin-vt6.tejnevidar.workers.dev/api/public/roslagstak-webhook`
med headern `X-Webhook-Secret`. Workern jämför den med Worker-secreten `ROSLAGSTAK_WEBHOOK_SECRET`. Saknas
secreten svarar webhooken 500 "misconfigured". Samma värde måste finnas på båda sidor.

## 1. Generera ett starkt värde (lokalt, visa det inte i chatten)
I PowerShell (skriver värdet till urklipp utan att visa det):

    $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString("x2") }) -join "" | Set-Clipboard

Värdet är 64 hex-tecken och ligger nu i urklipp. Kör inget annat som skriver över urklipp förrän steg 2 och 3 är klara.

## 2. Sätt den på CRM-Workern
    cd C:\Users\tejne\Documents\Projects\RoslagsTak\crm
    bunx wrangler secret put ROSLAGSTAK_WEBHOOK_SECRET

Klistra in värdet när det efterfrågas (Ctrl+V, Enter). Ingen ny deploy behövs, secrets gäller direkt.
Kontroll: `bunx wrangler secret list` ska visa namnet ROSLAGSTAK_WEBHOOK_SECRET.

## 3. Sätt samma värde på sajtsidan
Sajten (Hemsideagentens område, mapp `webbsida/`) måste skicka samma värde i headern `X-Webhook-Secret`
till URL:en ovan. Hemsideagenten anger exakt var: Worker-secret eller miljövariabel för sajtens
formulär-funktion. Klistra in samma värde där (med `wrangler secret put <NAMN>` i sajtens Worker) och deploya sajten
om det krävs för att den ska läsa värdet. Kontrollera också att sajtens webhook-URL är exakt den ovan
(det gamla Lovable-domänet fungerar inte längre).

## 4. Testa (utan att skapa riktig lead-data som blir kvar)
Claude kör efter att du sagt till (secreten hämtas ur urklipp eller anges av dig i terminalen):

    curl -s -X POST https://admin-vt6.tejnevidar.workers.dev/api/public/roslagstak-webhook ^
      -H "Content-Type: application/json" -H "X-Webhook-Secret: %SECRET%" ^
      -d "{\"id\":\"ZZTEST-1\",\"mode\":\"consultation\",\"name\":\"ZZ Test\",\"phone\":\"070 000 00 99\",\"email\":\"\"}"

Förväntat: 201 och `status: created` (tom e-post fungerar). Kör samma anrop igen: 200 `duplicate`. Fel secret: 401.
Testleaden raderas efteråt.

## 5. Efter test
- Sajtens riktiga formulär: skicka ett formulär (med och utan e-post) och kontrollera att leaden dyker upp i CRM.
- Rescue av missade förfrågningar 09-04..09-27: se `scripts/rescue-missed-quotes.ts` (körs först efter besked från projektledaren).

## Tillbaka
`bunx wrangler secret delete ROSLAGSTAK_WEBHOOK_SECRET` tar bort den (webhooken svarar då 500 igen).
