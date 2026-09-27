import { describe, expect, it } from "vitest";
import { DEFAULT_UE_PRICE_LIST, parseUePriceList, suggestUePrice } from "@/lib/ue-price-list";

describe("suggestUePrice (förslag ur Bilaga 1-utkastet, inget bindande)", () => {
  it("räknar exempel-villan (150 m² betong, 1 våning, 2 ränndalar à 6 m, 1 skorsten)", () => {
    const r = suggestUePrice(
      { roofAreaKvm: 150, materialKey: "betongpannor", ranndalarMeter: 12, items: { skorstensinkladnad: 1 } },
      DEFAULT_UE_PRICE_LIST,
    );
    // 150 × 450 + 2 × 1500 + 3500 = 74 000 kr
    expect(r.total).toBe(74000);
    expect(r.lines).toHaveLength(3);
  });
  it("komplext tak (pannor) använder komplext-priset i stället för materialpriset", () => {
    const r = suggestUePrice({ roofAreaKvm: 100, materialKey: "betongpannor", isComplex: true }, DEFAULT_UE_PRICE_LIST);
    expect(r.total).toBe(60000); // 600 kr/m² × 100
  });
  it("komplext tak påverkar INTE plåtmoment (bandtäckning är alltid plåtslagarens kvm-pris)", () => {
    const r = suggestUePrice({ roofAreaKvm: 100, materialKey: "platt_bandtackning", isComplex: true }, DEFAULT_UE_PRICE_LIST);
    expect(r.total).toBe(100 * 750);
  });
  it("komplext tak påverkar INTE papptak (inget eget komplext-pris i Bilaga 1)", () => {
    const r = suggestUePrice({ roofAreaKvm: 100, materialKey: "papptak", isComplex: true }, DEFAULT_UE_PRICE_LIST);
    expect(r.total).toBe(100 * 300);
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
    const r = suggestUePrice({ roofAreaKvm: 80, materialKey: "platt_bandtackning" }, DEFAULT_UE_PRICE_LIST);
    expect(r.total).toBe(80 * 750);
  });
  it("ränndalar avrundas uppåt, inte underskattas (2 st à 4 m = 8 m ska ge 2 st, inte 1)", () => {
    const r = suggestUePrice({ roofAreaKvm: null, materialKey: null, ranndalarMeter: 8 }, DEFAULT_UE_PRICE_LIST);
    expect(r.total).toBe(2 * 1500);
  });
  it("riktig kalkylrad (price_list-nycklar): papptak + fotplåt + snörasskydd", () => {
    const r = suggestUePrice(
      { roofAreaKvm: 50, materialKey: "papptak", items: { fotplat_meter: 10, snorasskydd_meter: 6 } },
      DEFAULT_UE_PRICE_LIST,
    );
    // 50×300 + 10×70 + 6×100 = 15 000 + 700 + 600 = 16 300
    expect(r.total).toBe(16300);
    expect(r.lines).toHaveLength(3);
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
    const custom = { ...DEFAULT_UE_PRICE_LIST, taklaggare: { ...DEFAULT_UE_PRICE_LIST.taklaggare, per_material_kvm: { betongpannor: 460 } } };
    expect(parseUePriceList(custom).taklaggare.per_material_kvm.betongpannor).toBe(460);
  });
});
