# Exit-plan: bort från Lovable Cloud och Lovable-beroenden

Status: **pågående, fas 1-6 klara (kod), fas 7 kvar.** Inga commits, inga pushar —
allt hittills bara lokala filer + direkt applicerat mot det nya Supabase-projektet.
Senast uppdaterad: 2026-09-08.

Mål (bekräftat av användaren): CRM:et ska köras utan beroende av Lovable Cloud eller
Lovables hosting. Eget Supabase-konto, migrerad produktionsdata, migrerad Storage,
behållna användare/auth om möjligt, alla secrets/tredjepartsintegrationer flyttade
bort från Lovables gateways, och separat hosting (Cloudflare om repot är kompatibelt).

---

## 1. Fullständig inventering: vad är Lovable-beroende idag

### 1.1 Backend / databas
- Supabase-projekt `daexufvunqqjvfuopdrc` hanteras via **Lovable Cloud**, inte ett
  Supabase-konto ägt av användaren.
- Databasens migrationer (`supabase/migrations/*.sql`, ~90 filer) är i sig inte
  Lovable-specifika (ren Postgres/RLS) — de flyttar rakt av till ett nytt Supabase-projekt.
- Storage-buckets: `offers`, `lead-documents`, `work-orders` (skapade via migration,
  `public=false`), samt `self-check-pdfs`, `self-check-images`, `subcontractor-docs`
  (skapade utanför migrationerna, troligen via Lovable/Supabase-dashboarden — bekräftat
  privata av användaren 2026-09-05).

### 1.2 Byggverktyg
- `vite.config.ts` importerade `@lovable.dev/vite-tanstack-config`, som **KLART
  2026-09-08 skrivits om för hand** (paketets faktiska källkod lästes direkt ur
  `node_modules` för att kopiera beteendet exakt, inte bara den gamla kommentaren i
  filen). Bakade in: TanStack Start-pluginet, `@tanstack/devtools-vite` (dev),
  `@vitejs/plugin-react`, Tailwind-pluginet, `vite-tsconfig-paths`, **Nitro**
  (`nitro/vite`, `cloudflare-module`-preset — inte `@cloudflare/vite-plugin` som den
  gamla kommentaren påstod; det paketet togs bort ur `package.json` som oanvänd dödvikt
  under fas 6), VITE_*-env-injektion, path-alias, React/TanStack dedupe. Utelämnat
  medvetet (dött utanför Lovables sandbox): asset-proxy mot `*.lovable.app`,
  felrapportering till Lovables UI, HMR-gate, dev-server-bridge, build-diagnostik,
  "componentTagger" (fanns inte ens i den installerade versionen, 2.13.1).
- Verifierat: `bun run build:dev` OCH `bun x tsc --noEmit` båda rena (0 fel).

### 1.3 AI-anrop (via `ai.gateway.lovable.dev`) — KLART 2026-09-08
Bytt till OpenAI direkt (modell `gpt-5.6-sol`, användarens val) via en ny delad helper
`src/lib/openai.server.ts` (`callOpenAIChat()`), som alla fem filerna nu använder:
- `src/lib/ai-insights.functions.ts` — säljinsikter/rekommendationer
- `src/routes/api/ai-pitch.ts` — AI-genererad säljpitch
- `src/routes/api/process-work-order.ts` — **byggdes om**: skickade tidigare rå PDF
  (Gemini-specifik `type: "file"` med base64) till AI:n. OpenAIs chat-API tar inte emot
  det på samma sätt, så PDF:en extraheras nu till text server-side (nytt beroende:
  `unpdf`, tillagt i `package.json` — kör `bun install` innan nästa build/test) och
  skickas som vanlig text istället.
- `src/lib/roof-analysis.functions.ts` — bildanalys (vision), fungerar rakt av med
  `image_url`-formatet mot OpenAI.
- `src/lib/offer-parse.functions.ts` — använder function calling (`tools`/`tool_choice`),
  fungerar rakt av.

### 1.4 Tredjepartskopplingar via `connector-gateway.lovable.dev` — KLART 2026-09-08
- `src/routes/api/public/hooks/send-booking-reminders.ts` — Twilio SMS. Bytt till
  Twilios riktiga API (`api.twilio.com`) med Basic Auth. **Ny variabel krävs:**
  `TWILIO_ACCOUNT_SID` (Lovables gateway höll reda på den åt oss — den finns inte i
  koden sedan innan). `TWILIO_API_KEY` används nu som Auth Token.
- `src/lib/seo/semrush.server.ts` — bytt till Semrushs riktiga API (`api.semrush.com`,
  `?type=...&key=...`-format istället för Lovables REST-liknande paths). **Overifierat:**
  backlinks-anropen kan behöva en annan bas-URL än övriga — Semrush har historiskt haft
  en separat Backlinks Analytics-endpoint. Testa `backlinkProfile()` specifikt.
- `src/lib/gsc.server.ts` — **medvetet pausad**, inte bytt. Kräver en riktig Google
  OAuth2-uppsättning (client id/secret + refresh-token), inte bara en nyckel — Lovable
  skötte hela OAuth-flödet åt oss. Kastar nu ett tydligt "pausad"-fel istället för att
  försöka nå en död Lovable-URL. Åtgärdas när/om en riktig Google Cloud-uppsättning finns.
- `src/lib/seo/ga4.server.ts` — miljövariabeln omdöpt till `VITE_GA4_MEASUREMENT_ID`
  (ingen kodlogik ändrad, den var aldrig en gateway-koppling).

### 1.5 E-post — KLART 2026-09-08 (kod skriven och byggverifierad, inte livetestad)
Bytt till **Resend**. `@lovable.dev/email-js` + `@lovable.dev/webhooks-js` borttagna ur
`package.json`. Viktig arkitekturupptäckt (hittad genom att läsa SDK-källkoden direkt):
**Supabase pratade aldrig direkt med den här appen** — flödet var
Supabase Auth → Lovables infrastruktur → vår webhook. Lovable konstruerade
bekräftelselänken (`data.url`) åt oss. Nu måste Supabase Auth Hook peka direkt hit,
med Supabases eget payload-format.

- **Ny fil** `src/lib/resend.server.ts` — Resend-klient + egen suppression-koll mot
  `suppressed_emails`-tabellen (Lovable gjorde detta server-side automatiskt; Resend
  har ingen motsvarighet för en egen suppressionslista, så vi kollar tabellen själva
  innan varje sändning).
- `src/lib/email-templates/send-email.ts` — bytt till `resend.server.ts`. Signaturen på
  `sendTemplateEmail()` fick ett nytt första `supabase`-argument (behövs för
  suppression-kollen) — `email-send-log.server.ts` uppdaterad i linje.
- **Ny fil** `src/routes/api/hooks/supabase-auth-email.ts` (ersätter
  `src/routes/lovable/email/auth/webhook.ts`, borttagen) — verifierar Supabase Auth
  Hooks egen signatur (Standard Webhooks, `SUPABASE_AUTH_HOOK_SECRET`), bygger själv
  bekräftelselänken via Supabases `/auth/v1/verify`-endpoint (samma mönster Supabases
  egna standardmejl använder), återanvänder samma sex React Email-mallar oförändrade.
  **Måste konfigureras i Supabase Dashboard → Authentication → Hooks → "Send Email"**
  pekat på den här URL:en innan det fungerar. Payload-formatet är skrivet efter bästa
  kännedom om Supabases dokumenterade format — verifiera mot faktisk payload/dashboard
  innan produktion, auth-mejl är kritiska.
- **Ny fil** `src/routes/api/hooks/resend-events.ts` (ersätter
  `src/routes/lovable/email/events.ts`, borttagen) — verifierar Resends Svix-signerade
  webhook (`RESEND_WEBHOOK_SECRET`), hanterar `email.bounced`/`email.complained`,
  skriver till samma `suppressed_emails`/`email_send_log`-tabeller som förut. **Måste
  konfigureras i Resend Dashboard → Webhooks** pekat på den här URL:en.
- **Känd lucka, medvetet inte byggd:** Lovable genererade automatiskt en
  avprenumerationslänk per mejl och skötte den landningssidan; Resend har ingen
  motsvarighet för transaktionsmejl. `email_unsubscribe_tokens`-tabellen finns kvar
  (migrerad) men inget i appen läser/skriver den längre. Om en riktig
  avprenumederingslänk fortfarande behövs måste den byggas som en egen funktion.
- `src/routes/lovable/email/auth/preview.ts` + `.../transactional/preview.ts` —
  **borttagna helt**, var bara Lovables egna interna förhandsgranskningsverktyg
  (skyddade med `LOVABLE_API_KEY`, anropades bara av "the Go API").
- **Nya env-variabler:** `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
  `SUPABASE_AUTH_HOOK_SECRET` (alla tillagda som tomma platshållare i `.env`/`.env.example`).

### 1.6 Auth / förhandsvisning
- `src/integrations/supabase/previewAuthStorage.ts`: brokerar inloggningssessionen till
  Lovables editor via `postMessage`, men **bara när appen körs på en Lovable-preview-domän**
  (`lovableproject.com`, `lovable.app` m.fl.). Faller redan tillbaka till vanlig
  `localStorage` på alla andra domäner. **Låg risk** — blir automatiskt dött/ofarligt
  kod så fort appen hostas någon annanstans, men bör städas bort för tydlighets skull.

### 1.7 Hosting & synk
- Live på `vt6projektadmin-se.lovable.app` (Lovables hosting), inte Cloudflare trots att
  `wrangler.jsonc` finns i repot. **Byggkedjan är nu klar för Cloudflare** (fas 6,
  se §1.8) — den faktiska deployen/kontot är fortfarande kvar att göra, kräver
  användarens eget Cloudflare-konto.
- Lovables GitHub-app är kopplad till repot och synkar automatiskt vid varje push till
  `main` — måste kopplas bort i GitHub eller Lovables projektinställningar (fas 7).
- `.lovable/plan.md` — Lovables interna AI-planeringsfil, ofarlig att ta bort (fas 7).

### 1.8 Schemalagda jobb — KLART 2026-09-08 (kod, byggverifierad)
Lovable Cloud → Jobs hade **en** aktiv schemaläggning: `send-booking-reminders`, körs
**var 5:e minut**. Det var inte pg_cron eller en Supabase Edge Function — det var Lovables
egen "Jobs"-funktion som periodiskt anropar vår befintliga endpoint
`src/routes/api/public/hooks/send-booking-reminders.ts` (Twilio-SMS-påminnelser, redan
inventerad i 1.4). Koden i sig är alltså redan hanterad — det som saknas är **själva
schemaläggningsmekanismen** när Lovable försvinner.

**Byggt (2026-09-08):** använder Nitros inbyggda Cloudflare Cron Trigger-stöd (`nitro`s
experimentella "tasks"-funktion + `scheduledTasks` i `vite.config.ts`) — Nitro
genererar `triggers.crons` i wrangler-konfigurationen **automatiskt vid bygge**, ingen
manuell wrangler-redigering behövs. Verifierat genom att faktiskt bygga och läsa den
genererade `.output/server/wrangler.json`: `"triggers": {"crons": ["*/5 * * * *"]}` —
exakt matchande Lovables gamla 5-minuterscykel.
- **Ny fil** `src/lib/booking-reminders.server.ts` — själva logiken (SMS/mejl-utskick),
  extraherad ur den gamla HTTP-routen så den kan återanvändas av båda.
- **Ny fil** `tasks/send-booking-reminders.ts` — Nitro-tasket som faktiskt körs på
  schemat, anropar samma delade funktion.
- `src/routes/api/public/hooks/send-booking-reminders.ts` — behållen (för manuell/debug-
  körning), skrivits om till att bara anropa den delade funktionen.
- **Endast byggverifierat, inte körkontrollerat i skarp Cloudflare-miljö** — kräver att
  appen faktiskt är deployad dit innan cron-jobbet kan triggas på riktigt.

### 1.9 Övrigt
- `README.md` nämner Lovable och länkar till editorn — kosmetiskt.
- `src/routeTree.gen.ts` — autogenererad av TanStack Router, innehåller bara routnamnen
  `/lovable/email/...` eftersom filerna ligger i den mappen. Regenereras automatiskt när
  route-filerna flyttas/byts — ingen manuell åtgärd.

---

## 2. Beslut som styr planen (alla tagna)

- **AI-leverantör:** OpenAI, modell `gpt-5.6-sol`.
- **E-postleverantör:** Resend (fas 4, inte byggt än).
- **Databasmigrering:** Lovable Cloud exponerar varken en Postgres-connection-sträng
  eller service-role-nyckeln — se [postgres-migration-plan.md](./postgres-migration-plan.md)
  för hur det löstes ändå (SQL editor → CSV/genererad SQL → nya projektet).

## 3. Status per fas

1. ✅ **Eget Supabase-konto etablerat.**
2. ✅ **`vite.config.ts` ombyggd och byggverifierad** (2026-09-08), bort från
   `@lovable.dev/vite-tanstack-config` — se §1.2 för detaljer. `bun run build:dev`
   kördes och lyckades helt (Nitro genererade korrekt `wrangler.json`/deploy-config för
   Cloudflare). Endast build-verifierat, inte `bun run dev`/faktisk appfunktion än.
3. ✅ **AI- och connector-gateway-anropen bytta** (2026-09-08) — se §1.3–1.4 för detaljer,
   inklusive vad som blev annorlunda än en ren URL-swap (PDF-hantering, Twilio Account SID,
   GSC pausad).
4. ✅ **E-postflödet ombyggt mot Resend** (2026-09-08) — se §1.5. Byggverifierat
   (`bun run build:dev` + `tsc --noEmit` båda rena), **inte livetestat** — kräver att
   Supabase Auth Hook och Resend-webhooken faktiskt konfigureras och att riktiga
   `RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET`/`SUPABASE_AUTH_HOOK_SECRET` sätts först.
5. ✅ **Databas + Storage migrerade** till eget Supabase-projekt — se
   [postgres-migration-plan.md](./postgres-migration-plan.md), helt klart 2026-09-08.
6. ✅ **Cloudflare-byggkedjan klar och byggverifierad** (2026-09-08) — Cron Trigger
   genererad korrekt, se §1.8. **Kvar:** användarens eget Cloudflare-konto, faktisk
   `wrangler deploy`/`nitro deploy`, miljövariabler/secrets satta i Cloudflare, ev.
   eget domännamn kopplat — allt utanför vad kod kan lösa, kräver kontot.
7. ✅ **Kodstädning klar** (2026-09-08): `@lovable.dev/*`-paket borta ur `package.json`
   sedan tidigare faser, `.lovable`-mappen borttagen, `previewAuthStorage.ts` borttagen
   (och `client.ts` uppdaterad att inte längre referera den — Supabase-klienten
   använder nu sin inbyggda standard-storage), README skriven om (tar bort alla
   Lovable-nämningar, fixar den felaktiga npm-instruktionen till bun). Kvarvarande
   "lovable"-träffar i repot är bara kommentarer/dokumentation som medvetet förklarar
   migreringsbeslut — inte levande beroenden.
   **Kvarstår, kräver dig manuellt:** koppla bort Lovables GitHub-app från repot
   (GitHub → repo → Settings → Integrations → GitHub Apps, eller i Lovables egna
   projektinställningar) — det är ett kontobeslut jag inte kan göra åt dig.
   **Litet kosmetiskt fynd, inte åtgärdat:** `src/routes/__root.tsx` har en OG/Twitter-
   bild-URL vars FILNAMN råkar innehålla "lovable.app" (bilden själv ligger på
   Cloudflare R2, inte Lovable — fungerar fortfarande, bara ett namn-artefakt från när
   den togs). Byt ut mot en egen skärmdump när ni har en, ingen brådska.

**Alla sju faser är nu klara i kod.** Kvarstående arbete är den samlade uppsättnings-
och testomgången: Cloudflare-konto + deploy + secrets, Resend-konto + domänverifiering
+ webhook, Supabase Auth Hook-konfiguration, riktiga AI/Twilio/SEMrush-nycklar, sen en
fullständig klick-igenom-test av den driftsatta appen.
