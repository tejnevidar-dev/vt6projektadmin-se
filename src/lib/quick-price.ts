import { supabase } from "@/integrations/supabase/client";

export type QuickService = "takbyte" | "taktvatt";
export type QuickKind = "material" | "arbete" | "tillval" | "svarighet" | "lutning";
export type QuickUnit = "kvm" | "st" | "procent" | "fast" | "lpm";

export interface QuickPriceItem {
  id: string;
  service: QuickService;
  kind: QuickKind;
  key: string;
  label: string;
  unit: QuickUnit;
  unit_price: number;
  is_active: boolean;
  sort_order: number;
}

export interface QuickPriceSettings {
  id: number;
  moms_procent: number;
  rot_procent: number;
  rot_tak_per_agare: number;
  taktvatt_min_pris: number;
}

export const DEFAULT_SETTINGS: QuickPriceSettings = {
  id: 1,
  moms_procent: 25,
  rot_procent: 30,
  rot_tak_per_agare: 50000,
  taktvatt_min_pris: 12000,
};

export async function fetchQuickPriceItems(): Promise<QuickPriceItem[]> {
  const { data, error } = await supabase
    .from("quick_price_items" as any)
    .select("*")
    .order("service", { ascending: true })
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as QuickPriceItem[];
}

export async function fetchQuickPriceSettings(): Promise<QuickPriceSettings> {
  const { data, error } = await supabase
    .from("quick_price_settings" as any)
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return ((data as unknown as QuickPriceSettings) ?? DEFAULT_SETTINGS);
}

export async function updateQuickPriceSettings(
  patch: Partial<Omit<QuickPriceSettings, "id">>,
): Promise<void> {
  const { error } = await supabase
    .from("quick_price_settings" as any)
    .update(patch as any)
    .eq("id", 1);
  if (error) throw error;
}

export type QuickPriceItemInput = Omit<QuickPriceItem, "id">;

export async function createQuickPriceItem(input: QuickPriceItemInput): Promise<void> {
  const { error } = await supabase.from("quick_price_items" as any).insert(input as any);
  if (error) throw error;
}

export async function updateQuickPriceItem(
  id: string,
  patch: Partial<QuickPriceItemInput>,
): Promise<void> {
  const { error } = await supabase
    .from("quick_price_items" as any)
    .update(patch as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteQuickPriceItem(id: string): Promise<void> {
  const { error } = await supabase.from("quick_price_items" as any).delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Prisberäkning – ren funktion, ingen I/O                             */
/* ------------------------------------------------------------------ */

export interface QuickPriceInput {
  service: QuickService;
  areaKvm: number;
  materialKey: string | null;
  arbeteKey: string | null;
  svarighetKey: string | null;
  lutningKey: string | null;
  /** valda tillval: key -> antal (st/lpm) eller 1 (kvm-baserade) */
  tillval: Record<string, number>;
  rot: boolean;
  antalAgare: number;
  /** manuell rabatt i kronor (ex moms) */
  rabatt: number;
}

export interface QuickPriceLine {
  key: string;
  label: string;
  detail: string;
  amount: number;
  isLabor: boolean;
}

export interface QuickPriceResult {
  lines: QuickPriceLine[];
  materialSum: number;
  laborSum: number;
  tillaggSum: number;
  svarighetProcent: number;
  svarighetAmount: number;
  lutningProcent: number;
  lutningAmount: number;
  minimumApplied: boolean;
  rabatt: number;
  exMoms: number;
  moms: number;
  total: number;
  rotBelopp: number;
  attBetala: number;
}

export function emptyQuickInput(service: QuickService = "takbyte"): QuickPriceInput {
  return {
    service,
    areaKvm: 0,
    materialKey: null,
    arbeteKey: null,
    svarighetKey: null,
    lutningKey: null,
    tillval: {},
    rot: true,
    antalAgare: 1,
    rabatt: 0,
  };
}

export function computeQuickPrice(
  input: QuickPriceInput,
  items: QuickPriceItem[],
  settings: QuickPriceSettings,
): QuickPriceResult {
  const active = items.filter((i) => i.is_active && i.service === input.service);
  const byKey = new Map(active.map((i) => [i.key, i]));
  const area = Math.max(0, input.areaKvm);
  const lines: QuickPriceLine[] = [];

  let materialSum = 0;
  let laborSum = 0;
  let tillaggSum = 0;

  const materialItem = input.materialKey ? byKey.get(input.materialKey) : null;
  if (materialItem && area > 0) {
    const amount = materialItem.unit_price * area;
    // Taktvätt: grundpriset är arbete (ROT-grundande), takbyte: material
    if (input.service === "taktvatt") laborSum += amount;
    else materialSum += amount;
    lines.push({
      key: materialItem.key,
      label: materialItem.label,
      detail: `${area} kvm × ${materialItem.unit_price} kr`,
      amount,
      isLabor: input.service === "taktvatt",
    });
  }

  const arbeteItem = input.arbeteKey ? byKey.get(input.arbeteKey) : null;
  if (arbeteItem && area > 0) {
    const amount = arbeteItem.unit_price * area;
    laborSum += amount;
    lines.push({
      key: arbeteItem.key,
      label: arbeteItem.label,
      detail: `${area} kvm × ${arbeteItem.unit_price} kr`,
      amount,
      isLabor: true,
    });
  }

  for (const [key, qty] of Object.entries(input.tillval)) {
    const item = byKey.get(key);
    if (!item || qty <= 0) continue;
    const units = item.unit === "kvm" ? area : qty;
    if (units <= 0) continue;
    const amount = item.unit_price * units;
    tillaggSum += amount;
    lines.push({
      key: item.key,
      label: item.label,
      detail:
        item.unit === "kvm"
          ? `${area} kvm × ${item.unit_price} kr`
          : `${qty} ${item.unit} × ${item.unit_price} kr`,
      amount,
      // tillval räknas till hälften som arbete (schablon) för ROT
      isLabor: false,
    });
  }

  // Lutning 35+ – påslag på arbete
  const lutningItem = input.lutningKey ? byKey.get(input.lutningKey) : null;
  const lutningProcent = lutningItem ? lutningItem.unit_price : 0;
  const lutningAmount = laborSum * (lutningProcent / 100);

  const svarighetItem = input.svarighetKey ? byKey.get(input.svarighetKey) : null;
  const svarighetProcent = svarighetItem ? svarighetItem.unit_price : 0;

  let base = materialSum + laborSum + lutningAmount + tillaggSum;
  const svarighetAmount = base * (svarighetProcent / 100);
  base += svarighetAmount;

  let minimumApplied = false;
  if (input.service === "taktvatt" && base > 0 && base < settings.taktvatt_min_pris) {
    base = settings.taktvatt_min_pris;
    minimumApplied = true;
  }

  const rabatt = Math.max(0, Math.min(input.rabatt || 0, base));
  const exMoms = Math.max(0, base - rabatt);
  const moms = exMoms * (settings.moms_procent / 100);
  const total = exMoms + moms;

  // ROT: 30 % av arbetskostnaden inkl. moms, tak per ägare
  let rotBelopp = 0;
  if (input.rot && exMoms > 0) {
    const preScale = materialSum + laborSum + lutningAmount + tillaggSum;
    const laborShare = preScale > 0 ? (laborSum + lutningAmount + tillaggSum * 0.5) / preScale : 0;
    const laborInclVat = exMoms * laborShare * (1 + settings.moms_procent / 100);
    rotBelopp = Math.min(
      laborInclVat * (settings.rot_procent / 100),
      settings.rot_tak_per_agare * Math.max(1, input.antalAgare),
    );
  }

  return {
    lines,
    materialSum,
    laborSum,
    tillaggSum,
    svarighetProcent,
    svarighetAmount,
    lutningProcent,
    lutningAmount,
    minimumApplied,
    rabatt,
    exMoms: Math.round(exMoms),
    moms: Math.round(moms),
    total: Math.round(total),
    rotBelopp: Math.round(rotBelopp),
    attBetala: Math.round(total - rotBelopp),
  };
}

export function formatKr(v: number): string {
  return `${Math.round(v).toLocaleString("sv-SE")} kr`;
}
