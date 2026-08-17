import { describe, it, expect } from "vitest";
import { rolesAllowSide, type AppRole } from "@/hooks/use-role";

describe("rolesAllowSide", () => {
  const cases: Array<[AppRole[], "intern" | "extern", boolean]> = [
    [["admin"], "intern", true],
    [["admin"], "extern", true],
    [["saljare"], "extern", true],
    [["saljare"], "intern", false],
    [["hantverkare"], "intern", true],
    [["hantverkare"], "extern", false],
    [["arbetsledare"], "intern", true],
    [["underentreprenor"], "intern", true],
    [["saljare", "hantverkare"], "intern", true],
    [["saljare", "hantverkare"], "extern", true],
    [["viewer"], "intern", false],
    [["viewer"], "extern", false],
    [[], "extern", false],
  ];

  it.each(cases)("roller %j på %s => %s", (roles, side, expected) => {
    expect(rolesAllowSide(roles, side)).toBe(expected);
  });
});
