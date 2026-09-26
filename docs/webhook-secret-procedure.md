# Sätt ROSLAGSTAK_WEBHOOK_SECRET och peka om sajtens vidarebefordran (steg för steg)

Bakgrund: när någon skickar formuläret på sajten sparas det i `quote_requests` i sajtens Supabase-projekt
(`yrxvkslqfertydvrfymb`). En databastrigger, `trg_notify_saljtak_on_new_quote`, skickar sedan förfrågan vidare med
pg_net till CRM:et. URL och hemlighet läses från tabellen `public.webhook_config` (nycklarna `saljtak_url` och
`saljtak_secret`) och skickas i headern `X-Webhook-Secret`. CRM-webhooken (`/api/public/roslagstak-webhook`) läser
headern `x-webhook-secret` (HTTP-headers är skiftlägesokänsliga) och jämför med Worker-secreten
`ROSLAGSTAK_WEBHOOK_SECRET`. Saknas secreten svarar webhooken 500 "misconfigured". `saljtak_url` pekar troligen
fortfarande på den gamla Lovable-hosten, vilket förklarar att inga anrop kommit fram sedan 2026-09-04.

Samma värde måste stå på båda sidor. Vidar klistrar in värdet själv, det ska aldrig skrivas i chatten.

## 1. Generera ett starkt värde (lokalt)
PowerShell, skriver värdet till urklipp utan att visa det:

    $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString("x2") }) -join "" | Set-Clipboard

Värdet är 64 hex-tecken och ligger nu i urklipp. Kopiera inget annat förrän steg 2 och 3 är klara.

## 2. Sätt hemligheten på CRM-Workern
    cd C:\Users\tejne\Documents\Projects\RoslagsTak\crm
    bunx wrangler secret put ROSLAGSTAK_WEBHOOK_SECRET

Klistra in värdet när det efterfrågas (Ctrl+V, Enter). Ingen ny deploy behövs. Kontroll: `bunx wrangler secret list`
ska visa namnet ROSLAGSTAK_WEBHOOK_SECRET.

## 3. Peka om sajtens vidarebefordran (samma värde)
Öppna sajtens Supabase (projekt `yrxvkslqfertydvrfymb`) > SQL Editor. Byt ut VÄRDET_HÄR mot värdet från urklipp
(Ctrl+V) och kör:

    insert into public.webhook_config (key, value) values
      ('saljtak_url', 'https://admin-vt6.tejnevidar.workers.dev/api/public/roslagstak-webhook'),
      ('saljtak_secret', 'VÄRDET_HÄR')
    on conflict (key) do update set value = excluded.value;

Om tabellen har andra kolumnnamn än `key` och `value`: kör först `select * from public.webhook_config limit 0;`
och anpassa (visa inte befintliga värden). Kontrollera att URL:en är exakt ovan, utan avslutande snedstreck.

## 4. Testa
1. Skicka en riktig förfrågan via formuläret på sajten (namn, telefon, adress; en gång med e-post och en gång utan).
2. I CRM > Webhook-loggar (eller Supabase SQL i CRM-projektet):
   `select created_at, status_code, status from webhook_logs where source = 'roslagstak' order by created_at desc limit 5;`
   Förväntat: 201 `created`. Fel secret ger 401, saknad secret på Workern 500 `misconfigured`.
3. Om inget dyker upp: i sajtens Supabase, `select * from net._http_response order by created desc limit 5;` visar
   pg_nets svar (statuskod och fel, t.ex. gammal URL eller timeout).
4. Radera testleaden i CRM efteråt.

## 5. Rescue av missade förfrågningar 2026-09-04..09-27
Hemsideagenten exporterar raderna från `quote_requests` (skapade efter 2026-09-04 00:10 UTC) till en JSON-fil. Därefter:
torrkörning med `bun run scripts/rescue-missed-quotes.ts <fil>.json`, sedan `--send` med `WEBHOOK_SECRET` satt. Körs först
efter besked från projektledaren. Skriptet är idempotent (external_id `roslagstak:<id>`).

## Tillbaka
- CRM-sidan: `bunx wrangler secret delete ROSLAGSTAK_WEBHOOK_SECRET` (webhooken svarar då 500 igen).
- Sajtsidan: sätt `saljtak_url` och `saljtak_secret` till de tidigare värdena (spara dem innan steg 3 om de behövs).
