import { describe, expect, it } from "vitest";
import { fillUeAgreement, hasUnresolvedPlaceholders, UE_AGREEMENT_BODY_SV } from "@/lib/ue-agreement-text";

const FIELDS = { companyName: "Tak & Plåt AB", orgNumber: "556123-4567", country: "Sverige", address: "Storgatan 1, Norrtälje", vatNumber: "SE556123456701" };

describe("fillUeAgreement", () => {
  it("ersätter alla UE-specifika platshållare", () => {
    const filled = fillUeAgreement(FIELDS);
    expect(filled).toContain("Tak & Plåt AB, org.nr/reg.nr 556123-4567, Sverige, Storgatan 1, Norrtälje, momsreg.nr SE556123456701");
    expect(filled).not.toContain("{{");
  });
  it("faller tillbaka på momsnr = orgnr om momsnr saknas", () => {
    const filled = fillUeAgreement({ ...FIELDS, vatNumber: null });
    expect(filled).toContain("momsreg.nr 556123-4567");
  });
  it("markerar saknade fält tydligt istället för att gissa", () => {
    const filled = fillUeAgreement({ companyName: "X", orgNumber: null, country: "Sverige", address: null, vatNumber: null });
    expect(filled).toContain("[ej angivet]");
  });
});

describe("hasUnresolvedPlaceholders", () => {
  it("sant för den ifyllda källtexten idag (BESLUT-punkter kvar - v2.0 är inte klar att signera)", () => {
    expect(hasUnresolvedPlaceholders(fillUeAgreement(FIELDS))).toBe(true);
  });
  it("falskt när alla hakparenteser är borta", () => {
    const clean = UE_AGREEMENT_BODY_SV.replace(/\[[^\]]*\]/g, "X").replaceAll("{{FIRMA}}", "Y").replaceAll("{{ORGNR}}", "Y").replaceAll("{{LAND}}", "Y").replaceAll("{{ADRESS}}", "Y").replaceAll("{{MOMSNR}}", "Y");
    expect(hasUnresolvedPlaceholders(clean)).toBe(false);
  });
});
