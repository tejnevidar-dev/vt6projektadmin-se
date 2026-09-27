import { describe, expect, it } from "vitest";
import { nextPipelineStep, PIPELINE_ORDER } from "@/lib/subcontractors-api";

describe("nextPipelineStep", () => {
  it("går ett steg i taget genom hela flödet", () => {
    expect(nextPipelineStep("hittad")).toBe("kontaktad");
    expect(nextPipelineStep("kontaktad")).toBe("samtal");
    expect(nextPipelineStep("samtal")).toBe("kvalificerad");
    expect(nextPipelineStep("kvalificerad")).toBe("provjobb");
    expect(nextPipelineStep("provjobb")).toBe("aktiv");
  });
  it("inget nästa steg vid aktiv (sist) eller nej (avvikande)", () => {
    expect(nextPipelineStep("aktiv")).toBeNull();
    expect(nextPipelineStep("nej")).toBeNull();
  });
  it("PIPELINE_ORDER innehåller inte 'nej'", () => {
    expect(PIPELINE_ORDER).not.toContain("nej");
    expect(PIPELINE_ORDER).toHaveLength(6);
  });
});
