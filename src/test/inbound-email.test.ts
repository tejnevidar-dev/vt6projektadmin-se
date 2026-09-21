import { describe, expect, it } from "vitest";
import {
  bodyText,
  displayNameFor,
  escapeLike,
  extractPhone,
  htmlToText,
  normalizeHeaders,
  parseAddress,
  shouldSkipEmail,
} from "@/lib/inbound-email";

describe("parseAddress", () => {
  it("läser namn och adress", () => {
    expect(parseAddress('"Anna Svensson" <Anna@Exempel.se>')).toEqual({ name: "Anna Svensson", email: "anna@exempel.se" });
    expect(parseAddress("Anna <anna@exempel.se>")).toEqual({ name: "Anna", email: "anna@exempel.se" });
  });
  it("läser blotta adresser och avvisar skräp", () => {
    expect(parseAddress("anna@exempel.se")).toEqual({ name: null, email: "anna@exempel.se" });
    expect(parseAddress("inte en adress")).toBeNull();
    expect(parseAddress(undefined)).toBeNull();
  });
});

describe("shouldSkipEmail", () => {
  const real = parseAddress("Kund <kund@gmail.com>");
  it("släpper igenom vanliga mail", () => {
    expect(shouldSkipEmail(real, {})).toBeNull();
  });
  it("hoppar över egna domäner", () => {
    expect(shouldSkipEmail(parseAddress("info@roslagstak.se"), {})).toBe("egen_doman");
    expect(shouldSkipEmail(parseAddress("x@notify.vt6projektadmin.se"), {})).toBe("egen_doman");
  });
  it("hoppar över automatmail", () => {
    expect(shouldSkipEmail(parseAddress("noreply@foretag.se"), {})).toBe("automatisk_avsandare");
    expect(shouldSkipEmail(real, { "auto-submitted": "auto-replied" })).toBe("auto_submitted");
    expect(shouldSkipEmail(real, { precedence: "bulk" })).toBe("massutskick");
    expect(shouldSkipEmail(real, { "list-unsubscribe": "<mailto:x@y.se>" })).toBe("nyhetsbrev");
    expect(shouldSkipEmail(null, {})).toBe("ingen_giltig_avsandare");
  });
  it("tar auto-submitted: no som vanligt mail", () => {
    expect(shouldSkipEmail(real, { "auto-submitted": "no" })).toBeNull();
  });
});

describe("normalizeHeaders", () => {
  it("hanterar både objekt och lista", () => {
    expect(normalizeHeaders({ "Auto-Submitted": "no" })).toEqual({ "auto-submitted": "no" });
    expect(normalizeHeaders([{ name: "Precedence", value: "bulk" }])).toEqual({ precedence: "bulk" });
    expect(normalizeHeaders(null)).toEqual({});
  });
});

describe("extractPhone", () => {
  it("hittar svenska nummer", () => {
    expect(extractPhone("Ring mig på 070-154 36 39 tack")).toBe("070-154 36 39");
    expect(extractPhone("Mobil: +46 70 123 45 67")).toBe("+46 70 123 45 67");
    expect(extractPhone("08-123 456 78")).toBe("08-123 456 78");
  });
  it("ger null utan nummer", () => {
    expect(extractPhone("Hej, jag vill ha offert på nytt tak 2026.")).toBeNull();
  });
});

describe("övrigt", () => {
  it("gör namn av adress när visningsnamn saknas", () => {
    expect(displayNameFor({ name: null, email: "anna.svensson@x.se" })).toBe("Anna Svensson");
    expect(displayNameFor({ name: "Bosse", email: "b@x.se" })).toBe("Bosse");
  });
  it("gör text av html", () => {
    expect(htmlToText("<p>Hej&nbsp;där</p><style>a{}</style><p>Hälsning</p>")).toBe("Hej där\n Hälsning");
  });
  it("avkortar långa mail", () => {
    expect(bodyText({ text: "x".repeat(5000) }).length).toBeLessThan(4100);
  });
  it("escapar ilike-jokertecken", () => {
    expect(escapeLike("a_b%c@x.se")).toBe("a\\_b\\%c@x.se");
  });
});
