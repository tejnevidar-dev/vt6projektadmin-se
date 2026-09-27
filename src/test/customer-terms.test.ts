import { describe, expect, it } from "vitest";
import { EMPTY_CUSTOMER_TERMS, isCustomerTermsReady, missingAcks, parseCustomerTerms } from "@/lib/customer-terms";

describe("parseCustomerTerms", () => {
  it("faller tillbaka på det tomma/inaktiva scaffoldet om config saknas", () => {
    expect(parseCustomerTerms(null)).toEqual(EMPTY_CUSTOMER_TERMS);
    expect(parseCustomerTerms(undefined)).toEqual(EMPTY_CUSTOMER_TERMS);
  });
  it("läser en riktig config", () => {
    const cfg = parseCustomerTerms({ active: true, version: "v1", angerratt_text: "x" });
    expect(cfg.active).toBe(true);
    expect(cfg.version).toBe("v1");
    expect(cfg.angerratt_text).toBe("x");
    expect(cfg.byggherreansvar_text).toBeNull();
  });
});

describe("isCustomerTermsReady", () => {
  it("falskt för dagens scaffold (allt tomt/inaktivt)", () => {
    expect(isCustomerTermsReady(EMPTY_CUSTOMER_TERMS)).toBe(false);
  });
  it("falskt om texterna finns men active är false (Vidar har inte godkänt)", () => {
    const cfg = parseCustomerTerms({
      active: false,
      version: "v1",
      angerratt_text: "a",
      byggherreansvar_text: "b",
      garanti_text: "c",
      angerblankett_text: "d",
      ack_labels: { angerratt: "Jag har läst ångerrätten" },
    });
    expect(isCustomerTermsReady(cfg)).toBe(false);
  });
  it("falskt om en enda text saknas trots active:true", () => {
    const cfg = parseCustomerTerms({
      active: true,
      version: "v1",
      angerratt_text: "a",
      byggherreansvar_text: "b",
      garanti_text: null,
      angerblankett_text: "d",
      ack_labels: { angerratt: "x" },
    });
    expect(isCustomerTermsReady(cfg)).toBe(false);
  });
  it("falskt om inga ack_labels är definierade trots att texterna finns", () => {
    const cfg = parseCustomerTerms({
      active: true,
      version: "v1",
      angerratt_text: "a",
      byggherreansvar_text: "b",
      garanti_text: "c",
      angerblankett_text: "d",
      ack_labels: {},
    });
    expect(isCustomerTermsReady(cfg)).toBe(false);
  });
  it("sant när allt är på plats", () => {
    const cfg = parseCustomerTerms({
      active: true,
      version: "v1",
      angerratt_text: "a",
      byggherreansvar_text: "b",
      garanti_text: "c",
      angerblankett_text: "d",
      ack_labels: { angerratt: "x", byggherreansvar: "y", garanti: "z" },
    });
    expect(isCustomerTermsReady(cfg)).toBe(true);
  });
});

describe("missingAcks", () => {
  const cfg = parseCustomerTerms({ ack_labels: { angerratt: "x", byggherreansvar: "y", garanti: "z" } });
  it("listar alla nycklar om inget är ikryssat", () => {
    expect(missingAcks(cfg, null)).toEqual(["angerratt", "byggherreansvar", "garanti"]);
    expect(missingAcks(cfg, undefined)).toEqual(["angerratt", "byggherreansvar", "garanti"]);
  });
  it("listar bara det som saknas", () => {
    expect(missingAcks(cfg, { angerratt: true, byggherreansvar: false })).toEqual(["byggherreansvar", "garanti"]);
  });
  it("tom lista när allt är ikryssat", () => {
    expect(missingAcks(cfg, { angerratt: true, byggherreansvar: true, garanti: true })).toEqual([]);
  });
  it("inga krav om ack_labels är tomt", () => {
    expect(missingAcks(EMPTY_CUSTOMER_TERMS, {})).toEqual([]);
  });
});
