// Engångsskript: genererar ledning/jurist/angerinformation-v1.pdf (avsnitt 3-4 i
// kundvillkor-v1.md) för Vidars manuella bifogning tills ångerinfon är inbyggd i flödet.
// Körs manuellt: bun run scripts/gen-angerinformation-pdf.ts
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAngerrattPdf } from "../src/lib/customer-terms-pdf.server";

const angerrattText = `Ångerrätt
Du har rätt att frånträda (ångra) detta avtal inom 14 dagar utan att ange något skäl. Ångerfristen löper ut 14 dagar efter den dag då avtalet ingicks, alltså den dag du signerade offerten.

För att utöva ångerrätten ska du meddela oss, RoslagsTak (VT6 Invest AB), [postadress – BESLUT K4], [e-post – BESLUT K4], 070-154 36 39, ditt beslut att frånträda avtalet. Gör det i ett tydligt meddelande, till exempel ett brev eller ett mejl. Du kan använda den bifogade ångerblanketten, men det är inget krav.

För att du ska hinna ångra dig i tid räcker det att du skickar ditt meddelande om att du utövar ångerrätten innan ångerfristen har gått ut.

Effekter av att du ångrar dig
Om du frånträder avtalet betalar vi tillbaka alla betalningar vi har fått från dig utan onödigt dröjsmål, och senast 14 dagar från den dag vi fick ditt meddelande. Återbetalningen görs med samma betalningsmetod som du använde, om du inte uttryckligen har godkänt något annat. Du debiteras inga avgifter för återbetalningen.

Om arbetet har börjat under ångerfristen
Arbetet börjar inte under ångerfristen om du inte uttryckligen har begärt det. Har du begärt att arbetet ska börja under ångerfristen och sedan ångrar dig, ska du betala ett belopp som motsvarar den del av arbetet som har utförts fram till att du meddelade oss, i förhållande till hela avtalet.

När ångerrätten upphör
Om arbetet har utförts helt efter att du uttryckligen samtyckt till att det började under ångerfristen och gått med på att ångerrätten då upphör, har du inte längre någon ångerrätt.`;

const angerblankettText = `Till: RoslagsTak (VT6 Invest AB), [postadress – BESLUT K4], [e-post – BESLUT K4]

Jag meddelar härmed att jag frånträder mitt avtal om följande tjänst:
Offertnummer: ……………………
Avtalet ingicks (datum då offerten signerades): ……………………
Namn: ……………………
Adress: ……………………
Underskrift (endast om blanketten skickas på papper): ……………………
Datum: ……………………`;

const bytes = await buildAngerrattPdf(angerrattText, angerblankettText);
const out = resolve(import.meta.dir, "../../ledning/jurist/angerinformation-v1.pdf");
await writeFile(out, bytes);
console.log("Skrev", out, `(${bytes.byteLength} bytes)`);
console.log("OBS: [postadress - BESLUT K4] och [e-post - BESLUT K4] är fortfarande platshållare - Vidar måste fylla i dem för hand i denna PDF, eller vänta med utskick tills K4 är beslutat.");
