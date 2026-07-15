import { describe, expect, it } from "vitest";
import type {
  CheckResult,
  CheckStatus,
  Domain,
  DomainResult,
  ManiflightReport,
  Severity,
} from "../src/model.js";
import { renderReportHtml } from "../src/render/html.js";
import { renderReportSvg } from "../src/render/svg.js";
import type { ComparisonReport } from "../src/report/compare.js";

function check(
  domain: Domain,
  status: CheckStatus,
  severity: Severity,
  title: string,
): CheckResult {
  return {
    ruleId: `${domain}.sample`,
    domain,
    title,
    description: "A transparent repository readiness check.",
    status,
    severity,
    weight: 1,
    evidence: [
      {
        kind: status === "fail" ? "risk" : "present",
        message: "Observed <script>alert(1)</script> in repository evidence.",
        path: "docs/<unsafe>.md",
        url: "javascript:alert(1)",
      },
    ],
    remediation: "Document the decision and add a focused verification step.",
    documentationUrl: "https://example.com/maniflight/check",
  };
}

function domainResult(domain: Domain, result: CheckResult, score: number | null): DomainResult {
  return {
    domain,
    score,
    confidence: 73,
    earnedWeight: score === null ? 0 : score / 100,
    evaluatedWeight: score === null ? 0 : 1,
    possibleWeight: 1,
    checks: [result],
  };
}

function sampleReport(): ManiflightReport {
  return {
    schemaVersion: "1.0",
    tool: { name: "Maniflight", version: "0.1.0" },
    repository: {
      owner: "agrovr",
      name: "<script>alert(1)</script>",
      url: "https://github.com/agrovr/maniflight",
      topics: [],
      languages: { TypeScript: 100 },
    },
    generatedAt: "2026-07-14T23:30:00.000Z",
    domains: {
      architecture: domainResult(
        "architecture",
        check("architecture", "pass", "info", "Architecture is legible"),
        100,
      ),
      automation: domainResult(
        "automation",
        check("automation", "warn", "medium", "Automation needs review"),
        70,
      ),
      security: domainResult(
        "security",
        check("security", "fail", "high", "Security control is missing"),
        30,
      ),
      community: domainResult(
        "community",
        check("community", "unknown", "low", "Community context is unknown"),
        null,
      ),
    },
    overall: { score: 63, confidence: 73, label: "developing" },
    summary: {
      pass: 1,
      warn: 1,
      fail: 1,
      unknown: 1,
      notApplicable: 0,
      highFindings: 1,
    },
  };
}

function sampleComparison(includeRegression = false): ComparisonReport {
  const regressions: ComparisonReport["regressions"] = includeRegression
    ? [
        {
          ruleId: "security.regressed",
          kind: "regression",
          baseline: {
            domain: "security",
            title: "Security control was present",
            status: "pass",
            severity: "high",
          },
          current: {
            domain: "security",
            title: "Security control regressed",
            status: "fail",
            severity: "high",
          },
        },
      ]
    : [];

  return {
    schemaVersion: "1.0",
    baseline: {
      repository: { owner: "baseline-owner", name: "<baseline-repo>" },
      reportSchemaVersion: "1.0",
      toolVersion: "0.1.0",
      generatedAt: "2026-07-13T23:30:00.000Z",
      score: 55,
      confidence: 70,
    },
    current: {
      repository: { owner: "agrovr", name: "maniflight" },
      reportSchemaVersion: "1.0",
      toolVersion: "0.1.0",
      generatedAt: "2026-07-14T23:30:00.000Z",
      score: 63,
      confidence: 73,
    },
    metrics: {
      score: { baseline: 55, current: 63, delta: 8 },
      confidence: { baseline: 70, current: 73, delta: 3 },
    },
    summary: {
      regressions: regressions.length,
      improvements: 1,
      evidenceChanges: 1,
      added: 1,
      removed: 1,
      unchanged: 1,
    },
    regressions,
    improvements: [
      {
        ruleId: "automation.improved",
        kind: "improvement",
        baseline: {
          domain: "automation",
          title: "Automation needed review",
          status: "warn",
          severity: "medium",
        },
        current: {
          domain: "automation",
          title: "Automation <improved>",
          status: "pass",
          severity: "medium",
        },
      },
    ],
    evidenceChanges: [
      {
        ruleId: "security.<evidence>",
        kind: "evidence_change",
        baseline: {
          domain: "security",
          title: "Security evidence was unavailable",
          status: "unknown",
          severity: "low",
        },
        current: {
          domain: "security",
          title: "Security evidence is now available",
          status: "pass",
          severity: "low",
        },
      },
    ],
    added: [
      {
        ruleId: "community.added",
        kind: "added",
        current: {
          domain: "community",
          title: "A new community check",
          status: "pass",
          severity: "info",
        },
      },
    ],
    removed: [
      {
        ruleId: "architecture.<removed>",
        kind: "removed",
        baseline: {
          domain: "architecture",
          title: "Removed <baseline-only> check",
          status: "warn",
          severity: "medium",
        },
      },
    ],
    unchanged: [
      {
        ruleId: "architecture.unchanged",
        kind: "unchanged",
        baseline: {
          domain: "architecture",
          title: "Architecture remains legible",
          status: "pass",
          severity: "info",
        },
        current: {
          domain: "architecture",
          title: "Architecture remains legible",
          status: "pass",
          severity: "info",
        },
      },
    ],
  };
}

describe("standalone report renderer", () => {
  it("renders the summary first and exposes all four keyboard-operable domain controls", () => {
    const html = renderReportHtml(sampleReport());

    expect(html.indexOf('class="summary"')).toBeLessThan(
      html.indexOf('class="constellation-panel"'),
    );
    expect(
      html.match(/data-domain-filter="(architecture|automation|security|community)"/g),
    ).toHaveLength(4);
    expect(html).toContain('data-domain-filter="all"');
    expect(html).toContain('aria-controls="findings"');
    expect(html).toContain('id="domain-filter"');
    expect(html).toContain('id="status-filter"');
    expect(html).toContain('id="severity-filter"');
    expect(html).toContain('id="finding-search"');
    expect(html).toContain("@media (prefers-reduced-motion: reduce)");
    expect(html).toContain("73% confidence");
    expect(html).not.toContain('class="comparison-panel"');
  });

  it("renders an accessible comparison before the orbital map", () => {
    const html = renderReportHtml(sampleReport(), sampleComparison());

    expect(html.indexOf('class="summary"')).toBeLessThan(html.indexOf('class="comparison-panel"'));
    expect(html.indexOf('class="comparison-panel"')).toBeLessThan(
      html.indexOf('class="constellation-panel"'),
    );
    expect(html).toContain('aria-labelledby="comparison-title"');
    expect(html).toContain('aria-label="Current metrics compared with baseline"');
    expect(html).toContain("<dt>Current score</dt>");
    expect(html).toContain("<strong>63%</strong>");
    expect(html).toContain("+8 points from baseline");
    expect(html).toContain("<dt>Current confidence</dt>");
    expect(html).toContain("<strong>73%</strong>");
    expect(html).toContain("+3 points from baseline");
    expect(html).toContain('aria-label="Comparison totals"');
    expect(html).toContain("No readiness regressions detected.");
    expect(html).toContain('aria-labelledby="comparison-improvements"');
    expect(html).toContain('aria-labelledby="comparison-evidence"');
    expect(html).toContain('aria-labelledby="comparison-added"');
    expect(html).toContain('aria-labelledby="comparison-removed"');
    expect(html).toContain('<span class="visually-hidden">Status changed from </span>');
    expect(html).toContain("baseline-owner/&lt;baseline-repo&gt;");
    expect(html).toContain("Automation &lt;improved&gt;");
    expect(html).toContain("Removed &lt;baseline-only&gt; check");
    expect(html).not.toContain("baseline-owner/<baseline-repo>");
    expect(html).not.toContain("Removed <baseline-only> check");
    expect(html).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("lists regressions and does not show the no-regression state when one is present", () => {
    const html = renderReportHtml(sampleReport(), sampleComparison(true));

    expect(html).toContain('aria-labelledby="comparison-regressions"');
    expect(html).toContain("Security control regressed");
    expect(html).not.toContain("No readiness regressions detected.");
    expect(html).toMatch(/Status changed from <\/span>[\s\S]*Pass[\s\S]* to <\/span>[\s\S]*Fail/);
  });

  it("uses the same precision for summary and comparison confidence", () => {
    const report = sampleReport();
    report.overall.confidence = 98.5;
    const comparison = sampleComparison();
    comparison.current.confidence = 98.5;
    comparison.metrics.confidence = { baseline: 98, current: 98.5, delta: 0.5 };

    const html = renderReportHtml(report, comparison);

    expect(html.match(/98\.5%/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain("99% confidence");
  });

  it("labels an unavailable score and preserves a signed confidence delta", () => {
    const comparison = sampleComparison();
    comparison.metrics.score = { baseline: 55, current: null, delta: null };
    comparison.metrics.confidence = { baseline: 80, current: 73, delta: -7 };

    const html = renderReportHtml(sampleReport(), comparison);

    expect(html).toContain("<strong>Unavailable</strong>");
    expect(html).toContain("Delta unavailable");
    expect(html).toContain("-7 points from baseline");
  });

  it("uses singular grammar when exactly one result needs attention", () => {
    const report = sampleReport();
    report.summary = { ...report.summary, fail: 0, warn: 0, unknown: 1 };

    expect(renderReportHtml(report)).toContain("1 needs attention or more context");
  });

  it("escapes repository-controlled text and emits a restrictive hashed CSP", () => {
    const html = renderReportHtml(sampleReport());

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src &#39;none&#39;");
    expect(html).toContain("script-src &#39;sha256-");
    expect(html).toContain("style-src &#39;sha256-");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<link ");
    expect(html).not.toContain("fetch(");
  });

  it("renders an accessible, escaped, self-contained SVG summary", () => {
    const svg = renderReportSvg(sampleReport());

    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="title description"');
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).not.toContain("<script>alert(1)</script>");
    expect(svg.match(/class="domain-node"/g)).toHaveLength(4);
    expect(svg).toContain("73% confidence");
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("<script");
  });
});
