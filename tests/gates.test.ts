import { describe, expect, it } from "vitest";
import { evaluateGates } from "../src/gates.js";
import type { ManiflightReport } from "../src/model.js";

function report(overrides: Partial<ManiflightReport["summary"]> = {}): ManiflightReport {
  return {
    schemaVersion: "1.0",
    tool: { name: "Maniflight", version: "0.2.0" },
    repository: { name: "fixture", topics: [], languages: {} },
    domains: {} as ManiflightReport["domains"],
    overall: { score: 80, confidence: 100, label: "stable" },
    summary: {
      pass: 1,
      warn: 0,
      fail: 0,
      unknown: 0,
      notApplicable: 0,
      highFindings: 0,
      ...overrides,
    },
  };
}

describe("evaluateGates", () => {
  it("keeps the regression gate opt-in", () => {
    expect(
      evaluateGates(report(), {
        failUnder: null,
        failOnHigh: false,
        regressionCount: 2,
      }),
    ).toEqual([]);
  });

  it("fails only for new regressions when enabled", () => {
    expect(
      evaluateGates(report({ fail: 3 }), {
        failUnder: null,
        failOnHigh: false,
        failOnRegression: true,
        regressionCount: 0,
      }),
    ).toEqual([]);

    expect(
      evaluateGates(report(), {
        failUnder: null,
        failOnHigh: false,
        failOnRegression: true,
        regressionCount: 2,
      }),
    ).toEqual(["2 readiness regressions were introduced from the baseline"]);
  });

  it("explains when regression gating has no baseline", () => {
    expect(
      evaluateGates(report(), {
        failUnder: null,
        failOnHigh: false,
        failOnRegression: true,
      }),
    ).toEqual(["Regression gating requires a baseline report"]);
  });
});
