// Öppettider för bokning/callback (Marknadschefens spec 2026-09-28, avstämt med Vidar):
// mån-fre 07-20, lör-sön 09-19, Stockholmstid. Ren logik, ingen I/O.

interface Window {
  start: number; // heltal timme, lokal Stockholmstid
  end: number;
}

const WEEKDAY_WINDOW: Window = { start: 7, end: 20 };
const WEEKEND_WINDOW: Window = { start: 9, end: 19 };

function windowFor(weekday: number): Window {
  return weekday === 0 || weekday === 6 ? WEEKEND_WINDOW : WEEKDAY_WINDOW;
}

/** Veckodag (0=söndag..6=lördag), timme och minut i Stockholmstid för en tidpunkt. */
function stockholmParts(d: Date): { weekday: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d);
  const weekdayMap: Record<string, number> = { sön: 0, mån: 1, tis: 2, ons: 3, tor: 4, fre: 5, lör: 6 };
  const wd = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3) ?? "mån";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { weekday: weekdayMap[wd] ?? 1, hour, minute };
}

/** Sant om tidpunkten ligger inom öppettiderna (mån-fre 07-20, lör-sön 09-19). */
export function isWithinOpeningHours(d: Date): boolean {
  const { weekday, hour } = stockholmParts(d);
  const w = windowFor(weekday);
  return hour >= w.start && hour < w.end;
}

/** Nästa tidpunkt öppettiderna börjar (eller `d` självt om redan öppet). */
export function nextOpeningTime(d: Date): Date {
  if (isWithinOpeningHours(d)) return d;
  const HOUR = 3600000;
  // Testar timme för timme upp till 7 dagar framåt - öppettiderna är korta nog att detta
  // alltid hittar nästa öppning inom ett dygn eller två, och koden slipper egen kalenderlogik.
  for (let i = 1; i <= 7 * 24; i++) {
    const candidate = new Date(d.getTime() + i * HOUR);
    const { weekday, hour, minute } = stockholmParts(candidate);
    if (hour === windowFor(weekday).start && minute === 0) return candidate;
  }
  return d;
}

/**
 * När ett SLA-löfte (t.ex. "ring inom 1 h") infrias senast: om förfrågan kom under öppettid
 * räknas timmarna direkt, annars räknas de från nästa öppningstid ("ring mig inom 1 h" som kom
 * kl 23 på natten ska inte ge ett löfte om att bli uppringd mitt i natten).
 */
export function slaDeadline(createdAt: Date, slaHours: number): Date {
  const base = isWithinOpeningHours(createdAt) ? createdAt : nextOpeningTime(createdAt);
  return new Date(base.getTime() + slaHours * 3600000);
}
