// Pure calculation engine — used by both the live UI (client) and the
// PDF generator (server). Håll beroenden minimala (endast rena hjälpmoduler).
import { computeRot } from "@/lib/rot";

export type PriceCategory = "material" | "arbete" | "plat" | "tillagg";
export type PriceUnit = "kvm" | "meter" | "st" | "timme" | "paket";

export interface PriceRow {
  id: string;
  category: PriceCategory;
  key: string;
  label: string;
  unit: PriceUnit;
  unit_price: number;
  is_active: boolean;
  sort_order: number;
}

export interface PlatItem {
  key: string;         // ref price_list.key
  quantity: number;
}

export interface TillaggRow {
  label: string;
  quantity: number;
  unit_price: number;
}

export interface CalcInput {
  roofAreaKvm: number;
  materialKey: string | null;
  ranndalarMeter: number;
  platItems: PlatItem[];
  tillagg: TillaggRow[];
  arbeteTimmar: number;
  arbeteTimpris: number;
  marginalProcent: number;
  rotAvdrag: boolean;
  /** Antal ägare som kan nyttja ROT (styr taket). Standard 1. */
  antalAgare?: number;
}

export interface CalcLineItem {
  category: PriceCategory | "tillagg";
  label: string;
  quantity: number;
  unit: PriceUnit | string;
  unitPrice: number;
  amount: number; // exkl. moms, exkl. marginal
}

export interface CalcResult {
  lines: CalcLineItem[];
  materialSum: number;
  platSum: number;
  tillaggSum: number;
  arbeteSum: number;
  subtotalPreMargin: number;   // summa exkl. moms, före marginal
  marginalAmount: number;      // marginal-tillägg
  subtotal: number;            // exkl. moms efter marginal
  moms: number;                // 25 %
  total: number;               // inkl. moms
  rotBelopp: number;           // ROT-avdrag (gemensam formel, se lib/rot.ts)
  attBetala: number;           // total - rot
}

const MOMS = 0.25;

export function computeCalc(input: CalcInput, priceRows: PriceRow[]): CalcResult {
  const byKey = new Map(priceRows.map((r) => [r.key, r]));
  const lines: CalcLineItem[] = [];

  // Material
  let materialSum = 0;
  if (input.materialKey && input.roofAreaKvm > 0) {
    const row = byKey.get(input.materialKey);
    if (row) {
      const amount = row.unit_price * input.roofAreaKvm;
      materialSum += amount;
      lines.push({
        category: "material",
        label: row.label,
        quantity: input.roofAreaKvm,
        unit: row.unit,
        unitPrice: row.unit_price,
        amount,
      });
    }
  }

  // Plåt – ränndalar (special: separat fält)
  let platSum = 0;
  if (input.ranndalarMeter > 0) {
    const row = byKey.get("ranndalar_meter");
    if (row) {
      const amount = row.unit_price * input.ranndalarMeter;
      platSum += amount;
      lines.push({
        category: "plat",
        label: row.label,
        quantity: input.ranndalarMeter,
        unit: row.unit,
        unitPrice: row.unit_price,
        amount,
      });
    }
  }
  // Plåt – valda checkboxar / kvantiteter
  for (const item of input.platItems) {
    if (!item.key || item.quantity <= 0) continue;
    const row = byKey.get(item.key);
    if (!row) continue;
    const amount = row.unit_price * item.quantity;
    platSum += amount;
    lines.push({
      category: "plat",
      label: row.label,
      quantity: item.quantity,
      unit: row.unit,
      unitPrice: row.unit_price,
      amount,
    });
  }

  // Tillägg – fritextrader
  let tillaggSum = 0;
  for (const t of input.tillagg) {
    if (!t.label.trim() || t.quantity <= 0 || t.unit_price <= 0) continue;
    const amount = t.quantity * t.unit_price;
    tillaggSum += amount;
    lines.push({
      category: "tillagg",
      label: t.label.trim(),
      quantity: t.quantity,
      unit: "st",
      unitPrice: t.unit_price,
      amount,
    });
  }

  // Arbete
  let arbeteSum = 0;
  if (input.arbeteTimmar > 0 && input.arbeteTimpris > 0) {
    arbeteSum = input.arbeteTimmar * input.arbeteTimpris;
    lines.push({
      category: "arbete",
      label: "Takarbete",
      quantity: input.arbeteTimmar,
      unit: "timme",
      unitPrice: input.arbeteTimpris,
      amount: arbeteSum,
    });
  }

  const subtotalPreMargin = materialSum + platSum + tillaggSum + arbeteSum;
  const marginalAmount = subtotalPreMargin * (Math.max(0, input.marginalProcent) / 100);
  const subtotal = subtotalPreMargin + marginalAmount;
  const moms = subtotal * MOMS;
  const total = subtotal + moms;

  // ROT – 30 % av arbetskostnaden inkl. moms (schablon; verklig max 50 000 kr / person / år)
  let rotBelopp = 0;
  if (input.rotAvdrag && arbeteSum > 0) {
    const marginalRatio = subtotalPreMargin > 0 ? arbeteSum / subtotalPreMargin : 0;
    const arbeteInklMarginal = arbeteSum + marginalAmount * marginalRatio;
    const arbeteInklMoms = arbeteInklMarginal * (1 + MOMS);
    rotBelopp = computeRot({ laborInclVat: arbeteInklMoms, owners: input.antalAgare ?? 1 });
  }
  const attBetala = total - rotBelopp;

  return {
    lines,
    materialSum,
    platSum,
    tillaggSum,
    arbeteSum,
    subtotalPreMargin,
    marginalAmount,
    subtotal,
    moms,
    total,
    rotBelopp,
    attBetala,
  };
}

export function formatSek(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
