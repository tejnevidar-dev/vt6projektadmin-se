// UE-prislista (Bilaga 1) – FÖRSLAG, inte beslutat. Källa: ledning/ue/03-prislista-ue-utkast.md
// (Agent – UE:s utkast, alla 🟡-antaganden). Används BARA för att visa admin ett förslag på
// arbetsordern innan UE-priset sätts manuellt – aldrig automatiskt, aldrig visat för UE.
// "Inget av detta får visas eller lovas till en UE utan Vidars OK" (samma utkast).
//
// Alla priser exkl. moms, endast arbete (material/container/ställning ingår aldrig i UE:s pris).

export interface UePriceListConfig {
  taklaggare: {
    /** Kr per m² takyta, per materialnyckel (samma nycklar som price_list/calculations.material_key). */
    per_material_kvm: Record<string, number>;
    /** Kr per m² för komplext tak (många vinklar/kupor/valmat) – används om angivet, annars materialpriset. */
    complex_kvm: number | null;
    surcharge_pct: { two_storeys: number; three_plus_storeys: number; steep_pitch: number };
  };
  platslagare: {
    per_kvm: Record<string, number>;
    per_st: Record<string, number>;
    per_lpm: Record<string, number>;
  };
  /** Tilläggsmoment (båda lagen), kr per enhet. */
  addons: Record<string, number>;
}

// Draft-värdena ur 03-prislista-ue-utkast.md (2026-09-26), alla 🟡.
export const DEFAULT_UE_PRICE_LIST: UePriceListConfig = {
  taklaggare: {
    per_material_kvm: { betongpannor: 400, tegelpannor: 440, papp: 300 },
    complex_kvm: 520,
    surcharge_pct: { two_storeys: 10, three_plus_storeys: 20, steep_pitch: 10 },
  },
  platslagare: {
    per_kvm: { plat_bandtackning: 650, platprofil: 280 },
    per_st: { skorstensinklädnad: 3500 },
    per_lpm: { hangrannor: 90, fotplat: 70, vindskiveplat: 70 },
  },
  addons: { ranndal: 1500, raspont_kvm: 150, takfonster: 3000, snoskydd: 400 },
};

export function parseUePriceList(raw: unknown): UePriceListConfig {
  if (raw && typeof raw === "object") return raw as UePriceListConfig;
  return DEFAULT_UE_PRICE_LIST;
}

export interface UePriceSuggestionLine {
  label: string;
  amount: number;
}
export interface UePriceSuggestion {
  lines: UePriceSuggestionLine[];
  total: number;
}

export interface UeCalcLike {
  roofAreaKvm: number | null;
  materialKey: string | null;
  isComplex?: boolean;
  storeys?: number | null;
  steepPitch?: boolean;
  ranndalarMeter?: number | null;
  /** key -> antal, för plåtmoment/tillägg (skorstensinklädnad, hangrannor, takfonster, snoskydd, raspont osv.). */
  items?: Record<string, number> | null;
}

const LABELS: Record<string, string> = {
  betongpannor: "Betongpannor",
  tegelpannor: "Tegelpannor",
  papp: "Papptak",
  plat_bandtackning: "Plåt, bandtäckning",
  platprofil: "Plåtprofil",
  ranndal: "Ränndal",
  skorstensinklädnad: "Skorstensinklädnad",
  hangrannor: "Hängrännor",
  fotplat: "Fotplåt",
  vindskiveplat: "Vindskiveplåt",
  raspont_kvm: "Byte av råspont/undertak",
  takfonster: "Takfönster",
  snoskydd: "Snörasskydd",
};

/**
 * Föreslaget UE-pris (endast arbete) ur prislistan, för ADMIN att jämföra med det manuella priset.
 * Sätter aldrig något pris själv och skickas aldrig till UE. Okänd material-/momentnyckel ger ingen
 * rad (inget pris gissas fram).
 */
export function suggestUePrice(calc: UeCalcLike, cfg: UePriceListConfig): UePriceSuggestion {
  const lines: UePriceSuggestionLine[] = [];
  const area = Number(calc.roofAreaKvm) || 0;

  if (area > 0 && calc.materialKey) {
    const perKvm = calc.isComplex && cfg.taklaggare.complex_kvm != null ? cfg.taklaggare.complex_kvm : cfg.taklaggare.per_material_kvm[calc.materialKey];
    const perKvmPlat = cfg.platslagare.per_kvm[calc.materialKey];
    if (perKvm != null) {
      let amount = perKvm * area;
      const pct = calc.storeys && calc.storeys >= 3 ? cfg.taklaggare.surcharge_pct.three_plus_storeys : calc.storeys === 2 ? cfg.taklaggare.surcharge_pct.two_storeys : 0;
      const steepPct = calc.steepPitch ? cfg.taklaggare.surcharge_pct.steep_pitch : 0;
      amount = amount * (1 + (pct + steepPct) / 100);
      lines.push({ label: `${LABELS[calc.materialKey] ?? calc.materialKey} (${area} m², ${perKvm} kr/m²${pct || steepPct ? ` +${pct + steepPct} %` : ""})`, amount: Math.round(amount) });
    } else if (perKvmPlat != null) {
      lines.push({ label: `${LABELS[calc.materialKey] ?? calc.materialKey} (${area} m² × ${perKvmPlat} kr)`, amount: Math.round(perKvmPlat * area) });
    }
  }

  if (calc.ranndalarMeter && calc.ranndalarMeter > 0) {
    // Draften anger ränndal som pris per styck (upp till 6 m), inte per meter. Utan antal ränndalar
    // räknat separat approximeras med 6 m per ränndal (samma schablon som draften).
    const perRanndal = cfg.addons.ranndal;
    if (perRanndal != null) {
      const count = Math.max(1, Math.round(calc.ranndalarMeter / 6));
      lines.push({ label: `${LABELS.ranndal} (ca ${count} st à ${perRanndal} kr)`, amount: count * perRanndal });
    }
  }

  for (const [key, qty] of Object.entries(calc.items ?? {})) {
    if (!(qty > 0)) continue;
    const price = cfg.platslagare.per_st[key] ?? cfg.platslagare.per_lpm[key] ?? cfg.addons[key];
    if (price == null) continue;
    lines.push({ label: `${LABELS[key] ?? key} (${qty} × ${price} kr)`, amount: Math.round(price * qty) });
  }

  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}
