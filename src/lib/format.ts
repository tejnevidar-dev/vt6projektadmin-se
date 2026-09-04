/**
 * Gemensamma svenska formatterare för belopp och datum.
 * Använd dessa istället för lokala kopior i komponenter/routes.
 */

/** "1 234 kr" – avrundat till hela kronor. */
export function kr(n: number | null | undefined): string {
  return `${Math.round(n ?? 0).toLocaleString("sv-SE")} kr`;
}

/** "12 tkr" – avrundat till hela tusental. */
export function tkr(n: number | null | undefined): string {
  return `${Math.round((n ?? 0) / 1000).toLocaleString("sv-SE")} tkr`;
}

/** "2026-09-04" → "2026-09-04" i svenskt datumformat, "–" när värde saknas. */
export function dateSv(d: string | null | undefined): string {
  if (!d) return "–";
  // Rena datum (YYYY-MM-DD) tolkas som UTC av Date – normalisera till lokal midnatt.
  return new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("sv-SE");
}

/** Datum + klockslag, "–" när värde saknas. */
export function dateTimeSv(d: string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}
