import { describe, expect, it } from "vitest";
import { isWithinOpeningHours, nextOpeningTime, slaDeadline } from "@/lib/opening-hours";

// 2026-09-28 är en måndag. Stockholm är UTC+2 (sommartid) i september.
const MON_12_LOCAL = new Date("2026-09-28T10:00:00Z"); // 12:00 lokal tid, måndag
const MON_22_LOCAL = new Date("2026-09-28T20:00:00Z"); // 22:00 lokal tid, måndag (stängt)
const MON_06_LOCAL = new Date("2026-09-28T04:00:00Z"); // 06:00 lokal tid, måndag (stängt)
const SAT_08_LOCAL = new Date("2026-10-03T06:00:00Z"); // 08:00 lokal tid, lördag (stängt, öppnar 09)
const SAT_12_LOCAL = new Date("2026-10-03T10:00:00Z"); // 12:00 lokal tid, lördag (öppet)

describe("isWithinOpeningHours", () => {
  it("vardag 07-20 är öppet, utanför är stängt", () => {
    expect(isWithinOpeningHours(MON_12_LOCAL)).toBe(true);
    expect(isWithinOpeningHours(MON_22_LOCAL)).toBe(false);
    expect(isWithinOpeningHours(MON_06_LOCAL)).toBe(false);
  });
  it("helg 09-19 är öppet, utanför är stängt", () => {
    expect(isWithinOpeningHours(SAT_12_LOCAL)).toBe(true);
    expect(isWithinOpeningHours(SAT_08_LOCAL)).toBe(false);
  });
});

describe("nextOpeningTime", () => {
  it("returnerar samma tidpunkt om redan öppet", () => {
    expect(nextOpeningTime(MON_12_LOCAL).getTime()).toBe(MON_12_LOCAL.getTime());
  });
  it("måndag 22:00 -> tisdag 07:00", () => {
    const next = nextOpeningTime(MON_22_LOCAL);
    expect(next.toISOString()).toBe("2026-09-29T05:00:00.000Z"); // tis 07:00 lokal
  });
  it("lördag 08:00 -> lördag 09:00 (samma dag, öppnar snart)", () => {
    const next = nextOpeningTime(SAT_08_LOCAL);
    expect(next.toISOString()).toBe("2026-10-03T07:00:00.000Z"); // lör 09:00 lokal
  });
});

describe("slaDeadline", () => {
  it("under öppettid: räknas direkt från förfrågan", () => {
    const d = slaDeadline(MON_12_LOCAL, 1);
    expect(d.getTime()).toBe(MON_12_LOCAL.getTime() + 3600000);
  });
  it("utanför öppettid: räknas från nästa öppning, inte från förfrågningstillfället", () => {
    const d = slaDeadline(MON_22_LOCAL, 1);
    expect(d.toISOString()).toBe("2026-09-29T06:00:00.000Z"); // tis 07:00 + 1h lokal
  });
});
