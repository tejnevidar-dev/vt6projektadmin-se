import { describe, expect, it } from "vitest";
import { isOfferDocument, stageAfterSignature } from "@/lib/offer-accepted";

describe("stageAfterSignature", () => {
  it("flyttar tidigare steg till bokad", () => {
    for (const s of ["saljpanel", "mote_genomfort", "offererad", "offert_skickad", "uppfoljning", "forhandling", "forlorad"]) {
      expect(stageAfterSignature(s)).toBe("bokad");
    }
  });
  it("lämnar vunna/pågående/slutförda oförändrade", () => {
    for (const s of ["bokad", "pagaende", "slutford"]) expect(stageAfterSignature(s)).toBeNull();
  });
});

describe("isOfferDocument", () => {
  it("räknar offert och äldre begäran utan typ, inte ÄTA", () => {
    expect(isOfferDocument("offert")).toBe(true);
    expect(isOfferDocument(null)).toBe(true);
    expect(isOfferDocument("ata")).toBe(false);
    expect(isOfferDocument("avtal")).toBe(false);
  });
});
