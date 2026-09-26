import { describe, expect, it } from "vitest";
import { isTestRow, toPayload } from "../../scripts/rescue-missed-quotes";

describe("rescue-missed-quotes", () => {
  it("hoppar över testrader", () => {
    expect(isTestRow({ id: "1", name: "TEST Testsson", phone: "070 111 22 33", email: "a@b.se" })).toBe(true);
    expect(isTestRow({ id: "2", name: "Anna", phone: "070 111 22 33", email: "x@example.com" })).toBe(true);
    expect(isTestRow({ id: "3", name: "Anna", phone: "0000000000", email: "a@b.se" })).toBe(true);
    expect(isTestRow({ id: "4", name: "Anna Svensson", phone: "070 111 22 33", email: "anna@gmail.com" })).toBe(false);
    expect(isTestRow({ id: "5", name: "Testamentet AB", phone: "070 111 22 33", email: "" })).toBe(false);
  });
  it("bygger payload med samma id som sajten och noteringen först i meddelandet", () => {
    const p = toPayload({ id: "abc", mode: "configure", name: " Anna ", phone: "070", email: "", message: "Hej", created_at: "2026-09-10T08:30:12Z" });
    expect(p.id).toBe("abc");
    expect(p.mode).toBe("configure");
    expect(p.email).toBe("");
    expect(p.message.startsWith("Missad förfrågan från sajten")).toBe(true);
    expect(p.message).toContain("Hej");
    expect(p.message).toContain("2026-09-10 08:30");
  });
  it("okänt läge blir consultation", () => {
    expect(toPayload({ id: "x", mode: null, name: "A", phone: "1" }).mode).toBe("consultation");
  });
});

describe("rescue via lead-inbox", () => {
  it("använder samma external_id som webhooken och tom e-post blir null", async () => {
    const { toInboxPayload } = await import("../../scripts/rescue-missed-quotes");
    const p = toInboxPayload({ id: "abc", name: "Anna", phone: "070", email: "", message: "Hej" });
    expect(p.external_id).toBe("roslagstak:abc");
    expect(p.email).toBeNull();
    expect(p.as_website).toBe(true);
    expect(p.message.startsWith("Missad förfrågan från sajten")).toBe(true);
  });
});
