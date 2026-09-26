// Marginal (täckningsbidrag) per affär, visas för admin i kalkylen så att marginalen syns innan offerten skickas.
// Ren logik utan I/O. Konfigurationen ligger i app_settings (nyckel margin_config), standardvärdena är Vidars
// uppgifter via Strategi: container 7 000 kr, ställning 0 kr, provision 3 % på kundpris exkl. moms, UE-arbete 450 kr/m2.

export interface MarginConfig {
  /** UE:s pris för endast arbete, kr per m2 takyta (takbyte). */
  ue_price_per_kvm: number;
  container_cost: number;
  scaffold_cost: number;
  /** Provision i % av kundpris exkl. moms. */
  provision_pct: number;
  /** Materialets inköpskostnad som % av materialets kundpris. 100 = ingen materialmarginal (försiktigast). */
  material_cost_pct: number;
}

export const DEFAULT_MARGIN_CONFIG: MarginConfig = {
  ue_price_per_kvm: 450,
  container_cost: 7000,
  scaffold_cost: 0,
  provision_pct: 3,
  material_cost_pct: 100,
};

export function parseMarginConfig(raw: unknown): MarginConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (k: keyof MarginConfig) => {
    const n = Number(v[k]);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MARGIN_CONFIG[k];
  };
  return {
    ue_price_per_kvm: num("ue_price_per_kvm"),
    container_cost: num("container_cost"),
    scaffold_cost: num("scaffold_cost"),
    provision_pct: num("provision_pct"),
    material_cost_pct: num("material_cost_pct"),
  };
}

export interface MarginResult {
  revenueExVat: number;
  material: number;
  ueLabour: number;
  container: number;
  scaffold: number;
  provision: number;
  totalCost: number;
  tb: number;
  tbPct: number;
}

/** Marginal för ett takbyte: kundpris exkl. moms minus material, UE-arbete, container, ställning och provision. */
export function computeMargin(input: { exVat: number; materialSum: number; areaKvm: number }, cfg: MarginConfig): MarginResult {
  const revenue = Math.max(0, input.exVat);
  const material = Math.max(0, input.materialSum) * (cfg.material_cost_pct / 100);
  const ueLabour = Math.max(0, input.areaKvm) * cfg.ue_price_per_kvm;
  const provision = revenue * (cfg.provision_pct / 100);
  const totalCost = material + ueLabour + cfg.container_cost + cfg.scaffold_cost + provision;
  const tb = revenue - totalCost;
  return {
    revenueExVat: revenue,
    material,
    ueLabour,
    container: cfg.container_cost,
    scaffold: cfg.scaffold_cost,
    provision,
    totalCost,
    tb,
    tbPct: revenue > 0 ? (tb / revenue) * 100 : 0,
  };
}
