import { describe, expect, it } from "vitest";
import type { CheckResult, Domain, DomainResult, RepositorySnapshot } from "../src/model.js";
import { buildReport, scoreDomain, scoreOverall } from "../src/report/score.js";

function check(
  ruleId: string,
  domain: Domain,
  status: CheckResult["status"],
  weight: number,
): CheckResult {
  return {
    ruleId,
    domain,
    title: ruleId,
    description: ruleId,
    status,
    severity: "low",
    weight,
    evidence: [],
  };
}

describe("scoring", () => {
  it("uses full, half, and zero credit while excluding unknown from evaluated weight", () => {
    const domain = scoreDomain("architecture", [
      check("pass", "architecture", "pass", 2),
      check("warn", "architecture", "warn", 2),
      check("fail", "architecture", "fail", 1),
      check("unknown", "architecture", "unknown", 5),
      check("na", "architecture", "not_applicable", 10),
    ]);

    expect(domain.earnedWeight).toBe(3);
    expect(domain.evaluatedWeight).toBe(5);
    expect(domain.possibleWeight).toBe(10);
    expect(domain.score).toBe(60);
    expect(domain.confidence).toBe(50);
  });

  it("returns 0-100 weighted overall scores and an insufficient-data label for low confidence", () => {
    const domain = (name: Domain, score: number | null, confidence: number): DomainResult => ({
      domain: name,
      score,
      confidence,
      earnedWeight: 0,
      evaluatedWeight: score === null ? 0 : 1,
      possibleWeight: 1,
      checks: [],
    });
    const strong = scoreOverall({
      architecture: domain("architecture", 100, 100),
      automation: domain("automation", 80, 100),
      security: domain("security", 90, 100),
      community: domain("community", 70, 100),
    });
    expect(strong).toEqual({ score: 86, confidence: 100, label: "ready" });

    const uncertain = scoreOverall({
      architecture: domain("architecture", 100, 10),
      automation: domain("automation", null, 0),
      security: domain("security", null, 0),
      community: domain("community", null, 0),
    });
    expect(uncertain.label).toBe("insufficient-data");
    expect(uncertain.score).toBe(100);
    expect(uncertain.confidence).toBe(2.5);
  });

  it("keeps waived findings in scores but excludes them from the active high finding count", () => {
    const waived = {
      ...check("security/example", "security", "fail", 4),
      severity: "high" as const,
      waiver: { reason: "Reviewed and accepted for this fixture." },
    };
    const snapshot: RepositorySnapshot = {
      root: "/fixture",
      repositoryName: "fixture",
      files: [],
      manifests: [],
      workflows: [],
      facts: {
        sourceDirectories: [],
        sourceFileCount: 0,
        testFileCount: 0,
        testConfigurationPaths: [],
        lockfilePaths: [],
        dependencyUpdatePaths: [],
        documentationPaths: [],
        issueTemplatePaths: [],
        pullRequestTemplatePaths: [],
        sensitiveFilePaths: [],
        environmentExamplePaths: [],
        typescript: { used: false },
      },
      collection: {
        fileCount: 0,
        parsedBytes: 0,
        skippedSymlinks: [],
        skippedLargeFiles: [],
        warnings: [],
      },
    };
    const report = buildReport(snapshot, [waived], { version: "test" });
    expect(report.domains.security.score).toBe(0);
    expect(report.summary.highFindings).toBe(0);
  });
});
