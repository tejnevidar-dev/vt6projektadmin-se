import { describe, expect, it } from "vitest";
import { DEFAULT_UE_PRICE_LIST, parseUePriceList, suggestUePrice } from "@/lib/ue-price-list";

describe("suggestUePrice (förslag ur Bilaga 1-utkastet, inget bindande)", () => {
  it("räknar exempel-villan i utkastet (150 m² betong, 1 våning, 2 ränndalar à 6 m, 1 skorsten)", () => {
    const r = suggestUePrice(
      { roofAreaKvm: 150, materialKey: "betongpannor", ranndalarMeter: 12, items: { skorstensinklädnad: 1 } },
      DEFAULT_UE_PRICE_LIST,
    );
    // 150 × 400 + 2 × 1500 + 3500 = 66 500 kr (utkastets räkneexempel)
    expect(r.total).toBe(66500);
    expect(r.lines).toHaveLength(3);
  });
  it("komplext tak använder komplext-priset i stället för materialpriset", () => {
    const r = suggestUePrice({ roofAreaKvm: 100, materialKey: "betongpannor", isComplex: true }, DEFAULT_UE_PRICE_LIST);
    expect(r.total).toBe(52000); // 520 kr/m² × 100
  });
  it("2 och 3+ våningar ger påslag på materialraden", () => {
    const one = suggestUePrice({ roofAreaKvm: 100, materialKey: "betongpannor" }, DEFAULT_UE_PRICE_LIST).total;
    const two = suggestUePrice({ roofAreaKvm: 100, materialKey: "betongpannor", storeys: 2 }, DEFAULT_UE_PRICE_LIST).total;
    const three = suggestUePrice({ roofAreaKvm: 100, materialKey: "betongpannor", storeys: 3 }, DEFAULT_UE_PRICE_LIST).total;
    expect(two).toBe(Math.round(one * 1.1));
    expect(three).toBe(Math.round(one * 1.2));
  });
  it("okänd materialnyckel gissar inget pris (ingen rad)", () => {
    expect(suggestUePrice({ roofAreaKvm: 100, materialKey: "okant_material" }, DEFAULT_UE_PRICE_LIST).lines).toHaveLength(0);
  });
  it("plåtmoment (bandtäckning) räknas per kvm i platslagare-listan", () => {
    const r = suggestUePrice({ roofAreaKvm: 80, materialKey: "plat_bandtackning" }, DEFAULT_UE_PRICE_LIST);
    expect(r.total).toBe(80 * 650);
  });
  it("tomt underlag ger 0 utan fel", () => {
    expect(suggestUePrice({ roofAreaKvm: null, materialKey: null }, DEFAULT_UE_PRICE_LIST)).toEqual({ lines: [], total: 0 });
  });
});

describe("parseUePriceList", () => {
  it("faller tillbaka på standardlistan om config saknas", () => {
    expect(parseUePriceList(null)).toEqual(DEFAULT_UE_PRICE_LIST);
    expect(parseUePriceList(undefined)).toEqual(DEFAULT_UE_PRICE_LIST);
  });
  it("läser en riktig config", () => {
    const custom = { ...DEFAULT_UE_PRICE_LIST, taklaggare: { ...DEFAULT_UE_PRICE_LIST.taklaggare, per_material_kvm: { betongpannor: 450 } } };
    expect(parseUePriceList(custom).taklaggare.per_material_kvm.betongpannor).toBe(450);
  });
});
