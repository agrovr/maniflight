import { describe, expect, it } from "vitest";
import type {
  CheckResult,
  Domain,
  DomainResult,
  ManiflightReport,
  ReportSummary,
} from "../src/model.js";
import { compareReports } from "../src/report/compare.js";

function check(ruleId: string, status: CheckResult["status"]): CheckResult {
  return {
    ruleId,
    domain: "architecture",
    title: `Rule ${ruleId}`,
    description: `Description for ${ruleId}`,
    status,
    severity: status === "fail" ? "high" : "low",
    weight: 1,
    evidence: [],
  };
}

function emptyDomain(domain: Domain): DomainResult {
  return {
    domain,
    score: null,
    confidence: 0,
    earnedWeight: 0,
    evaluatedWeight: 0,
    possibleWeight: 0,
    checks: [],
  };
}

function summary(checks: CheckResult[]): ReportSummary {
  return {
    pass: checks.filter((result) => result.status === "pass").length,
    warn: checks.filter((result) => result.status === "warn").length,
    fail: checks.filter((result) => result.status === "fail").length,
    unknown: checks.filter((result) => result.status === "unknown").length,
    notApplicable: checks.filter((result) => result.status === "not_applicable").length,
    highFindings: checks.filter((result) => result.status === "fail").length,
  };
}

function report(
  checks: CheckResult[],
  options: { name: string; score: number | null; confidence: number },
): ManiflightReport {
  return {
    schemaVersion: "1.0",
    tool: { name: "Maniflight", version: "test" },
    repository: {
      owner: "agrovr",
      name: options.name,
      url: `https://github.com/agrovr/${options.name}`,
      topics: [],
      languages: {},
    },
    generatedAt: "2026-07-15T00:00:00.000Z",
    domains: {
      architecture: {
        ...emptyDomain("architecture"),
        checks,
      },
      automation: emptyDomain("automation"),
      security: emptyDomain("security"),
      community: emptyDomain("community"),
    },
    overall: {
      score: options.score,
      confidence: options.confidence,
      label: options.score === null ? "insufficient-data" : "stable",
    },
    summary: summary(checks),
  };
}

describe("report comparison", () => {
  it("classifies status movement, evidence changes, and rule set changes", () => {
    const baseline = report(
      [
        check("z-removed", "pass"),
        check("r-warn-fail", "warn"),
        check("e-unknown-pass", "unknown"),
        check("u-same", "pass"),
        check("i-fail-warn", "fail"),
        check("r-pass-warn", "pass"),
        check("i-warn-pass", "warn"),
        check("e-na-warn", "not_applicable"),
        check("r-pass-fail", "pass"),
        check("i-fail-pass", "fail"),
        check("e-fail-unknown", "fail"),
        check("e-unknown-na", "unknown"),
      ],
      { name: "baseline", score: 74.4, confidence: 80.2 },
    );
    const current = report(
      [
        check("i-fail-pass", "pass"),
        check("r-pass-fail", "fail"),
        check("e-fail-unknown", "unknown"),
        check("a-added", "warn"),
        check("u-same", "pass"),
        check("r-pass-warn", "warn"),
        check("e-na-warn", "warn"),
        check("i-warn-pass", "pass"),
        check("e-unknown-pass", "pass"),
        check("r-warn-fail", "fail"),
        check("e-unknown-na", "not_applicable"),
        check("i-fail-warn", "warn"),
      ],
      { name: "current", score: 81.8, confidence: 90.6 },
    );

    const comparison = compareReports(current, baseline);

    expect(comparison.schemaVersion).toBe("1.0");
    expect(comparison.baseline.repository).toEqual({
      owner: "agrovr",
      name: "baseline",
      url: "https://github.com/agrovr/baseline",
    });
    expect(comparison.current.repository.name).toBe("current");
    expect(comparison.metrics).toEqual({
      score: { baseline: 74.4, current: 81.8, delta: 7.4 },
      confidence: { baseline: 80.2, current: 90.6, delta: 10.4 },
    });
    expect(comparison.summary).toEqual({
      regressions: 3,
      improvements: 3,
      evidenceChanges: 4,
      added: 1,
      removed: 1,
      unchanged: 1,
    });
    expect(comparison.regressions.map((change) => change.ruleId)).toEqual([
      "r-pass-fail",
      "r-pass-warn",
      "r-warn-fail",
    ]);
    expect(comparison.improvements.map((change) => change.ruleId)).toEqual([
      "i-fail-pass",
      "i-fail-warn",
      "i-warn-pass",
    ]);
    expect(comparison.evidenceChanges.map((change) => change.ruleId)).toEqual([
      "e-fail-unknown",
      "e-na-warn",
      "e-unknown-na",
      "e-unknown-pass",
    ]);
    expect(comparison.added).toEqual([
      {
        ruleId: "a-added",
        kind: "added",
        current: {
          domain: "architecture",
          title: "Rule a-added",
          status: "warn",
          severity: "low",
        },
      },
    ]);
    expect(comparison.removed[0]?.ruleId).toBe("z-removed");
    expect(comparison.unchanged[0]).toMatchObject({
      ruleId: "u-same",
      kind: "unchanged",
      baseline: { status: "pass" },
      current: { status: "pass" },
    });
  });

  it("keeps a score delta unavailable when either report has insufficient data", () => {
    const baseline = report([], { name: "baseline", score: null, confidence: 0 });
    const current = report([], { name: "current", score: 91, confidence: 100 });

    expect(compareReports(current, baseline).metrics.score).toEqual({
      baseline: null,
      current: 91,
      delta: null,
    });
  });

  it("rejects duplicate stable rule IDs in either input report", () => {
    const duplicate = [check("same-id", "pass"), check("same-id", "warn")];
    const clean = report([check("unique-id", "pass")], {
      name: "clean",
      score: 100,
      confidence: 100,
    });

    expect(() =>
      compareReports(report(duplicate, { name: "current", score: 75, confidence: 100 }), clean),
    ).toThrow('Duplicate rule ID "same-id" in current report.');
    expect(() =>
      compareReports(clean, report(duplicate, { name: "baseline", score: 75, confidence: 100 })),
    ).toThrow('Duplicate rule ID "same-id" in baseline report.');
  });

  it("rejects out-of-range metrics before a delta can overflow", () => {
    const current = report([], { name: "current", score: 80, confidence: 100 });
    const baseline = report([], {
      name: "baseline",
      score: 80,
      confidence: -Number.MAX_VALUE,
    });

    expect(() => compareReports(current, baseline)).toThrow(
      "Baseline confidence must be a finite number from 0 to 100",
    );
  });
});
