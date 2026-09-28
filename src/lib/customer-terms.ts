// Ramverk för kundvillkor i offert-/signeringsflödet. Ren logik, ingen I/O. Källa: Agent -
// Jurists leverans ledning/jurist/kundvillkor-v1.md (version 1.0, 2026-09-27).
//
// Två oberoende block, varje med egen active-flagga, eftersom ångerrätten (avsnitt 3-4) är
// juridiskt akut (HÖG risk - se kundvillkor-v1.md avsnitt 0 och 9) och kan godkännas av Vidar
// långt innan de allmänna villkoren (avsnitt 2, blockerade av [BESLUT] K1/K2/K3/K5):
//   - "withdrawal" = ångerrätt + ångerblankett (avsnitt 3-4). Inga [BESLUT] i själva texten
//     förutom K4 (VT6:s adress/e-post), som krävs enligt lag för att ångerinformationen ens
//     ska vara giltig.
//   - "villkor" = Allmänna villkor (avsnitt 2, inkl. byggherreansvar §6 och garanti §8).
//     Blockerad tills K1/K2/K3/K5 är beslutade.
// Kryssruta 1:s ordalydelse skiljer sig beroende på vilka block som faktiskt bifogas -
// juristens kombinerade text ("...offerten, de allmänna villkoren och informationen om
// ångerrätt...") gäller bara när BÅDA blocken är aktiva. Se ack_withdrawal_label/ack_full_label.
//
// app_settings.customer_terms (key "customer_terms") håller texterna, så Vidar kan uppdatera
// dem med en enkel UPDATE utan ny migration.

export interface CustomerTermsConfig {
  withdrawal_active: boolean;
  withdrawal_version: string | null;
  angerratt_text: string | null;
  angerblankett_text: string | null;
  /** Kryssruta 1 när BARA ångerrätt bifogas (inte allmänna villkor). */
  ack_withdrawal_label: string | null;
  /** Mening under signaturknappen ("Genom att signera ingår du...") i withdrawal_only-läget. */
  withdrawal_binding_sentence: string | null;
  /** Kryssruta 2 (frivillig, ALDRIG förkryssad): begäran om att arbetet får börja tidigt. */
  early_start_checkbox_text: string | null;
  /** Mening i bekräftelsemailet om kryssruta 2 var ikryssad. Innehåller "{datum}" som token. */
  early_start_confirmed_sentence: string | null;

  villkor_active: boolean;
  villkor_version: string | null;
  /** Avsnitt 2: hela "Allmänna villkor"-dokumentet (inkl. byggherreansvar §6, garanti §8). */
  allmanna_villkor_text: string | null;
  /** Kryssruta 1 när BÅDA blocken bifogas (juristens ursprungliga, kombinerade lydelse). */
  ack_full_label: string | null;

  /** Avsnitt 6: garantibevis vid slutgenomgång. Sparas men används inte i detta bygge -
   *  slutgenomgången är ett separat, senare steg i flödet. */
  garantibevis_text: string | null;
}

export const EMPTY_CUSTOMER_TERMS: CustomerTermsConfig = {
  withdrawal_active: false,
  withdrawal_version: null,
  angerratt_text: null,
  angerblankett_text: null,
  ack_withdrawal_label: null,
  withdrawal_binding_sentence: null,
  early_start_checkbox_text: null,
  early_start_confirmed_sentence: null,
  villkor_active: false,
  villkor_version: null,
  allmanna_villkor_text: null,
  ack_full_label: null,
  garantibevis_text: null,
};

export function parseCustomerTerms(raw: unknown): CustomerTermsConfig {
  if (!raw || typeof raw !== "object") return EMPTY_CUSTOMER_TERMS;
  const r = raw as Partial<CustomerTermsConfig>;
  return {
    withdrawal_active: r.withdrawal_active === true,
    withdrawal_version: r.withdrawal_version ?? null,
    angerratt_text: r.angerratt_text ?? null,
    angerblankett_text: r.angerblankett_text ?? null,
    ack_withdrawal_label: r.ack_withdrawal_label ?? null,
    withdrawal_binding_sentence: r.withdrawal_binding_sentence ?? null,
    early_start_checkbox_text: r.early_start_checkbox_text ?? null,
    early_start_confirmed_sentence: r.early_start_confirmed_sentence ?? null,
    villkor_active: r.villkor_active === true,
    villkor_version: r.villkor_version ?? null,
    allmanna_villkor_text: r.allmanna_villkor_text ?? null,
    ack_full_label: r.ack_full_label ?? null,
    garantibevis_text: r.garantibevis_text ?? null,
  };
}

/** Sant om texten saknas ELLER fortfarande har en "[...]"-platshållare kvar (t.ex. "[BESLUT K4]"). */
function notResolved(text: string | null): boolean {
  return !text?.trim() || /\[[^\]]*\]/.test(text);
}

/** Ångerrätt + ångerblankett + tidig-start-texterna redo att användas mot en riktig kund. */
export function isWithdrawalReady(cfg: CustomerTermsConfig): boolean {
  return (
    cfg.withdrawal_active &&
    !!cfg.withdrawal_version &&
    !notResolved(cfg.angerratt_text) &&
    !notResolved(cfg.angerblankett_text) &&
    !notResolved(cfg.ack_withdrawal_label) &&
    !notResolved(cfg.withdrawal_binding_sentence) &&
    !notResolved(cfg.early_start_checkbox_text) &&
    !notResolved(cfg.early_start_confirmed_sentence)
  );
}

/** Allmänna villkor redo (kräver K1/K2/K3/K5 beslutade - annars kvarstår "[BESLUT ...]"). */
export function isVillkorReady(cfg: CustomerTermsConfig): boolean {
  return cfg.villkor_active && !!cfg.villkor_version && !notResolved(cfg.allmanna_villkor_text);
}

export type CustomerTermsMode = "none" | "withdrawal_only" | "full";

/**
 * Vilket läge som faktiskt ska användas för en NY signeringsbegäran just nu. "full" kräver
 * både ångerrätt OCH allmänna villkor redo (då används kryssruta 1:s kombinerade lydelse,
 * ack_full_label). "withdrawal_only" kräver bara ångerrätt redo, och använder
 * ack_withdrawal_label istället - allmänna villkor bifogas då inte alls.
 */
export function resolveCustomerTermsMode(cfg: CustomerTermsConfig): CustomerTermsMode {
  const withdrawalReady = isWithdrawalReady(cfg);
  const villkorReady = isVillkorReady(cfg);
  if (withdrawalReady && villkorReady && !notResolved(cfg.ack_full_label)) return "full";
  if (withdrawalReady) return "withdrawal_only";
  return "none";
}

/** DB-värdet för signature_requests.customer_terms_mode, juristens exakta namngivning. */
export function customerTermsModeToDbValue(mode: CustomerTermsMode): string | null {
  if (mode === "full") return "full_v1";
  if (mode === "withdrawal_only") return "angerratt_only";
  return null;
}

export interface WithdrawalDates {
  /** Ångerfristen går ut 14 dagar efter signering (lag (2005:59) 2 kap. 12 §). */
  withdrawalEndsAt: Date;
  /** Hård CRM-spärr: arbetsorder får inte starta före dag 15 utan begäran om tidig start. */
  earliestStartWithoutRequest: Date;
}

/** Ren datummatte för ångerfristen, utgår från signeringstidpunkten (kundvillkor-v1.md avsnitt 5). */
export function computeWithdrawalDates(signedAt: Date): WithdrawalDates {
  const DAY = 86400000;
  return {
    withdrawalEndsAt: new Date(signedAt.getTime() + 14 * DAY),
    earliestStartWithoutRequest: new Date(signedAt.getTime() + 15 * DAY),
  };
}
