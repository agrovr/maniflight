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
