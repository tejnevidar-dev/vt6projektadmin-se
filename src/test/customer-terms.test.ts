import { describe, expect, it } from "vitest";
import {
  computeWithdrawalDates,
  EMPTY_CUSTOMER_TERMS,
  isVillkorReady,
  isWithdrawalReady,
  parseCustomerTerms,
  resolveCustomerTermsMode,
} from "@/lib/customer-terms";

const WITHDRAWAL_RAW = {
  withdrawal_active: true,
  withdrawal_version: "1.0",
  angerratt_text: "Du har 14 dagars ångerrätt...",
  angerblankett_text: "Jag meddelar härmed...",
  ack_withdrawal_label: "Jag har tagit del av informationen om ångerrätt...",
  early_start_checkbox_text: "Jag begär att arbetet får börja...",
  early_start_confirmed_sentence: "Ångerfristen går ut {datum}.",
};

const VILLKOR_RAW = {
  villkor_active: true,
  villkor_version: "1.0",
  allmanna_villkor_text: "Allmänna villkor...",
  ack_full_label: "Jag har tagit del av offerten, de allmänna villkoren och informationen om ångerrätt...",
};

describe("parseCustomerTerms", () => {
  it("faller tillbaka på det tomma/inaktiva scaffoldet om config saknas", () => {
    expect(parseCustomerTerms(null)).toEqual(EMPTY_CUSTOMER_TERMS);
    expect(parseCustomerTerms(undefined)).toEqual(EMPTY_CUSTOMER_TERMS);
  });
  it("läser en riktig config", () => {
    const cfg = parseCustomerTerms({ withdrawal_active: true, withdrawal_version: "1.0", angerratt_text: "x" });
    expect(cfg.withdrawal_active).toBe(true);
    expect(cfg.angerratt_text).toBe("x");
    expect(cfg.allmanna_villkor_text).toBeNull();
  });
});

describe("isWithdrawalReady", () => {
  it("falskt för dagens scaffold", () => {
    expect(isWithdrawalReady(EMPTY_CUSTOMER_TERMS)).toBe(false);
  });
  it("falskt om texterna finns men active är false", () => {
    expect(isWithdrawalReady(parseCustomerTerms({ ...WITHDRAWAL_RAW, withdrawal_active: false }))).toBe(false);
  });
  it("falskt om en text fortfarande har en [BESLUT K4]-platshållare kvar", () => {
    expect(
      isWithdrawalReady(parseCustomerTerms({ ...WITHDRAWAL_RAW, angerratt_text: "...meddela oss på [postadress – BESLUT K4]..." })),
    ).toBe(false);
  });
  it("sant när allt ångerrätts-innehåll är på plats", () => {
    expect(isWithdrawalReady(parseCustomerTerms(WITHDRAWAL_RAW))).toBe(true);
  });
});

describe("isVillkorReady", () => {
  it("falskt så länge K1/K2/K3/K5 inte är beslutade (kvarvarande [BESLUT ...])", () => {
    expect(isVillkorReady(parseCustomerTerms({ ...VILLKOR_RAW, allmanna_villkor_text: "...[BESLUT K1: betalningsplan]..." }))).toBe(false);
  });
  it("sant när allmänna villkor är kompletta", () => {
    expect(isVillkorReady(parseCustomerTerms(VILLKOR_RAW))).toBe(true);
  });
});

describe("resolveCustomerTermsMode", () => {
  it("'none' när inget är redo (dagens läge)", () => {
    expect(resolveCustomerTermsMode(EMPTY_CUSTOMER_TERMS)).toBe("none");
  });
  it("'withdrawal_only' när bara ångerrätt är redo (allmänna villkor väntar på K1-K5)", () => {
    expect(resolveCustomerTermsMode(parseCustomerTerms(WITHDRAWAL_RAW))).toBe("withdrawal_only");
  });
  it("'withdrawal_only' om bara villkor är redo men inte ångerrätt (aldrig 'villkor_only')", () => {
    expect(resolveCustomerTermsMode(parseCustomerTerms(VILLKOR_RAW))).toBe("none");
  });
  it("'full' bara när båda blocken OCH den kombinerade kryssrutetexten är på plats", () => {
    expect(resolveCustomerTermsMode(parseCustomerTerms({ ...WITHDRAWAL_RAW, ...VILLKOR_RAW }))).toBe("full");
  });
  it("stannar på 'withdrawal_only' om ack_full_label saknas trots att båda blocken är redo", () => {
    expect(resolveCustomerTermsMode(parseCustomerTerms({ ...WITHDRAWAL_RAW, ...VILLKOR_RAW, ack_full_label: null }))).toBe(
      "withdrawal_only",
    );
  });
});

describe("computeWithdrawalDates", () => {
  it("ångerfristen går ut 14 dagar efter signering, spärren gäller från dag 15", () => {
    const signedAt = new Date("2026-09-28T10:00:00Z");
    const { withdrawalEndsAt, earliestStartWithoutRequest } = computeWithdrawalDates(signedAt);
    expect(withdrawalEndsAt.toISOString()).toBe("2026-10-12T10:00:00.000Z");
    expect(earliestStartWithoutRequest.toISOString()).toBe("2026-10-13T10:00:00.000Z");
  });
});
