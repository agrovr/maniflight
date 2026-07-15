import { createHash } from "node:crypto";
import { REPORT_INTERACTION } from "./interaction.js";
import { REPORT_STYLES } from "./styles.js";
import { DOMAIN_LABELS, RENDER_DOMAINS, renderConstellationSvg, statusSymbol } from "./svg.js";
const STATUS_LABELS = {
    pass: "Pass",
    warn: "Warning",
    fail: "Fail",
    unknown: "Unknown",
    not_applicable: "Not applicable",
};
const SEVERITY_LABELS = {
    info: "Info",
    low: "Low",
    medium: "Medium",
    high: "High",
};
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
function safeHttpsUrl(value) {
    if (!value)
        return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.toString() : null;
    }
    catch {
        return null;
    }
}
function safeId(value, index) {
    const normalized = value
        .normalize("NFKD")
        .toLocaleLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72);
    return `check-${normalized || "result"}-${index + 1}`;
}
function clampScore(value) {
    if (value === null || !Number.isFinite(value))
        return null;
    return Math.max(0, Math.min(100, Math.round(value)));
}
function confidencePercent(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.round(Math.max(0, Math.min(100, value)));
}
function countLabel(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}
function domainState(result) {
    if (result.checks.some((check) => check.status === "fail"))
        return "fail";
    if (result.checks.some((check) => check.status === "warn"))
        return "warn";
    if (result.checks.some((check) => check.status === "unknown"))
        return "unknown";
    if (result.checks.some((check) => check.status === "pass"))
        return "pass";
    return "not_applicable";
}
function statusClass(status) {
    return status === "not_applicable" ? "status-skip" : `status-${status}`;
}
function repositoryDisplayName(report) {
    return report.repository.owner
        ? `${report.repository.owner}/${report.repository.name}`
        : report.repository.name;
}
function reportSummary(report) {
    const evaluated = report.summary.pass + report.summary.warn + report.summary.fail + report.summary.unknown;
    if (evaluated === 0) {
        return "No checks could be evaluated from the available repository context. Review the not-applicable results and collection evidence before making a readiness decision.";
    }
    if (report.summary.fail === 0 && report.summary.warn === 0 && report.summary.unknown === 0) {
        return `All ${countLabel(evaluated, "evaluated check")} passed. Review the evidence before using this snapshot in a release decision.`;
    }
    const attention = report.summary.fail + report.summary.warn + report.summary.unknown;
    return `${countLabel(evaluated, "check")} ${evaluated === 1 ? "was" : "were"} evaluated; ${attention} ${attention === 1 ? "needs" : "need"} attention or more context. Open a result to inspect its evidence and next action.`;
}
function renderPriorityLinks(report) {
    const priority = { fail: 0, warn: 1, unknown: 2 };
    const findings = allChecks(report)
        .map((check, index) => ({ check, index }))
        .filter(({ check }) => priority[check.status] !== undefined)
        .sort((left, right) => (priority[left.check.status] ?? 3) - (priority[right.check.status] ?? 3) ||
        left.index - right.index)
        .slice(0, 3);
    if (findings.length === 0)
        return "";
    return `<nav class="priority-links" aria-label="Priority findings">
    <span>Priority findings</span>
    ${findings
        .map(({ check, index }) => `<a href="#${safeId(check.ruleId, index)}"><strong>${STATUS_LABELS[check.status]}:</strong> ${escapeHtml(check.title)}</a>`)
        .join("")}
  </nav>`;
}
function renderRepositoryPath(report) {
    const label = escapeHtml(repositoryDisplayName(report));
    const repositoryUrl = safeHttpsUrl(report.repository.url);
    if (!repositoryUrl)
        return `<span>${label}</span>`;
    return `<a href="${escapeHtml(repositoryUrl)}" target="_blank" rel="noreferrer noopener">${label}</a>`;
}
function renderSummary(report) {
    const score = clampScore(report.overall.score);
    const scoreText = score === null ? "Not scored" : `${score}%`;
    const scoreProgress = score === null
        ? ""
        : `<progress max="100" value="${score}" aria-label="Overall readiness score: ${score} percent">${score}%</progress>`;
    const overallLabel = report.overall.label.replaceAll("-", " ");
    return `
    <section class="summary" aria-labelledby="report-title">
      <div class="summary-copy">
        <p class="repository-path">${renderRepositoryPath(report)}</p>
        <h1 id="report-title">Repository preflight</h1>
        <p class="summary-text">${escapeHtml(reportSummary(report))}</p>
        ${renderPriorityLinks(report)}
      </div>
      <div class="summary-state" role="group" aria-label="Overall result">
        <div class="verdict-row">
          <p class="verdict">${escapeHtml(overallLabel)}</p>
          <span class="score">${scoreText}</span>
        </div>
        ${scoreProgress}
        <ul class="status-summary" aria-label="Check totals">
          <li><strong>${report.summary.pass}</strong> passed</li>
          <li><strong>${report.summary.warn}</strong> ${report.summary.warn === 1 ? "warning" : "warnings"}</li>
          <li><strong>${report.summary.fail}</strong> failed</li>
          <li><strong>${report.summary.unknown}</strong> unknown</li>
          <li><strong>${report.summary.notApplicable}</strong> not applicable</li>
          <li><strong>${confidencePercent(report.overall.confidence)}%</strong> confidence</li>
          <li><strong>${report.summary.highFindings}</strong> ${report.summary.highFindings === 1 ? "high-severity finding" : "high-severity findings"}</li>
        </ul>
      </div>
    </section>`;
}
function renderDomainControl(domain, result) {
    const label = DOMAIN_LABELS[domain];
    const score = clampScore(result.score);
    const scoreText = score === null ? "Not scored" : `${score}%`;
    const progress = score === null
        ? ""
        : `<progress max="100" value="${score}" aria-hidden="true">${score}%</progress>`;
    const state = STATUS_LABELS[domainState(result)];
    const confidence = confidencePercent(result.confidence);
    const checkCount = `${result.checks.length} ${result.checks.length === 1 ? "check" : "checks"}`;
    return `
    <div class="domain-control" data-domain="${domain}">
      <button
        class="domain-button"
        type="button"
        data-domain-filter="${domain}"
        aria-controls="findings"
        aria-pressed="false"
        aria-label="Filter to ${label}: ${checkCount}, ${scoreText}, ${state}"
      >
        <span class="domain-title-row">
          <span class="domain-title">${label}</span>
          <span class="domain-count">${checkCount}</span>
        </span>
        ${progress}
        <span class="domain-note">${state} · ${confidence}% confidence</span>
      </button>
    </div>`;
}
function renderConstellation(report) {
    return `
    <section class="constellation-panel" aria-labelledby="constellation-title">
      <div class="section-heading">
        <h2 id="constellation-title">Readiness domains</h2>
        <p>Choose a domain to narrow the evidence. Select the repository core to restore the complete view.</p>
      </div>
      <div class="constellation">
        ${renderConstellationSvg()}
        <button
          class="repo-core"
          type="button"
          data-domain-filter="all"
          aria-controls="findings"
          aria-pressed="true"
          aria-label="Show checks from all readiness domains"
        >
          <span class="repo-star" aria-hidden="true">✦</span>
          <span class="repo-name">${escapeHtml(repositoryDisplayName(report))}</span>
          <span class="repo-core-note">All domains</span>
        </button>
        ${RENDER_DOMAINS.map((domain) => renderDomainControl(domain, report.domains[domain])).join("")}
      </div>
    </section>`;
}
function evidenceText(evidence) {
    const location = evidence.path
        ? `${evidence.path}${evidence.line ? `:${evidence.line}` : ""}`
        : "";
    return [location, evidence.message].filter(Boolean).join(" — ");
}
function renderEvidence(evidence) {
    const location = evidence.path
        ? `<code>${escapeHtml(evidence.path)}${evidence.line ? `:${evidence.line}` : ""}</code> — `
        : "";
    const evidenceUrl = safeHttpsUrl(evidence.url);
    const message = evidenceUrl
        ? `<a href="${escapeHtml(evidenceUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(evidence.message)}</a>`
        : escapeHtml(evidence.message);
    return `<li>${location}${message}</li>`;
}
function renderFinding(check, index) {
    const id = safeId(check.ruleId, index);
    const domainLabel = DOMAIN_LABELS[check.domain];
    const documentationUrl = safeHttpsUrl(check.documentationUrl);
    const searchable = [
        check.ruleId,
        check.title,
        check.description,
        check.status,
        check.severity,
        check.remediation ?? "",
        check.waiver?.reason ?? "",
        ...check.evidence.map(evidenceText),
    ].join(" ");
    const evidence = check.evidence.length > 0
        ? `<ul class="evidence-list">${check.evidence.map(renderEvidence).join("")}</ul>`
        : `<p>No repository evidence was recorded for this check.</p>`;
    const remediation = check.remediation
        ? `<div>
        <h3>Next action</h3>
        <p>${escapeHtml(check.remediation)}</p>
      </div>`
        : "";
    const waiver = check.waiver
        ? `<div>
        <h3>Waiver</h3>
        <p>${escapeHtml(check.waiver.reason)}${check.waiver.path ? ` · <code>${escapeHtml(check.waiver.path)}</code>` : ""}</p>
      </div>`
        : "";
    const documentation = documentationUrl
        ? `<p><a href="${escapeHtml(documentationUrl)}" target="_blank" rel="noreferrer noopener">Read the check documentation</a></p>`
        : "";
    return `
    <article
      class="finding"
      data-finding
      data-domain="${check.domain}"
      data-status="${check.status}"
      data-severity="${check.severity}"
      data-search="${escapeHtml(searchable)}"
    >
      <details id="${id}">
        <summary>
          <span class="status-mark ${statusClass(check.status)}" aria-hidden="true">${statusSymbol(check.status)}</span>
          <span class="finding-heading">
            <strong>${escapeHtml(check.title)}</strong>
            <span class="finding-meta">
              <span>${domainLabel}</span>
              <span class="severity">${SEVERITY_LABELS[check.severity]} severity</span>
              <span>${STATUS_LABELS[check.status]}</span>
              <span>${escapeHtml(check.ruleId)}</span>
            </span>
          </span>
        </summary>
        <div class="finding-body">
          <div>
            <h3>What was checked</h3>
            <p>${escapeHtml(check.description)}</p>
            ${documentation}
            ${waiver}
          </div>
          <div>
            <h3>Evidence</h3>
            ${evidence}
            ${remediation}
          </div>
        </div>
      </details>
    </article>`;
}
function allChecks(report) {
    return RENDER_DOMAINS.flatMap((domain) => report.domains[domain].checks);
}
function renderFilters() {
    return `
    <search class="filter-bar" aria-label="Filter repository checks">
      <div class="field field-search">
        <label for="finding-search">Search evidence</label>
        <input id="finding-search" type="search" placeholder="Rule, file, evidence, or action" autocomplete="off" />
      </div>
      <div class="field">
        <label for="domain-filter">Domain</label>
        <select id="domain-filter">
          <option value="all">All domains</option>
          ${RENDER_DOMAINS.map((domain) => `<option value="${domain}">${DOMAIN_LABELS[domain]}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="status-filter">Status</label>
        <select id="status-filter">
          <option value="all">All statuses</option>
          <option value="pass">Pass</option>
          <option value="warn">Warning</option>
          <option value="fail">Fail</option>
          <option value="unknown">Unknown</option>
          <option value="not_applicable">Not applicable</option>
        </select>
      </div>
      <div class="field">
        <label for="severity-filter">Severity</label>
        <select id="severity-filter">
          <option value="all">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>
      <button class="clear-filters" id="clear-filters" type="button">Reset</button>
    </search>`;
}
function renderFindings(report) {
    const checks = allChecks(report);
    return `
    <section class="findings-section" aria-labelledby="findings-title">
      <div class="section-heading">
        <h2 id="findings-title">Checks and evidence</h2>
        <p>A score is a navigation aid, not a certification. Use the evidence and confidence to make the decision.</p>
      </div>
      ${renderFilters()}
      <p class="result-count" id="result-count" role="status" aria-live="polite">${checks.length} ${checks.length === 1 ? "check" : "checks"} shown</p>
      <noscript>
        <p class="result-count">Interactive filters require JavaScript; every check remains available below.</p>
      </noscript>
      <div class="findings" id="findings">
        ${checks.map(renderFinding).join("")}
      </div>
      <p class="empty-state" id="empty-state" hidden>No checks match these filters. Reset the filters or broaden the search.</p>
    </section>`;
}
function sha256(value) {
    return createHash("sha256").update(value, "utf8").digest("base64");
}
function stripTrailingWhitespace(value) {
    return value.replace(/[ \t]+$/gm, "");
}
function contentSecurityPolicy(styles, interaction) {
    return [
        "default-src 'none'",
        "base-uri 'none'",
        "connect-src 'none'",
        "font-src 'none'",
        "form-action 'none'",
        "frame-src 'none'",
        "img-src data:",
        "media-src 'none'",
        "object-src 'none'",
        `script-src 'sha256-${sha256(interaction)}'`,
        `style-src 'sha256-${sha256(styles)}'`,
    ].join("; ");
}
export function renderReportHtml(report) {
    const repositoryName = repositoryDisplayName(report);
    const styles = stripTrailingWhitespace(REPORT_STYLES);
    const interaction = stripTrailingWhitespace(REPORT_INTERACTION);
    const generatedAt = report.generatedAt
        ? `Generated ${escapeHtml(report.generatedAt)}`
        : "Deterministic timestamp omitted";
    const document = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(contentSecurityPolicy(styles, interaction))}" />
  <title>${escapeHtml(repositoryName)} · Maniflight repository preflight</title>
  <style>${styles}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to report</a>
  <header class="topbar">
    <p class="product-label">MANIFLIGHT / REPOSITORY PREFLIGHT</p>
    <button class="theme-toggle" id="theme-toggle" type="button">Theme</button>
  </header>
  <main class="shell" id="main-content">
    ${renderSummary(report)}
    ${renderConstellation(report)}
    ${renderFindings(report)}
    <footer class="report-footer">
      <span>Maniflight ${escapeHtml(report.tool.version)} · schema ${escapeHtml(report.schemaVersion)}</span>
      <span>${generatedAt}</span>
    </footer>
  </main>
  <script>${interaction}</script>
</body>
</html>`;
    return stripTrailingWhitespace(document);
}
export const renderHtml = renderReportHtml;
export default renderReportHtml;
//# sourceMappingURL=html.js.map