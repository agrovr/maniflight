/**
 * Generates Maniflight's showcase assets from the real classifier and terminal renderer:
 *
 *   demo/flight.svg      terminal image used by the README
 *   demo/landing.html    the GitHub Pages landing page (the self-scan is published at /scan/)
 *
 * The sample pull requests are fictional fact sets. They run through the same
 * classify -> render path as `maniflight pr`, so the showcase cannot drift from real output.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPullRequestFlight } from "../src/pr/classify.js";
import type {
  BranchPolicyFact,
  CollectionSource,
  PullRequestFlightFacts,
  PullRequestFlightReport,
  PullRequestSubject,
} from "../src/pr/model.js";
import { renderPullRequestFlight } from "../src/pr/render.js";
import { VERSION } from "../src/version.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const OBSERVED_AT = "2026-09-30T16:00:00.000Z";
const RELEASE_URL = `https://github.com/agrovr/maniflight/releases/download/v${VERSION}/maniflight-${VERSION}.tgz`;
const REPO_URL = "https://github.com/agrovr/maniflight";

const ALL_SOURCES: CollectionSource[] = [
  { id: "pull_request", status: "available" },
  { id: "graphql", status: "available" },
  { id: "reviews", status: "available" },
  { id: "check_runs", status: "available" },
  { id: "commit_statuses", status: "available" },
  { id: "workflow_runs", status: "available" },
  { id: "branch_rules", status: "available" },
];

const POLICY: BranchPolicyFact = {
  requiredApprovals: 1,
  requireCodeOwnerReview: false,
  requireLastPushApproval: false,
  requireThreadResolution: true,
  requireUpToDate: false,
  requiredStatusChecks: ["build"],
};

function subject(overrides: Partial<PullRequestSubject>): PullRequestSubject {
  return {
    repository: "acme/payments-api",
    number: 218,
    url: "https://github.com/acme/payments-api/pull/218",
    title: "Retry idempotent webhook deliveries",
    state: "open",
    merged: false,
    draft: false,
    author: "dana-k",
    base: { ref: "main", sha: "a".repeat(40), repository: "acme/payments-api" },
    head: {
      ref: "webhook-retries",
      sha: "7c41e09b2d5f8a3e6c1b9d04f2a7e8c3b5d1f6a2",
      repository: "acme/payments-api",
    },
    mergeable: true,
    mergeState: "blocked",
    reviewDecision: "review_required",
    ...overrides,
  };
}

function facts(overrides: Partial<PullRequestFlightFacts>): PullRequestFlightFacts {
  return {
    subject: subject({}),
    reviews: [],
    checkRuns: [],
    commitStatuses: [],
    workflowRuns: [],
    branchPolicy: POLICY,
    reviewThreads: { total: 0, unresolved: 0 },
    collection: ALL_SOURCES,
    warnings: [],
    ...overrides,
  };
}

const build = (conclusion: string | null, status = "completed") => ({
  id: 9101,
  name: "build",
  status,
  conclusion,
  app: "github-actions",
  url: "https://github.com/acme/payments-api/actions/runs/9101",
});

interface Scenario {
  id: string;
  tab: string;
  caption: string;
  report: PullRequestFlightReport;
}

const scenarios: Scenario[] = [
  {
    id: "fork",
    tab: "Fork PR",
    caption:
      "A first-time contributor's fork: CI is parked until a maintainer approves it, and a review is still required.",
    report: classifyPullRequestFlight(
      facts({
        subject: subject({
          number: 231,
          url: "https://github.com/acme/payments-api/pull/231",
          title: "Document the refund webhook payload",
          author: "new-contributor",
          head: {
            ref: "docs-refunds",
            sha: "e19a7c3f40b2d6e8a5c1f9b7d3e0a2c4b6d8f1e3",
            repository: "new-contributor/payments-api",
          },
        }),
        workflowRuns: [
          {
            id: 9177,
            name: "CI",
            event: "pull_request",
            status: "completed",
            conclusion: "action_required",
            jobs: 0,
            url: "https://github.com/acme/payments-api/actions/runs/9177",
          },
        ],
      }),
      OBSERVED_AT,
    ),
  },
  {
    id: "failing",
    tab: "Failing check",
    caption: "Approved, but a required check failed and a review thread is still open.",
    report: classifyPullRequestFlight(
      facts({
        subject: subject({ reviewDecision: "approved" }),
        reviews: [
          {
            id: 51,
            user: "lee-m",
            state: "APPROVED",
            submittedAt: "2026-09-30T14:12:00Z",
            url: "https://github.com/acme/payments-api/pull/218#pullrequestreview-51",
          },
        ],
        checkRuns: [build("failure")],
        reviewThreads: { total: 3, unresolved: 1 },
      }),
      OBSERVED_AT,
    ),
  },
  {
    id: "unknown",
    tab: "Evidence gap",
    caption:
      "Run without a token: GitHub hides review data, so Maniflight says what it cannot see instead of guessing.",
    report: classifyPullRequestFlight(
      facts({
        subject: subject({ reviewDecision: null }),
        checkRuns: [build(null, "in_progress")],
        collection: ALL_SOURCES.map((source) =>
          source.id === "graphql"
            ? {
                ...source,
                status: "unavailable",
                detail: "GitHub GraphQL requires authentication.",
              }
            : source,
        ),
      }),
      OBSERVED_AT,
    ),
  },
  {
    id: "ready",
    tab: "Ready",
    caption: "Everything required has reported success. Nothing left to chase.",
    report: classifyPullRequestFlight(
      facts({
        subject: subject({ reviewDecision: "approved", mergeState: "clean" }),
        reviews: [
          {
            id: 52,
            user: "lee-m",
            state: "APPROVED",
            submittedAt: "2026-09-30T15:02:00Z",
            url: "https://github.com/acme/payments-api/pull/218#pullrequestreview-52",
          },
        ],
        checkRuns: [build("success")],
      }),
      OBSERVED_AT,
    ),
  },
];

// ---------- ANSI -> markup ----------

type Segment = { text: string; tone: string | null; bold: boolean };

const TONES: Record<string, string> = {
  "31": "red",
  "32": "green",
  "33": "yellow",
  "35": "magenta",
  "36": "cyan",
  "2": "dim",
};

function parseAnsi(line: string): Segment[] {
  const segments: Segment[] = [];
  let tone: string | null = null;
  let bold = false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: renderer emits these escapes
  for (const part of line.split(/(\u001b\[[0-9;]*m)/)) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: renderer emits these escapes
    const code = part.match(/^\u001b\[([0-9;]*)m$/)?.[1];
    if (code !== undefined) {
      if (code === "1") bold = true;
      else if (code === "22") {
        bold = false;
        if (tone === "dim") tone = null;
      } else if (code === "39") tone = null;
      else if (TONES[code]) tone = TONES[code] ?? null;
      continue;
    }
    if (part) segments.push({ text: part, tone, bold });
  }
  return segments;
}

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function terminalHtml(report: PullRequestFlightReport): string {
  return renderPullRequestFlight(report, { color: true })
    .trimEnd()
    .split("\n")
    .map((line) =>
      parseAnsi(line)
        .map((segment) => {
          const classes = [
            segment.tone ? `t-${segment.tone}` : "",
            segment.bold ? "t-bold" : "",
          ].filter(Boolean);
          const text = escapeXml(segment.text);
          return classes.length > 0 ? `<span class="${classes.join(" ")}">${text}</span>` : text;
        })
        .join(""),
    )
    .join("\n");
}

// ---------- README terminal image ----------

const SVG_COLORS: Record<string, string> = {
  base: "#e9e2f2",
  red: "#ff8a8a",
  green: "#86d6a6",
  yellow: "#f6c76b",
  magenta: "#df9be6",
  cyan: "#7fd0e0",
  dim: "#8f82a3",
};

const CHAR_WIDTH = 8.4; // 14px monospace advance
const MAX_COLUMNS = 100;
const HANGING_INDENT = 13; // value column used by the renderer

// Wrap one rendered line to MAX_COLUMNS, keeping each segment's tone and indenting continuations.
function wrapSegments(segments: Segment[]): Segment[][] {
  const lines: Segment[][] = [[]];
  let column = 0;
  for (const segment of segments) {
    let rest = segment.text;
    while (rest.length > 0) {
      const room = MAX_COLUMNS - column;
      if (rest.length <= room) {
        lines[lines.length - 1]?.push({ ...segment, text: rest });
        column += rest.length;
        break;
      }
      const slice = rest.slice(0, room);
      const breakAt = slice.lastIndexOf(" ") > 0 ? slice.lastIndexOf(" ") : room;
      lines[lines.length - 1]?.push({ ...segment, text: rest.slice(0, breakAt) });
      rest = rest.slice(breakAt).trimStart();
      lines.push([{ text: " ".repeat(HANGING_INDENT), tone: null, bold: false }]);
      column = HANGING_INDENT;
    }
  }
  return lines;
}

function terminalSvg(report: PullRequestFlightReport, command: string): string {
  const lines = renderPullRequestFlight(report, { color: true })
    .trimEnd()
    .split("\n")
    .flatMap((line) => wrapSegments(parseAnsi(line)));
  const lineHeight = 21;
  const left = 28;
  const top = 78;
  const width = Math.ceil(left * 2 + MAX_COLUMNS * CHAR_WIDTH);
  const height = top + lines.length * lineHeight + 30;
  const body = lines
    .map((segments, index) => {
      let column = 0;
      // Split at runs of spaces so every column starts at its own fixed x position.
      const pieces = segments.flatMap((segment) =>
        segment.text
          .split(/( {2,})/)
          .filter((text) => text.length > 0)
          .map((text) => ({ ...segment, text })),
      );
      const spans = pieces
        .map((segment) => {
          // Explicit x per segment keeps columns aligned even with a proportional fallback font.
          const x = (left + column * CHAR_WIDTH).toFixed(1);
          column += segment.text.length;
          if (!segment.text.trim()) return "";
          return `<tspan x="${x}" fill="${SVG_COLORS[segment.tone ?? "base"]}"${segment.bold ? ' font-weight="700"' : ""}>${escapeXml(segment.text.trimEnd())}</tspan>`;
        })
        .join("");
      return `    <text y="${top + index * lineHeight}" xml:space="preserve">${spans}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
  <title id="t">maniflight pr output</title>
  <desc id="d">Terminal output of ${escapeXml(command)} showing status, observed blockers, and next steps for each actor.</desc>
  <rect width="${width}" height="${height}" rx="14" fill="#140e1d"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="13.5" fill="none" stroke="#3a2d4b"/>
  <circle cx="26" cy="22" r="5.5" fill="#ff7a72"/><circle cx="44" cy="22" r="5.5" fill="#f6c76b"/><circle cx="62" cy="22" r="5.5" fill="#86d6a6"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, DejaVu Sans Mono, monospace" font-size="14">
    <text y="54" xml:space="preserve"><tspan x="${left}" fill="#f2a45b">$</tspan><tspan x="${(left + 2 * CHAR_WIDTH).toFixed(1)}" fill="#8f82a3">${escapeXml(command)}</tspan></text>
${body}
  </g>
</svg>
`;
}

// ---------- landing page ----------

function landingHtml(): string {
  const tabs = scenarios
    .map(
      (scenario, index) =>
        `<button type="button" role="tab" id="tab-${scenario.id}" aria-controls="panel-${scenario.id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${escapeXml(scenario.tab)}</button>`,
    )
    .join("\n          ");
  const panels = scenarios
    .map(
      (
        scenario,
        index,
      ) => `<div class="panel" role="tabpanel" id="panel-${scenario.id}" aria-labelledby="tab-${scenario.id}"${index === 0 ? "" : " hidden"}>
          <p class="caption">${escapeXml(scenario.caption)}</p>
          <pre class="term" tabindex="0"><span class="t-dim">$</span> maniflight pr ${escapeXml(`${scenario.report.pullRequest.repository}#${scenario.report.pullRequest.number}`)}

${terminalHtml(scenario.report)}</pre>
        </div>`,
    )
    .join("\n        ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maniflight</title>
<meta name="description" content="Read-only GitHub pull-request diagnostics: why a PR is blocked, what evidence is missing, and who can act next.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: one column of flight-deck panels; the tabbed terminal is the hero's proof. */
:root {
  --bg: #0f0a17;
  --panel: #171020;
  --raised: #1e1629;
  --ink: #f2ecf8;
  --muted: #a99abf;
  --line: #2e2340;
  --plum: #b895dc;
  --flare: #f2a45b;
  --term-bg: #140e1d;
  --t-base: #e9e2f2; --t-red: #ff8a8a; --t-green: #86d6a6; --t-yellow: #f6c76b; --t-magenta: #df9be6; --t-cyan: #7fd0e0; --t-dim: #8f82a3;
  --display: "IBM Plex Sans Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f8f4ec; --panel: #fffdf9; --raised: #f1eadf; --ink: #241933; --muted: #6b5c7e; --line: #e2d8ca;
    --plum: #6f4e93; --flare: #c96d24; color-scheme: light;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 var(--body); }
a { color: inherit; text-decoration-color: color-mix(in srgb, var(--plum) 60%, transparent); text-underline-offset: 3px; }
a:hover { text-decoration-color: var(--flare); }
:focus-visible { outline: 2px solid var(--flare); outline-offset: 3px; border-radius: 4px; }
.wrap { max-width: 1080px; margin: 0 auto; padding-inline: 20px; }
header.bar { border-bottom: 1px solid var(--line); }
header.bar .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-block: 14px; flex-wrap: wrap; }
.mark { font: 600 0.95rem/1 var(--mono); letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; }
.mark i { width: 10px; height: 10px; border-radius: 50%; background: var(--flare); box-shadow: 0 0 0 4px color-mix(in srgb, var(--flare) 22%, transparent); }
nav { display: flex; gap: 20px; font-size: 0.92rem; color: var(--muted); flex-wrap: wrap; }
nav a { text-decoration: none; }
nav a:hover { color: var(--ink); }

.hero { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; padding-block: 64px 56px; align-items: start; }
.eyebrow { font: 500 0.75rem/1.4 var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--plum); margin: 0 0 14px; }
h1 { font: 700 clamp(2.4rem, 5.2vw, 3.6rem)/1.02 var(--display); letter-spacing: -0.01em; margin: 0 0 20px; text-wrap: balance; }
h1 em { font-style: normal; color: var(--flare); }
.lede { font-size: 1.08rem; color: var(--muted); margin: 0 0 28px; max-width: 34rem; }
.install { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: grid; gap: 10px; }
.install label { font: 500 0.72rem/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.install .row { display: flex; gap: 10px; align-items: center; min-width: 0; }
.install code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; font: 0.82rem/1.5 var(--mono); padding-block: 4px; scrollbar-width: thin; }
button.copy { font: 600 0.8rem/1 var(--body); background: var(--flare); color: #1a1008; border: 0; border-radius: 999px; padding: 9px 14px; cursor: pointer; flex: none; }
.facts { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 18px 0 0; padding: 0; list-style: none; font: 0.8rem/1.4 var(--mono); color: var(--muted); }
.facts li::before { content: "◆ "; color: var(--plum); }

.demo { background: var(--term-bg); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; min-width: 0; }
.demo [role="tablist"] { display: flex; gap: 4px; padding: 10px 10px 0; overflow-x: auto; border-bottom: 1px solid #2c2140; }
.demo [role="tab"] { font: 500 0.82rem/1 var(--mono); color: #a99abf; background: none; border: 0; border-bottom: 2px solid transparent; padding: 10px 12px 12px; cursor: pointer; white-space: nowrap; }
.demo [role="tab"][aria-selected="true"] { color: #f2ecf8; border-bottom-color: #f2a45b; }
.caption { margin: 0; padding: 14px 18px 0; font-size: 0.86rem; color: #b9abcf; }
.term { margin: 0; padding: 14px 18px 20px; font: 0.8rem/1.6 var(--mono); color: var(--t-base); overflow-x: auto; }
.t-red { color: var(--t-red); } .t-green { color: var(--t-green); } .t-yellow { color: var(--t-yellow); }
.t-magenta { color: var(--t-magenta); } .t-cyan { color: var(--t-cyan); } .t-dim { color: var(--t-dim); } .t-bold { font-weight: 600; color: #fff; }
.t-bold.t-red, .t-bold.t-green { color: inherit; }
.sample { font: 0.72rem/1.4 var(--mono); color: #8f82a3; padding: 0 18px 14px; margin: 0; }

section.block { border-top: 1px solid var(--line); padding-block: 56px; }
h2 { font: 600 clamp(1.6rem, 3vw, 2.1rem)/1.1 var(--display); margin: 0 0 12px; text-wrap: balance; }
.intro { color: var(--muted); max-width: 40rem; margin: 0 0 32px; }
.flight { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); }

.split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; }
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
th, td { text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font: 500 0.72rem/1.4 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
td:first-child { white-space: nowrap; }
.chip { font: 600 0.74rem/1 var(--mono); padding: 4px 8px; border-radius: 4px; background: var(--raised); display: inline-block; }
.c-pass { color: var(--t-green); } .c-blocked { color: var(--t-red); } .c-action { color: var(--t-yellow); }
.c-waiting { color: var(--t-cyan); } .c-unknown { color: var(--t-magenta); } .c-info { color: var(--muted); }
@media (prefers-color-scheme: light) {
  .c-pass { color: #2f7d53; } .c-blocked { color: #b4383b; } .c-action { color: #8a5a00; } .c-waiting { color: #1f6f80; } .c-unknown { color: #8d3d96; }
}
.never { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
.never li { padding-left: 22px; position: relative; }
.never li::before { content: ""; position: absolute; left: 0; top: 0.62em; width: 10px; height: 2px; background: var(--flare); }
pre.code { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; font: 0.8rem/1.6 var(--mono); overflow-x: auto; margin: 0; }
.cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.btn { font: 600 0.9rem/1 var(--body); padding: 12px 18px; border-radius: 999px; text-decoration: none; border: 1px solid var(--line); }
.btn.primary { background: var(--flare); color: #1a1008; border-color: transparent; }
footer { border-top: 1px solid var(--line); padding-block: 28px; color: var(--muted); font: 0.8rem/1.5 var(--mono); }
footer .wrap { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

@media (max-width: 900px) {
  .hero { grid-template-columns: minmax(0, 1fr); gap: 32px; padding-block: 40px; }
  .split { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 520px) {
  .wrap { padding-inline: 16px; }
  nav { gap: 14px; }
  .term { font-size: 0.72rem; }
}
</style>
</head>
<body>
<header class="bar">
  <div class="wrap">
    <a class="mark" href="./"><i aria-hidden="true"></i>Maniflight</a>
    <nav aria-label="Primary">
      <a href="#how">How it works</a>
      <a href="#trust">Trust</a>
      <a href="./scan/">Self-scan</a>
      <a href="${REPO_URL}">GitHub</a>
    </nav>
  </div>
</header>

<main>
  <div class="wrap hero">
    <div>
      <p class="eyebrow">PR Flight Director · v${VERSION}</p>
      <h1>Why is this pull request <em>blocked</em>?</h1>
      <p class="lede">Maniflight reads every place GitHub hides a merge blocker, separates what it observed from what it could not see, and tells you who has to move next. It never writes to GitHub.</p>
      <div class="install">
        <label for="install-cmd">Install from the v${VERSION} release</label>
        <div class="row">
          <code id="install-cmd">npm install --global ${RELEASE_URL}</code>
          <button type="button" class="copy" data-copy="install-cmd">Copy</button>
        </div>
      </div>
      <ul class="facts">
        <li>Node.js 22.12+ or 24</li>
        <li>Windows · macOS · Linux</li>
        <li>MIT</li>
      </ul>
    </div>

    <div class="demo">
      <div role="tablist" aria-label="Sample pull requests">
          ${tabs}
      </div>
        ${panels}
      <p class="sample">Sample pull requests, classified and rendered by Maniflight ${VERSION}.</p>
    </div>
  </div>

  <section class="block" id="how">
    <div class="wrap">
      <p class="eyebrow">How it works</p>
      <h2>Seven GitHub sources, one flight plan</h2>
      <p class="intro">No single GitHub response explains a stuck pull request. Maniflight combines the pull request, GraphQL review state, reviews, check runs, commit statuses, hidden Actions runs, and active branch rules, then splits the result into observed blockers and evidence gaps before naming the next actor.</p>
      <picture>
        <source media="(prefers-color-scheme: light)" srcset="assets/maniflight-mission-light.svg">
        <img class="flight" src="assets/maniflight-mission-dark.svg" alt="Flight path: a pull request enters a read-only evidence scan, splits into observed blockers and evidence gaps, and converges on the next actor" width="920" height="350">
      </picture>
    </div>
  </section>

  <section class="block">
    <div class="wrap split">
      <div>
        <p class="eyebrow">Statuses</p>
        <h2>Every condition gets an honest label</h2>
        <table>
          <thead><tr><th scope="col">Status</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><td><span class="chip c-blocked">BLOCKED</span></td><td>Evidence identifies a current merge blocker.</td></tr>
            <tr><td><span class="chip c-action">ACTION</span></td><td>A person must act before progress can continue.</td></tr>
            <tr><td><span class="chip c-waiting">WAITING</span></td><td>Automation or another pending condition is not complete.</td></tr>
            <tr><td><span class="chip c-unknown">UNKNOWN</span></td><td>The available evidence cannot support a stronger conclusion.</td></tr>
            <tr><td><span class="chip c-pass">PASS</span></td><td>The observed condition completed successfully.</td></tr>
            <tr><td><span class="chip c-info">INFO</span></td><td>Relevant, but not known to block the merge.</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <p class="eyebrow">Automation</p>
        <h2>One JSON document for your tooling</h2>
        <p class="intro">Add <code>--json</code> for a schema-versioned report with signals, evidence links, next actions, and per-source coverage.</p>
<pre class="code">maniflight pr acme/payments-api#218 --json

kind           pull-request-flight
schemaVersion  1.0
outcome        status, next actors, summary
signals        conditions with evidence links
nextActions    who should do what next
collection     source coverage and warnings</pre>
      </div>
    </div>
  </section>

  <section class="block" id="trust">
    <div class="wrap split">
      <div>
        <p class="eyebrow">Trust</p>
        <h2>Read-only by design</h2>
        <ul class="never">
          <li>Only GitHub GET requests and GraphQL queries. No comments, approvals, reruns, labels, or merges.</li>
          <li>No checkout, code execution, log or artifact downloads from the repository it inspects.</li>
          <li>Missing evidence is reported as <strong>unknown</strong>, never as a guessed pass.</li>
          <li>Tokens are read from <code>GH_TOKEN</code> or <code>GITHUB_TOKEN</code> only, and never written to a report.</li>
          <li>Every report records the observation time and the exact head SHA.</li>
        </ul>
      </div>
      <div>
        <p class="eyebrow">Also included</p>
        <h2>Repository readiness scan</h2>
        <p class="intro">A second command inspects a repository's architecture, automation, security, and community health without running its code, and writes JSON plus an accessible HTML report. It also ships as a GitHub Action.</p>
        <div class="cta">
          <a class="btn primary" href="./scan/">See Maniflight's self-scan</a>
          <a class="btn" href="${REPO_URL}/blob/main/docs/REPOSITORY-SCAN.md">Scan guide</a>
        </div>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <span>Maniflight ${VERSION} · MIT licensed</span>
    <span><a href="${REPO_URL}/blob/main/docs/PR-FLIGHT.md">PR Flight guide</a> · <a href="${REPO_URL}/blob/main/docs/STABILITY.md">Stability</a> · <a href="${REPO_URL}/blob/main/SECURITY.md">Security</a></span>
  </div>
</footer>

<script>
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      other.tabIndex = selected ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !selected;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      select(tabs[(index + step + tabs.length) % tabs.length], true);
    });
  });
  for (const button of document.querySelectorAll("button[data-copy]")) {
    button.addEventListener("click", async () => {
      const text = document.getElementById(button.dataset.copy).textContent;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById(button.dataset.copy));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = "Selected";
      }
      setTimeout(() => { button.textContent = "Copy"; }, 1600);
    });
  }
})();
</script>
</body>
</html>
`;
}

const demoDirectory = resolve(root, "demo");
await mkdir(demoDirectory, { recursive: true });
const featured = scenarios[0];
if (!featured) throw new Error("Showcase requires at least one scenario");
const featuredCommand = `maniflight pr ${featured.report.pullRequest.repository}#${featured.report.pullRequest.number}`;
await writeFile(
  resolve(demoDirectory, "flight.svg"),
  terminalSvg(featured.report, featuredCommand),
);
await writeFile(resolve(demoDirectory, "landing.html"), landingHtml());
process.stdout.write("Generated demo/flight.svg and demo/landing.html\n");
