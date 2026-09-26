import { describe, expect, it } from "vitest";
import { computeMargin, DEFAULT_MARGIN_CONFIG, parseMarginConfig } from "@/lib/margin";

describe("computeMargin (standardtak 150 m2 betong)", () => {
  const r = computeMargin({ exVat: 204000, materialSum: 69000, areaKvm: 150 }, DEFAULT_MARGIN_CONFIG);
  it("räknar kostnader och TB", () => {
    expect(r.ueLabour).toBe(67500);
    expect(r.provision).toBeCloseTo(6120, 5);
    expect(r.container).toBe(7000);
    expect(r.material).toBe(69000);
    expect(r.tb).toBeCloseTo(204000 - 69000 - 67500 - 7000 - 0 - 6120, 5);
    expect(Math.round(r.tbPct * 10) / 10).toBe(26.7);
  });
  it("materialmarginal höjer TB", () => {
    const m = computeMargin({ exVat: 204000, materialSum: 69000, areaKvm: 150 }, { ...DEFAULT_MARGIN_CONFIG, material_cost_pct: 80 });
    expect(m.tb - r.tb).toBeCloseTo(13800, 5);
  });
  it("noll intäkt ger 0 procent utan att dela med noll", () => {
    expect(computeMargin({ exVat: 0, materialSum: 0, areaKvm: 0 }, DEFAULT_MARGIN_CONFIG).tbPct).toBe(0);
  });
});

describe("parseMarginConfig", () => {
  it("faller tillbaka på standardvärden vid saknad eller ogiltig konfiguration", () => {
    expect(parseMarginConfig(null)).toEqual(DEFAULT_MARGIN_CONFIG);
    expect(parseMarginConfig({ container_cost: "x", provision_pct: -1 })).toEqual(DEFAULT_MARGIN_CONFIG);
  });
  it("läser giltiga värden", () => {
    expect(parseMarginConfig({ container_cost: 9000, scaffold_cost: 4000 }).container_cost).toBe(9000);
    expect(parseMarginConfig({ scaffold_cost: 4000 }).scaffold_cost).toBe(4000);
  });
});
