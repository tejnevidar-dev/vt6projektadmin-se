import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  findDuplicate,
  isBusinessHour,
  normalizeEmail,
  parseConfig,
  phoneKey,
  pickSeller,
  safeEqual,
} from "@/lib/lead-intake";

describe("phoneKey", () => {
  it("ger samma nyckel för alla svenska format", () => {
    const k = phoneKey("070-154 36 39");
    expect(k).toBe("701543639");
    expect(phoneKey("+46 70 154 36 39")).toBe(k);
    expect(phoneKey("0046701543639")).toBe(k);
    expect(phoneKey("0701543639")).toBe(k);
  });
  it("avvisar för korta eller tomma nummer", () => {
    expect(phoneKey("123")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe("findDuplicate", () => {
  const leads = [
    { id: "1", email: "Anna@Exempel.se", phone: "070-111 22 33" },
    { id: "2", email: null, phone: "+46 73 999 88 77" },
  ];
  it("matchar på e-post oavsett skiftläge", () => {
    expect(findDuplicate(leads, { email: "anna@exempel.se" })?.id).toBe("1");
  });
  it("matchar på telefon oavsett format", () => {
    expect(findDuplicate(leads, { phone: "0739998877" })?.id).toBe("2");
  });
  it("ger null när inget matchar eller inget anges", () => {
    expect(findDuplicate(leads, { email: "annan@x.se", phone: "0700000000" })).toBeNull();
    expect(findDuplicate(leads, {})).toBeNull();
  });
});

describe("parseConfig / pickSeller", () => {
  it("använder standardvärden för tom konfig", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig({}).slaHours).toBe(2);
  });
  it("läser inställningar och ignorerar skräp", () => {
    const c = parseConfig({
      admin_email: "a@b.se",
      sla_hours: 3,
      default_seller_id: "herman",
      rules: [{ seller_id: "x", match: ["Täby", " "] }, { seller_id: "", match: ["a"] }, 5],
    });
    expect(c.adminEmail).toBe("a@b.se");
    expect(c.slaHours).toBe(3);
    expect(c.rules).toEqual([{ sellerId: "x", match: ["täby"] }]);
  });
  it("routar på område och faller tillbaka på standardsäljaren", () => {
    const c = parseConfig({ default_seller_id: "herman", rules: [{ seller_id: "x", match: ["täby"] }] });
    expect(pickSeller(c, "Storgatan 1, Täby")).toBe("x");
    expect(pickSeller(c, "Norrtälje")).toBe("herman");
    expect(pickSeller(DEFAULT_CONFIG, "vad som helst")).toBeNull();
  });
});

describe("övrigt", () => {
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("öppettider i Stockholmstid", () => {
    expect(isBusinessHour(new Date("2026-09-25T10:00:00Z"))).toBe(true); // 12:00
    expect(isBusinessHour(new Date("2026-09-25T00:30:00Z"))).toBe(false); // 02:30
  });
});

describe("tom e-post (valfri i webbformuläret)", () => {
  const leads = [
    { id: "1", email: "", phone: "070-111 22 33" },
    { id: "2", email: null, phone: "+46 73 999 88 77" },
    { id: "3", email: "anna@exempel.se", phone: null },
  ];
  it("normalizeEmail gör tom och blank sträng till null", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail(" Anna@Exempel.se ")).toBe("Anna@Exempel.se");
  });
  it("matchar aldrig på tom eller null e-post", () => {
    // Inkommande utan e-post får inte matcha befintliga leads som saknar e-post.
    expect(findDuplicate(leads, { email: "", phone: "0700000000" })).toBeNull();
    expect(findDuplicate(leads, { email: null, phone: null })).toBeNull();
    expect(findDuplicate(leads, { email: "   " })).toBeNull();
  });
  it("matchar på telefon när e-post saknas", () => {
    expect(findDuplicate(leads, { email: "", phone: "0739998877" })?.id).toBe("2");
  });
});
