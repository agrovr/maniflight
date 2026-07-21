export const RENDER_DOMAINS = [
    "architecture",
    "automation",
    "security",
    "community",
];
export const DOMAIN_LABELS = {
    architecture: "Architecture",
    automation: "Automation",
    security: "Security",
    community: "Community",
};
function escapeXml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
function clampScore(score) {
    if (score === null || !Number.isFinite(score))
        return null;
    return Math.max(0, Math.min(100, Math.round(score)));
}
function domainState(report, domain) {
    const checks = report.domains[domain].checks;
    if (checks.some((check) => check.status === "fail"))
        return "fail";
    if (checks.some((check) => check.status === "warn"))
        return "warn";
    if (checks.some((check) => check.status === "unknown"))
        return "unknown";
    if (checks.some((check) => check.status === "pass"))
        return "pass";
    return "not-applicable";
}
function stateLabel(state) {
    return state === "not-applicable"
        ? "Not applicable"
        : `${state.charAt(0).toUpperCase()}${state.slice(1)}`;
}
/** Decorative connective tissue for the HTML controls layered above it. */
export function renderConstellationSvg() {
    return `
    <svg class="orbit-art" viewBox="0 0 1000 520" aria-hidden="true" focusable="false">
      <ellipse class="orbit-line" cx="500" cy="260" rx="350" ry="176" opacity="0.42" />
      <ellipse class="orbit-line" cx="500" cy="260" rx="255" ry="238" opacity="0.3" />
      <path class="orbit-line" data-orbit-domain="architecture" d="M500 260 C500 190 500 120 500 48" />
      <path class="orbit-line" data-orbit-domain="automation" d="M500 260 C635 210 735 226 858 260" />
      <path class="orbit-line" data-orbit-domain="security" d="M500 260 C365 310 265 294 142 260" />
      <path class="orbit-line" data-orbit-domain="community" d="M500 260 C500 330 500 400 500 472" />
      <circle cx="500" cy="260" r="64" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.48" />
      <path d="M500 216 L510 250 L544 260 L510 270 L500 304 L490 270 L456 260 L490 250 Z" fill="currentColor" opacity="0.18" />
    </svg>`;
}
function renderSvgDomain(report, domain, x, y) {
    const result = report.domains[domain];
    const score = clampScore(result.score);
    const scoreText = score === null ? "—" : `${score}%`;
    const confidence = Math.round(Math.max(0, Math.min(100, result.confidence)));
    const state = domainState(report, domain);
    const stateText = stateLabel(state);
    const checkCount = `${result.checks.length} ${result.checks.length === 1 ? "check" : "checks"}`;
    return `
    <g transform="translate(${x} ${y})">
      <rect class="domain-node" x="-137" y="-47" width="274" height="94" rx="12" />
      <circle class="state state-${state}" cx="-108" cy="-14" r="8" />
      <text class="domain-title" x="-88" y="-8">${DOMAIN_LABELS[domain]}</text>
      <text class="domain-score" x="108" y="-8" text-anchor="end">${scoreText}</text>
      <text class="domain-meta" x="-108" y="22">${checkCount} · ${confidence}% confidence · ${stateText}</text>
    </g>`;
}
/**
 * A self-contained summary artifact for CLI consumers that request SVG output.
 * It contains no scripts, remote fonts, images, or runtime network references.
 */
export function renderReportSvg(report) {
    const repositoryName = escapeXml(report.repository.owner
        ? `${report.repository.owner}/${report.repository.name}`
        : report.repository.name);
    const overallScore = clampScore(report.overall.score);
    const overallScoreText = overallScore === null ? "—" : `${overallScore}%`;
    const label = escapeXml(report.overall.label.replaceAll("-", " "));
    const generated = report.generatedAt
        ? escapeXml(report.generatedAt)
        : "Reproducible timestamp omitted";
    const domainStates = RENDER_DOMAINS.map((domain) => `${DOMAIN_LABELS[domain]}: ${stateLabel(domainState(report, domain))}`).join("; ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-labelledby="title description">
  <title id="title">Maniflight repository diagnostics for ${repositoryName}</title>
  <desc id="description">Overall readiness ${overallScoreText}, labeled ${label}. ${escapeXml(domainStates)}.</desc>
  <style>
    :root { color-scheme: dark light; }
    .background { fill: #090611; }
    .surface { fill: #110b1c; stroke: #765990; stroke-width: 1; }
    .orbit { fill: none; stroke: #765990; stroke-width: 1.4; opacity: .62; }
    .connector { fill: none; stroke: #7650a8; stroke-width: 1.6; }
    .domain-node { fill: #110b1c; stroke: #765990; stroke-width: 1.2; }
    .product { fill: #c2a5e8; font: 700 13px ui-sans-serif, system-ui, sans-serif; letter-spacing: 1.4px; }
    .repo { fill: #f8f3ff; font: 740 34px ui-sans-serif, system-ui, sans-serif; letter-spacing: -1px; }
    .muted { fill: #c9bdd6; font: 400 15px ui-sans-serif, system-ui, sans-serif; }
    .score { fill: #f2a45b; font: 760 35px ui-sans-serif, system-ui, sans-serif; }
    .label { fill: #f8f3ff; font: 680 15px ui-sans-serif, system-ui, sans-serif; text-transform: capitalize; }
    .domain-title { fill: #f8f3ff; font: 720 17px ui-sans-serif, system-ui, sans-serif; }
    .domain-score { fill: #f2a45b; font: 720 17px ui-sans-serif, system-ui, sans-serif; }
    .domain-meta { fill: #c9bdd6; font: 400 12px ui-sans-serif, system-ui, sans-serif; }
    .state-pass { fill: #79d8ae; }
    .state-warn { fill: #f2a45b; }
    .state-fail { fill: #ff8b9d; }
    .state-unknown, .state-not-applicable { fill: #aaa0b4; }
    .footer { fill: #9f91ad; font: 400 11px ui-sans-serif, system-ui, sans-serif; }
    @media (prefers-color-scheme: light) {
      .background { fill: #f7f4fb; }
      .surface, .domain-node { fill: #fff; stroke: #9e82b7; }
      .orbit { stroke: #9e82b7; }
      .connector { stroke: #7650a8; }
      .repo, .label, .domain-title { fill: #17101f; }
      .product { fill: #613891; }
      .muted, .domain-meta { fill: #554a61; }
      .score, .domain-score { fill: #8c480c; }
      .state-pass { fill: #176b4a; }
      .state-warn { fill: #80420b; }
      .state-fail { fill: #9e2940; }
      .state-unknown, .state-not-applicable, .footer { fill: #625a69; }
    }
  </style>
  <rect class="background" width="1200" height="720" />
  <text class="product" x="64" y="54">MANIFLIGHT / REPOSITORY DIAGNOSTICS</text>
  <text class="repo" x="64" y="101">${repositoryName}</text>
  <text class="muted" x="64" y="130">Evidence-backed readiness snapshot</text>
  <g transform="translate(1018 88)">
    <text class="score" x="0" y="0" text-anchor="end">${overallScoreText}</text>
    <text class="label" x="0" y="28" text-anchor="end">${label}</text>
  </g>
  <line x1="64" y1="158" x2="1136" y2="158" stroke="#765990" stroke-width="1" />
  <ellipse class="orbit" cx="600" cy="426" rx="382" ry="192" />
  <ellipse class="orbit" cx="600" cy="426" rx="260" ry="245" opacity=".38" />
  <path class="connector" d="M600 426 C600 350 600 294 600 236" />
  <path class="connector" d="M600 426 C725 390 825 410 956 426" />
  <path class="connector" d="M600 426 C475 462 375 442 244 426" />
  <path class="connector" d="M600 426 C600 500 600 552 600 610" />
  ${renderSvgDomain(report, "architecture", 600, 220)}
  ${renderSvgDomain(report, "automation", 964, 426)}
  ${renderSvgDomain(report, "security", 236, 426)}
  ${renderSvgDomain(report, "community", 600, 626)}
  <g transform="translate(600 426)">
    <circle class="surface" r="102" />
    <circle class="orbit" r="78" opacity=".5" />
    <path d="M0 -48 L11 -11 L48 0 L11 11 L0 48 L-11 11 L-48 0 L-11 -11 Z" fill="#f2a45b" />
    <text class="label" x="0" y="72" text-anchor="middle">repository core</text>
  </g>
  <text class="footer" x="64" y="690">Generated by Maniflight ${escapeXml(report.tool.version)} · ${generated}</text>
</svg>`;
    return svg.replace(/[ \t]+$/gm, "");
}
export function statusSymbol(status) {
    switch (status) {
        case "pass":
            return "✓";
        case "warn":
            return "!";
        case "fail":
            return "×";
        default:
            return "–";
    }
}
//# sourceMappingURL=svg.js.map