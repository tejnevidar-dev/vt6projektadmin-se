// Ramverk för kundvillkor i offert-/signeringsflödet (ångerrätt, byggherreansvar, garanti).
// Ren logik, ingen I/O. Agent - Jurist äger texterna (levereras via app_settings.customer_terms,
// key "customer_terms"); den här filen bara avgör NÄR villkoren är kompletta nog att användas
// och vilka kryssrutor som krävs. Byggd tom/inaktiv på Driftchefens uppdrag 2026-09-27, så att
// dagens offerter (inkl. de 12 utestående v40-v42, skapade utan detta) inte påverkas alls förrän
// Vidar uttryckligen sätter active: true efter att texterna finns och är godkända.

export interface CustomerTermsConfig {
  /** Måste sättas explicit av Vidar/admin - att texterna finns räcker inte för att aktivera. */
  active: boolean;
  /** Valfri versionsetikett för spårbarhet (t.ex. "2026-10-v1"). */
  version: string | null;
  angerratt_text: string | null;
  byggherreansvar_text: string | null;
  garanti_text: string | null;
  angerblankett_text: string | null;
  /** Kryssrutor kunden måste bekräfta, key -> etikett. Tomt = inga krav (och därmed aldrig redo). */
  ack_labels: Record<string, string>;
}

export const EMPTY_CUSTOMER_TERMS: CustomerTermsConfig = {
  active: false,
  version: null,
  angerratt_text: null,
  byggherreansvar_text: null,
  garanti_text: null,
  angerblankett_text: null,
  ack_labels: {},
};

export function parseCustomerTerms(raw: unknown): CustomerTermsConfig {
  if (!raw || typeof raw !== "object") return EMPTY_CUSTOMER_TERMS;
  const r = raw as Partial<CustomerTermsConfig>;
  return {
    active: r.active === true,
    version: r.version ?? null,
    angerratt_text: r.angerratt_text ?? null,
    byggherreansvar_text: r.byggherreansvar_text ?? null,
    garanti_text: r.garanti_text ?? null,
    angerblankett_text: r.angerblankett_text ?? null,
    ack_labels: r.ack_labels && typeof r.ack_labels === "object" ? (r.ack_labels as Record<string, string>) : {},
  };
}

/**
 * Sant bara när Vidar aktiverat konfigurationen OCH juristen levererat alla fyra texterna OCH
 * minst en kryssruta är definierad. Allt annat (inklusive dagens "active: false, allt null"-läge)
 * betyder: ingen villkorsblock i PDF:en, ingen spärr vid signering - exakt som idag.
 */
export function isCustomerTermsReady(cfg: CustomerTermsConfig): boolean {
  return (
    cfg.active &&
    !!cfg.version &&
    !!cfg.angerratt_text?.trim() &&
    !!cfg.byggherreansvar_text?.trim() &&
    !!cfg.garanti_text?.trim() &&
    !!cfg.angerblankett_text?.trim() &&
    Object.keys(cfg.ack_labels).length > 0
  );
}

/** Vilka obligatoriska kryssrutor som saknas (inte ikryssade) i `acks`. Tom lista = allt klart. */
export function missingAcks(cfg: CustomerTermsConfig, acks: Record<string, boolean> | null | undefined): string[] {
  return Object.keys(cfg.ack_labels).filter((k) => acks?.[k] !== true);
}
