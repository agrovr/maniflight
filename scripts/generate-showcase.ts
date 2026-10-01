/**
 * Generates Maniflight's showcase assets from the real classifier and terminal renderer:
 *
 *   demo/flight.svg      terminal image used by the README
 *   demo/landing.html    the GitHub Pages landing page (the self-scan is published at /scan/)
 *
 * The sample pull requests live in showcase-scenarios.ts and run through the same
 * classify -> render path as `maniflight pr`, so the showcase cannot drift from real output.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PullRequestFlightReport } from "../src/pr/model.js";
import { renderPullRequestFlight } from "../src/pr/render.js";
import { VERSION } from "../src/version.js";
import { boardRow, scenarios } from "./showcase-scenarios.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const RELEASE_URL = `https://github.com/agrovr/maniflight/releases/download/v${VERSION}/maniflight-${VERSION}.tgz`;
const REPO_URL = "https://github.com/agrovr/maniflight";

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
  base: "#e8e2d6",
  red: "#ff6b62",
  green: "#6fdc8c",
  yellow: "#ffc84a",
  magenta: "#e58ef0",
  cyan: "#5fd1e4",
  dim: "#7d8794",
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
  <rect width="${width}" height="${height}" rx="14" fill="#0b0e13"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="13.5" fill="none" stroke="#2a3340"/>
  <circle cx="26" cy="22" r="5.5" fill="#ff7a72"/><circle cx="44" cy="22" r="5.5" fill="#f6c76b"/><circle cx="62" cy="22" r="5.5" fill="#86d6a6"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, DejaVu Sans Mono, monospace" font-size="14">
    <text y="54" xml:space="preserve"><tspan x="${left}" fill="#ffb43d">$</tspan><tspan x="${(left + 2 * CHAR_WIDTH).toFixed(1)}" fill="#7d8794">${escapeXml(command)}</tspan></text>
${body}
  </g>
</svg>
`;
}

// ---------- landing page ----------

const FLAP_COLOR: Record<string, string> = {
  BLOCKED: "red",
  ACTION: "yellow",
  WAITING: "cyan",
  UNKNOWN: "magenta",
  READY: "green",
  MERGED: "green",
  CLOSED: "dim",
};

function flaps(text: string, width: number, tone: string): string {
  return [...text.padEnd(width)]
    .map((ch) =>
      ch === " "
        ? '<span class="flap blank" aria-hidden="true"></span>'
        : `<span class="flap ${tone}" aria-hidden="true">${escapeXml(ch)}</span>`,
    )
    .join("");
}

function landingHtml(): string {
  const rows = scenarios
    .map((scenario, index) => {
      const row = boardRow(scenario.report);
      const label = `Pull request ${row.number}, branch ${row.branch.toLowerCase()}, status ${row.status.toLowerCase()}, next actor ${row.next.toLowerCase()}`;
      return `<button type="button" class="row" role="tab" id="row-${scenario.id}" aria-controls="log-${scenario.id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" aria-label="${escapeXml(label)}">
            <span class="cell c-num">${flaps(row.number, 5, "text")}</span>
            <span class="cell c-branch">${flaps(row.branch, 15, "amber")}</span>
            <span class="cell c-status">${flaps(row.status, 7, FLAP_COLOR[row.status] ?? "amber")}</span>
            <span class="cell c-next">${flaps(row.next, 11, "amber")}</span>
          </button>`;
    })
    .join("\n          ");

  const logs = scenarios
    .map((scenario, index) => {
      const pr = scenario.report.pullRequest;
      const row = boardRow(scenario.report);
      const command = `maniflight pr ${pr.repository}#${pr.number}`;
      const actors = scenario.report.outcome.nextActors;
      return `<article class="log" role="tabpanel" id="log-${scenario.id}" aria-labelledby="row-${scenario.id}"${index === 0 ? "" : " hidden"}>
          <div class="log-head">
            <div class="log-meta">
              <p class="eyebrow">Flight log · sample</p>
              <h3>${escapeXml(`${pr.repository}#${pr.number}`)}</h3>
              <p class="log-title">${escapeXml(pr.title)}</p>
              <p class="log-caption">${escapeXml(scenario.caption)}</p>
              <dl class="facts-grid">
                <div><dt>Status</dt><dd><span class="chip ${FLAP_COLOR[row.status] ?? "amber"}">${row.status}</span></dd></div>
                <div><dt>Next actors</dt><dd>${escapeXml(actors.length > 0 ? actors.join(", ") : "none")}</dd></div>
                <div><dt>Head</dt><dd><code>${escapeXml(pr.head.sha.slice(0, 12))}</code></dd></div>
                <div><dt>Steps</dt><dd>${scenario.report.nextActions.length}</dd></div>
              </dl>
            </div>
            <div class="view-switch" role="group" aria-label="Output format">
              <button type="button" class="switch" data-view="term" aria-pressed="true">Terminal</button>
              <button type="button" class="switch" data-view="json" aria-pressed="false">JSON</button>
              <button type="button" class="copy ghost" data-copy-from="json-${scenario.id}">Copy JSON</button>
            </div>
          </div>
          <div class="screen">
            <pre class="term view-term" tabindex="0"><span class="t-amber">$</span> ${escapeXml(command)}

${terminalHtml(scenario.report)}</pre>
            <pre class="term view-json" id="json-${scenario.id}" tabindex="0" hidden>${escapeXml(JSON.stringify(scenario.report, null, 2))}</pre>
          </div>
        </article>`;
    })
    .join("\n        ");

  const legend = [
    ["BLOCKED", "red", "Evidence identifies a current merge blocker."],
    ["ACTION", "yellow", "A person must act before progress can continue."],
    ["WAITING", "cyan", "Automation or another pending condition is not complete."],
    ["UNKNOWN", "magenta", "The available evidence cannot support a stronger conclusion."],
    ["PASS", "green", "The observed condition completed successfully."],
    ["INFO", "dim", "Relevant, but not known to block the merge."],
  ]
    .map(
      ([code, tone, meaning]) =>
        `<li><span class="legend-code">${flaps(code ?? "", 7, tone ?? "amber")}</span><span>${escapeXml(meaning ?? "")}</span></li>`,
    )
    .join("\n            ");

  const faq: [string, string][] = [
    [
      "Does it need a GitHub token?",
      "No, public pull requests work without one. GitHub's GraphQL API requires authentication, though, so without a token the review decision and review threads are reported under Evidence gaps. Set <code>GH_TOKEN</code> or <code>GITHUB_TOKEN</code> with read access for the complete picture.",
    ],
    [
      "Can it change anything on GitHub?",
      "No. Maniflight sends GET requests and GraphQL queries only. It never comments, approves, reruns, labels, merges, or dispatches workflows, and it never checks out or runs code from the repository.",
    ],
    [
      "Why does it say UNKNOWN instead of a verdict?",
      "Because the evidence it could see does not support one. Missing or inaccessible sources are reported as unknown on purpose, so a hidden blocker is never presented as a pass.",
    ],
    [
      "What exit code does a blocked pull request return?",
      "Zero. A blocked PR is a successful diagnosis. The command exits with 1 only for invalid input or when the pull request itself cannot be fetched.",
    ],
    [
      "Does it support GitHub Enterprise Server?",
      "Not in 1.x. Maniflight targets GitHub.com's REST and GraphQL APIs.",
    ],
    [
      "Is it on the npm registry?",
      "Not yet. Install from the GitHub release archive. Registry publishing is planned once package ownership and provenance are verified.",
    ],
  ];
  const faqHtml = faq
    .map(
      ([question, answer]) =>
        `<details><summary>${escapeXml(question)}</summary><p>${answer}</p></details>`,
    )
    .join("\n          ");

  const actionYaml = `name: Repository diagnostics

on:
  pull_request:

permissions:
  contents: read

jobs:
  maniflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - uses: agrovr/maniflight@v1
        with:
          github-token: \${{ github.token }}
          fail-on-high: true`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maniflight</title>
<meta name="description" content="Read-only GitHub pull-request diagnostics: why a PR is blocked, what evidence is missing, and who has to move next.">
<meta name="theme-color" content="#0b0e13">
<meta property="og:title" content="Maniflight · PR Flight Director">
<meta property="og:description" content="Why is this pull request blocked, and who has to move next?">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231a212b'/%3E%3Cpath d='M2 16h28' stroke='%2307090c' stroke-width='1.5'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='Arial' font-weight='700' font-size='20' fill='%23ffb43d'%3EM%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: an airport departure hall. A split-flap board is the hero; every section below reads like signage. */
:root {
  --night: #0b0e13;
  --board: #11161d;
  --tile: #1a212b;
  --tile-edge: #232c38;
  --seam: #07090c;
  --line: #222b37;
  --text: #e8e2d6;
  --muted: #8a94a1;
  --amber: #ffb43d;
  --amber-soft: rgba(255, 180, 61, 0.12);
  --red: #ff6b62; --yellow: #ffc84a; --cyan: #5fd1e4; --magenta: #e58ef0; --green: #6fdc8c; --dim: #7d8794;
  --display: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --flap-w: 1.45rem;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { margin: 0; background: var(--night); color: var(--text); font: 16px/1.6 var(--body); }
a { color: var(--text); text-decoration-color: rgba(255, 180, 61, 0.5); text-underline-offset: 3px; }
a:hover { color: var(--amber); }
:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; border-radius: 4px; }
code { font: 0.9em var(--mono); color: var(--amber); }
.wrap { max-width: 1160px; margin: 0 auto; padding-inline: 20px; }
.eyebrow { font: 500 0.72rem/1.4 var(--mono); letter-spacing: 0.18em; text-transform: uppercase; color: var(--amber); margin: 0 0 12px; }
.skip { position: absolute; left: -999px; }
.skip:focus { left: 16px; top: 16px; background: var(--amber); color: var(--night); padding: 8px 12px; z-index: 10; }

/* split-flap tiles */
.flap { display: inline-grid; place-items: center; width: var(--flap-w); height: calc(var(--flap-w) * 1.28); margin-right: 3px; background: var(--tile); border: 1px solid var(--tile-edge); border-radius: 3px; font: 600 calc(var(--flap-w) * 0.62)/1 var(--mono); position: relative; isolation: isolate; color: var(--amber); }
/* Hinge between the flaps, painted behind the glyph so it never cuts through a letter. */
.flap::after { content: ""; position: absolute; z-index: -1; left: 1px; right: 1px; top: 50%; height: 1px; background: var(--seam); opacity: 0.7; }
.flap.blank { color: transparent; }
.flap.text { color: var(--text); } .flap.red { color: var(--red); } .flap.yellow { color: var(--yellow); } .flap.cyan { color: var(--cyan); }
.flap.magenta { color: var(--magenta); } .flap.green { color: var(--green); } .flap.dim { color: var(--dim); }

header.bar { position: sticky; top: 0; z-index: 5; background: rgba(11, 14, 19, 0.9); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
header.bar .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-block: 12px; flex-wrap: wrap; }
.mark { display: inline-flex; text-decoration: none; --flap-w: 1.15rem; }
.mark .flap { margin-right: 2px; font-family: var(--display); font-weight: 800; font-size: 0.95rem; }
nav { display: flex; gap: 22px; font-size: 0.9rem; flex-wrap: wrap; }
nav a { text-decoration: none; color: var(--muted); }
nav a:hover { color: var(--amber); }

.hero { padding-block: 64px 24px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px 48px; align-items: end; }
h1 { font: 900 clamp(3rem, 8vw, 6.4rem)/0.9 var(--display); text-transform: uppercase; margin: 0; letter-spacing: 0.005em; text-wrap: balance; }
h1 em { font-style: normal; color: var(--amber); }
.lede { color: var(--muted); max-width: 36rem; margin: 18px 0 0; font-size: 1.08rem; }
.cta { display: flex; flex-wrap: wrap; gap: 12px; }
.btn { font: 600 0.92rem/1 var(--body); padding: 13px 20px; border-radius: 6px; text-decoration: none; border: 1px solid var(--line); color: var(--text); display: inline-flex; gap: 8px; align-items: center; }
.btn.primary { background: var(--amber); color: var(--night); border-color: var(--amber); }
.btn.primary:hover { color: var(--night); filter: brightness(1.08); }

/* board */
.board { background: var(--board); border: 1px solid var(--line); border-radius: 14px; margin-top: 36px; overflow: hidden; }
.board-top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 20px; border-bottom: 1px solid var(--line); font: 500 0.74rem/1.4 var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.board-top b { color: var(--amber); font-weight: 600; }
.board-scroll { overflow-x: auto; padding: 10px 12px 14px; }
.board-grid { min-width: max-content; }
.labels, .row { display: grid; grid-template-columns: calc((var(--flap-w) + 3px) * 5) calc((var(--flap-w) + 3px) * 15) calc((var(--flap-w) + 3px) * 7) calc((var(--flap-w) + 3px) * 11); column-gap: calc(var(--flap-w) * 0.9); }
.labels { padding: 6px 12px 8px 16px; font: 500 0.68rem/1 var(--mono); letter-spacing: 0.16em; color: var(--muted); }
.row { width: 100%; background: none; border: 0; border-left: 3px solid transparent; padding: 5px 12px 5px 13px; cursor: pointer; text-align: left; border-radius: 4px; color: inherit; }
.row:hover { background: rgba(255, 255, 255, 0.025); }
.row[aria-selected="true"] { background: var(--amber-soft); border-left-color: var(--amber); }
.cell { display: flex; }
.board-hint { padding: 0 20px 14px; margin: 0; font: 0.78rem/1.4 var(--mono); color: var(--muted); }

/* flight log */
.logs { margin-top: 20px; }
.log { background: var(--board); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.log-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px 24px; padding: 22px 24px 18px; border-bottom: 1px solid var(--line); align-items: start; }
.log h3 { font: 800 1.9rem/1 var(--display); margin: 0; letter-spacing: 0.01em; }
.log-title { margin: 4px 0 10px; color: var(--text); }
.log-caption { margin: 0 0 16px; color: var(--muted); max-width: 46rem; }
.facts-grid { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 0; }
.facts-grid dt { font: 500 0.66rem/1.4 var(--mono); letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
.facts-grid dd { margin: 2px 0 0; font: 500 0.92rem/1.4 var(--mono); }
.chip { font: 600 0.78rem/1 var(--mono); padding: 4px 8px; border-radius: 3px; background: var(--tile); border: 1px solid var(--tile-edge); letter-spacing: 0.06em; }
.chip.red { color: var(--red); } .chip.yellow { color: var(--yellow); } .chip.cyan { color: var(--cyan); } .chip.magenta { color: var(--magenta); } .chip.green { color: var(--green); }
.view-switch { display: flex; gap: 6px; flex-wrap: wrap; }
.switch, .copy { font: 600 0.8rem/1 var(--mono); border-radius: 5px; padding: 9px 12px; cursor: pointer; border: 1px solid var(--line); background: var(--tile); color: var(--muted); }
.switch[aria-pressed="true"] { color: var(--night); background: var(--amber); border-color: var(--amber); }
.copy { background: var(--amber); color: var(--night); border-color: var(--amber); }
.copy.ghost { background: transparent; color: var(--text); border-color: var(--line); }
.screen { background: var(--night); }
.term { margin: 0; padding: 20px 24px 24px; font: 0.82rem/1.65 var(--mono); color: var(--text); overflow: auto; max-height: 34rem; }
.t-red { color: var(--red); } .t-green { color: var(--green); } .t-yellow { color: var(--yellow); } .t-magenta { color: var(--magenta); }
.t-cyan { color: var(--cyan); } .t-dim { color: var(--dim); } .t-amber { color: var(--amber); } .t-bold { font-weight: 600; color: #fff; }

/* sections */
section.block { padding-block: 80px 0; }
.section-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px 48px; align-items: end; margin-bottom: 32px; }
h2 { font: 800 clamp(2rem, 4.2vw, 3.2rem)/0.95 var(--display); text-transform: uppercase; margin: 0; letter-spacing: 0.01em; text-wrap: balance; }
.section-head p { color: var(--muted); margin: 0; }

.builder { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
.panel { background: var(--board); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; min-width: 0; }
.field label { display: block; font: 500 0.7rem/1.4 var(--mono); letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.field input[type="text"] { width: 100%; font: 0.95rem/1.4 var(--mono); color: var(--text); background: var(--night); border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px; }
.field input[type="text"]:focus { border-color: var(--amber); outline: none; box-shadow: 0 0 0 3px var(--amber-soft); }
.status-line { min-height: 1.5em; margin: 10px 0 0; font: 0.84rem/1.5 var(--mono); }
.status-line.ok { color: var(--green); } .status-line.err { color: var(--red); }
.options { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 16px; font-size: 0.92rem; }
.options label { display: inline-flex; gap: 8px; align-items: center; cursor: pointer; }
.options input { accent-color: var(--amber); width: 16px; height: 16px; }
.examples { margin-top: 18px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 0.82rem; color: var(--muted); }
.example { font: 0.78rem/1 var(--mono); background: var(--tile); color: var(--text); border: 1px solid var(--line); border-radius: 4px; padding: 6px 8px; cursor: pointer; }
.cmd { background: var(--night); border: 1px solid var(--line); border-radius: 8px; padding: 16px; font: 0.86rem/1.7 var(--mono); white-space: pre-wrap; word-break: break-all; margin: 0 0 14px; }
.cmd .c { color: var(--dim); }
.panel .row-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.note { color: var(--muted); font-size: 0.84rem; margin: 14px 0 0; }

.flow { display: block; width: 100%; height: auto; border-radius: 14px; }
.legend { list-style: none; padding: 0; margin: 28px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 12px 32px; }
.legend li { display: flex; gap: 16px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); --flap-w: 1.15rem; min-width: 0; }
.legend-code { display: flex; flex: none; }
.legend li > span:last-child { color: var(--muted); font-size: 0.92rem; }

.tabs { display: flex; gap: 6px; margin-bottom: 14px; }
pre.code { background: var(--night); border: 1px solid var(--line); border-radius: 8px; padding: 16px; font: 0.82rem/1.65 var(--mono); overflow-x: auto; margin: 0 0 14px; }
.two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.trust { list-style: none; padding: 0; margin: 0; display: grid; gap: 0; }
.trust li { display: grid; grid-template-columns: 9rem minmax(0, 1fr); gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.trust b { font: 600 0.72rem/1.6 var(--mono); letter-spacing: 0.16em; text-transform: uppercase; color: var(--amber); }
.trust span { color: var(--muted); }
.faq details { border-bottom: 1px solid var(--line); padding: 4px 0; }
.faq summary { cursor: pointer; padding: 14px 0; font-weight: 600; list-style: none; display: flex; justify-content: space-between; gap: 16px; }
.faq summary::after { content: "+"; font: 600 1.2rem/1 var(--mono); color: var(--amber); }
.faq details[open] summary::after { content: "−"; }
.faq summary::-webkit-details-marker { display: none; }
.faq p { margin: 0 0 16px; color: var(--muted); max-width: 52rem; }

footer { margin-top: 96px; border-top: 1px solid var(--line); padding-block: 28px 40px; color: var(--muted); font: 0.8rem/1.6 var(--mono); }
footer .wrap { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
footer a { color: var(--muted); }

@media (max-width: 900px) {
  .hero { grid-template-columns: minmax(0, 1fr); padding-block: 40px 8px; }
  .section-head, .builder, .two, .log-head { grid-template-columns: minmax(0, 1fr); }
  .trust li { grid-template-columns: minmax(0, 1fr); gap: 4px; }
}
@media (max-width: 640px) {
  :root { --flap-w: 0.95rem; }
  .board-scroll { padding-inline: 4px; }
  .row { padding-inline: 8px 6px; }
  .labels .l-branch, .row .c-branch { display: none; }
  .labels, .row { grid-template-columns: calc((var(--flap-w) + 3px) * 5) calc((var(--flap-w) + 3px) * 7) calc((var(--flap-w) + 3px) * 11); }
  nav { gap: 14px; font-size: 0.85rem; }
  .term { font-size: 0.72rem; padding: 16px; }
  .legend { grid-template-columns: minmax(0, 1fr); }
}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="bar">
  <div class="wrap">
    <a class="mark" href="./" aria-label="Maniflight home">${flaps("MANIFLIGHT", 10, "amber")}</a>
    <nav aria-label="Primary">
      <a href="#try">Try it</a>
      <a href="#how">How it works</a>
      <a href="#install">Install</a>
      <a href="#faq">FAQ</a>
      <a href="./scan/">Self-scan</a>
      <a href="${REPO_URL}">GitHub</a>
    </nav>
  </div>
</header>

<main id="main">
  <div class="wrap">
    <div class="hero">
      <div>
        <p class="eyebrow">PR Flight Director · v${VERSION} · read-only</p>
        <h1>Why is this pull request <em>blocked?</em></h1>
        <p class="lede">Maniflight reads every place GitHub hides a merge blocker, separates what it observed from what it could not see, and tells each person what to do next. It never writes to GitHub.</p>
      </div>
      <div class="cta">
        <a class="btn primary" href="#install">Install v${VERSION}</a>
        <a class="btn" href="#try">Build a command</a>
      </div>
    </div>

    <div class="board" aria-label="Sample departures">
      <div class="board-top"><span><b>Departures</b> · acme/payments-api</span><span>Observed 16:00 UTC · base main</span></div>
      <div class="board-scroll">
        <div class="board-grid">
          <div class="labels" aria-hidden="true"><span>PR</span><span class="l-branch">BRANCH</span><span>STATUS</span><span>NEXT ACTOR</span></div>
          <div role="tablist" aria-label="Sample pull requests" aria-orientation="vertical">
          ${rows}
          </div>
        </div>
      </div>
      <p class="board-hint">Select a departure to open its flight log. Samples are fictional pull requests classified by Maniflight ${VERSION}.</p>
    </div>

    <div class="logs">
        ${logs}
    </div>
  </div>

  <section class="block" id="try">
    <div class="wrap">
      <div class="section-head">
        <div><p class="eyebrow">Pre-flight check</p><h2>Paste a pull request, get the command</h2></div>
        <p>Paste a GitHub pull request link or an <code>owner/repository#number</code> reference. It is checked with the same rules the CLI uses, right here in your browser.</p>
      </div>
      <div class="builder">
        <div class="panel">
          <div class="field">
            <label for="pr-input">Pull request</label>
            <input type="text" id="pr-input" autocomplete="off" spellcheck="false" placeholder="https://github.com/owner/repository/pull/123" aria-describedby="pr-status">
            <p class="status-line" id="pr-status" role="status"></p>
          </div>
          <div class="options">
            <label><input type="checkbox" id="opt-json"> JSON output</label>
            <label><input type="checkbox" id="opt-token" checked> Use my GitHub CLI token</label>
            <label><input type="checkbox" id="opt-nocolor"> No color</label>
          </div>
          <div class="examples"><span>Try:</span>
            <button type="button" class="example" data-example="https://github.com/acme/payments-api/pull/231">a PR link</button>
            <button type="button" class="example" data-example="acme/payments-api#218">a short reference</button>
            <button type="button" class="example" data-example="acme/payments-api/pull/x">something invalid</button>
          </div>
        </div>
        <div class="panel">
          <pre class="cmd" id="cmd" aria-live="polite"><span class="c"># Paste a pull request on the left</span></pre>
          <div class="row-actions">
            <button type="button" class="copy" id="copy-cmd" disabled>Copy command</button>
          </div>
          <p class="note">Nothing is sent anywhere. The command runs on your machine with your own token, and Maniflight only reads from GitHub.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="block" id="how">
    <div class="wrap">
      <div class="section-head">
        <div><p class="eyebrow">How it works</p><h2>Seven sources, one flight plan</h2></div>
        <p>No single GitHub response explains a stuck pull request. Maniflight collects each source with read-only requests, records its coverage, and classifies every condition with deterministic rules.</p>
      </div>
      <img class="flow" src="assets/flow.svg" alt="Seven read-only GitHub sources feed deterministic rules, which split into observed conditions, evidence gaps, and next steps" width="1280" height="500" loading="lazy">
      <ul class="legend" aria-label="Status meanings">
            ${legend}
      </ul>
    </div>
  </section>

  <section class="block" id="install">
    <div class="wrap">
      <div class="section-head">
        <div><p class="eyebrow">Install</p><h2>Ready for boarding</h2></div>
        <p>Node.js 22.12+ or 24 on Windows, macOS, or Linux. Maniflight ships as a GitHub release archive.</p>
      </div>
      <div class="two">
        <div class="panel">
          <div class="tabs" role="group" aria-label="Install method">
            <button type="button" class="switch" data-install="release" aria-pressed="true">Release</button>
            <button type="button" class="switch" data-install="source" aria-pressed="false">From source</button>
          </div>
          <pre class="code" id="install-release">npm install --global ${RELEASE_URL}
maniflight --version</pre>
          <pre class="code" id="install-source" hidden>git clone ${REPO_URL}.git
cd maniflight
npm ci
npm run build
node dist/cli.js --help</pre>
          <button type="button" class="copy" id="copy-install">Copy</button>
        </div>
        <div class="panel">
          <p class="eyebrow">Also on board</p>
          <h3 class="panel-title" style="font:800 1.7rem/1 var(--display);text-transform:uppercase;margin:0 0 10px">Repository scan &amp; Action</h3>
          <p style="color:var(--muted);margin:0 0 16px">Grade a repository's architecture, automation, security hygiene, and community health without running its code. Gate CI on score, severity, or regressions.</p>
          <pre class="code" id="action-yaml">${escapeXml(actionYaml)}</pre>
          <div class="row-actions">
            <button type="button" class="copy" data-copy-from="action-yaml">Copy workflow</button>
            <a class="btn" href="./scan/">See the self-scan</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="block" id="trust">
    <div class="wrap two">
      <div>
        <p class="eyebrow">Trust</p>
        <h2>Read-only by design</h2>
      </div>
      <ul class="trust">
        <li><b>Read-only</b><span>GET requests and GraphQL queries only. No comments, approvals, reruns, labels, merges, or dispatches.</span></li>
        <li><b>No execution</b><span>No checkout, code execution, or log and artifact downloads from the inspected repository.</span></li>
        <li><b>Evidence-linked</b><span>Every report records the observation time and exact head SHA, and conclusions link to their source.</span></li>
        <li><b>Honest gaps</b><span>Missing evidence is reported as unknown, never as a guessed pass.</span></li>
        <li><b>Token-safe</b><span>Tokens are read from the environment only and are never written to a report.</span></li>
      </ul>
    </div>
  </section>

  <section class="block faq" id="faq">
    <div class="wrap two">
      <div>
        <p class="eyebrow">FAQ</p>
        <h2>Before you take off</h2>
      </div>
      <div>
          ${faqHtml}
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <span>Maniflight ${VERSION} · MIT licensed · not affiliated with GitHub</span>
    <span><a href="${REPO_URL}/blob/main/docs/PR-FLIGHT.md">PR Flight guide</a> · <a href="${REPO_URL}/blob/main/docs/STABILITY.md">Stability</a> · <a href="${REPO_URL}/blob/main/CHANGELOG.md">Changelog</a> · <a href="${REPO_URL}/blob/main/SECURITY.md">Security</a></span>
  </div>
</footer>

<script>
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Split-flap arrival: each tile cycles a few glyphs before settling on its real character.
  if (!reduce) {
    var glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#-";
    document.querySelectorAll(".board .row").forEach(function (row, r) {
      row.querySelectorAll(".flap:not(.blank)").forEach(function (tile, c) {
        var final = tile.textContent;
        var flips = 5 + ((r + c) % 5);
        var start = 120 + r * 110 + c * 18;
        for (var i = 0; i < flips; i++) {
          (function (n) {
            setTimeout(function () {
              tile.textContent = n === flips - 1 ? final : glyphs.charAt((r * 7 + c * 3 + n * 11) % glyphs.length);
            }, start + n * 55);
          })(i);
        }
      });
    });
  }

  // Board rows behave as vertical tabs controlling the flight logs.
  var rows = Array.prototype.slice.call(document.querySelectorAll('.board [role="tab"]'));
  function select(row, focus) {
    rows.forEach(function (other) {
      var on = other === row;
      other.setAttribute("aria-selected", String(on));
      other.tabIndex = on ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) row.focus();
  }
  rows.forEach(function (row, i) {
    row.addEventListener("click", function () { select(row, false); });
    row.addEventListener("keydown", function (event) {
      var step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (event.key === "Home") { event.preventDefault(); select(rows[0], true); return; }
      if (event.key === "End") { event.preventDefault(); select(rows[rows.length - 1], true); return; }
      if (!step) return;
      event.preventDefault();
      select(rows[(i + step + rows.length) % rows.length], true);
    });
  });

  // Terminal / JSON switch inside each flight log.
  document.querySelectorAll(".log").forEach(function (log) {
    log.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        var view = button.getAttribute("data-view");
        log.querySelectorAll("[data-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === button)); });
        log.querySelector(".view-term").hidden = view !== "term";
        log.querySelector(".view-json").hidden = view !== "json";
      });
    });
  });

  // Install method switch.
  var copyInstall = document.getElementById("copy-install");
  copyInstall.setAttribute("data-copy-from", "install-release");
  document.querySelectorAll("[data-install]").forEach(function (button) {
    button.addEventListener("click", function () {
      var which = button.getAttribute("data-install");
      document.querySelectorAll("[data-install]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === button)); });
      document.getElementById("install-release").hidden = which !== "release";
      document.getElementById("install-source").hidden = which !== "source";
      copyInstall.setAttribute("data-copy-from", "install-" + which);
    });
  });

  function copyText(button, text) {
    var label = button.textContent;
    function done(message) { button.textContent = message; setTimeout(function () { button.textContent = label; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done("Copied"); }, function () { done("Select and copy"); });
    } else {
      done("Select and copy");
    }
  }
  document.querySelectorAll("[data-copy-from]").forEach(function (button) {
    button.addEventListener("click", function () {
      copyText(button, document.getElementById(button.getAttribute("data-copy-from")).textContent);
    });
  });

  // Pre-flight check: mirrors parsePullRequestReference and parseRepositorySlug.
  var input = document.getElementById("pr-input");
  var status = document.getElementById("pr-status");
  var cmd = document.getElementById("cmd");
  var copyCmd = document.getElementById("copy-cmd");
  var current = "";
  var SLUG = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\\/([A-Za-z0-9_.-]{1,100})$/;

  function parse(raw) {
    var value = raw.trim();
    if (!value) return { empty: true };
    var url = value.match(/^(?:https?:\\/\\/)?(?:www\\.)?github\\.com\\/([^/\\s]+)\\/([^/\\s]+)\\/pull\\/([^/?#\\s]+)(?:[/?#].*)?$/i);
    var repository, number;
    if (url) {
      repository = url[1] + "/" + url[2];
      number = url[3];
    } else {
      var hash = value.lastIndexOf("#");
      if (hash <= 0 || hash !== value.indexOf("#")) return { error: "Use a pull request link or owner/repository#number." };
      repository = value.slice(0, hash);
      number = value.slice(hash + 1);
    }
    var slug = SLUG.exec(repository);
    if (!slug || slug[2] === "." || slug[2] === "..") return { error: "That repository name is not a valid owner/name." };
    if (!/^[1-9]\\d*$/.test(number) || !Number.isSafeInteger(Number(number))) return { error: "The pull request number must be a positive whole number." };
    return { reference: slug[1] + "/" + slug[2] + "#" + number };
  }

  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function update() {
    var result = parse(input.value);
    if (result.empty) {
      status.textContent = ""; status.className = "status-line";
      cmd.innerHTML = '<span class="c"># Paste a pull request on the left</span>';
      copyCmd.disabled = true; current = ""; return;
    }
    if (result.error) {
      status.textContent = result.error; status.className = "status-line err";
      cmd.innerHTML = '<span class="c"># Waiting for a valid pull request</span>';
      copyCmd.disabled = true; current = ""; return;
    }
    status.textContent = "Valid reference: " + result.reference; status.className = "status-line ok";
    var flags = (document.getElementById("opt-json").checked ? " --json" : "") + (document.getElementById("opt-nocolor").checked ? " --no-color" : "");
    var line = "maniflight pr " + result.reference + flags;
    var lines = [];
    if (document.getElementById("opt-token").checked) lines.push('export GH_TOKEN="$(gh auth token)"');
    lines.push(line);
    current = lines.join("\\n");
    cmd.innerHTML = (document.getElementById("opt-token").checked ? '<span class="c"># reuse your GitHub CLI login; Maniflight only reads with it</span>\\n' : "") + escapeHtml(current);
    copyCmd.disabled = false;
  }
  input.addEventListener("input", update);
  ["opt-json", "opt-token", "opt-nocolor"].forEach(function (id) { document.getElementById(id).addEventListener("change", update); });
  document.querySelectorAll("[data-example]").forEach(function (button) {
    button.addEventListener("click", function () { input.value = button.getAttribute("data-example"); update(); input.focus(); });
  });
  copyCmd.addEventListener("click", function () { if (current) copyText(copyCmd, current); });
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
