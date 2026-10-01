// Maniflight repository report styles: the departure-board identity used by the
// website and README. The report ships under a strict CSP (no external fonts or
// images), so typography uses system stacks and every tile is plain HTML and CSS.
export const REPORT_STYLES = `
:root {
  color-scheme: dark light;
  --bg: #0b0e13;
  --surface: #11161d;
  --surface-raised: #161c25;
  --surface-active: #1f2731;
  --tile: #1a212b;
  --tile-edge: #232c38;
  --seam: #07090c;
  --ink: #e8e2d6;
  --muted: #a7afba;
  --quiet: #8a94a1;
  --line: #222b37;
  --line-strong: #3a4656;
  --accent: #ffb43d;
  --accent-ink: #0b0e13;
  --accent-soft: rgba(255, 180, 61, 0.1);
  --pass: #6fdc8c;
  --warn: #ffc84a;
  --fail: #ff6b62;
  --unknown: #e58ef0;
  --skip: #7d8794;
  --focus: #ffb43d;
  --max-width: 74rem;
  --radius: 12px;
  --flap-w: 1.3rem;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sans: "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --display: "Arial Narrow", "Helvetica Neue Condensed", "Roboto Condensed", var(--sans);
  font-family: var(--sans);
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #f6f2ea;
    --surface: #fffdf8;
    --surface-raised: #f0ebe1;
    --surface-active: #e9e1d2;
    --tile: #1f2630;
    --tile-edge: #2d3643;
    --seam: #0b0e13;
    --ink: #1c1f24;
    --muted: #4c5562;
    --quiet: #5f6875;
    --line: #ddd5c6;
    --line-strong: #b9ae9b;
    --accent: #a35f00;
    --accent-ink: #ffffff;
    --accent-soft: rgba(163, 95, 0, 0.1);
    --pass: #1d7a45;
    --warn: #8a5a00;
    --fail: #b4383b;
    --unknown: #8d3d96;
    --skip: #5f6875;
    --focus: #a35f00;
  }
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f6f2ea;
  --surface: #fffdf8;
  --surface-raised: #f0ebe1;
  --surface-active: #e9e1d2;
  --tile: #1f2630;
  --tile-edge: #2d3643;
  --seam: #0b0e13;
  --ink: #1c1f24;
  --muted: #4c5562;
  --quiet: #5f6875;
  --line: #ddd5c6;
  --line-strong: #b9ae9b;
  --accent: #a35f00;
  --accent-ink: #ffffff;
  --accent-soft: rgba(163, 95, 0, 0.1);
  --pass: #1d7a45;
  --warn: #8a5a00;
  --fail: #b4383b;
  --unknown: #8d3d96;
  --skip: #5f6875;
  --focus: #a35f00;
}

:root[data-theme="dark"] {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.6 var(--sans);
}

a {
  color: inherit;
  text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent);
  text-underline-offset: 3px;
}

a:hover {
  color: var(--accent);
}

:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
  border-radius: 4px;
}

code {
  font: 0.88em var(--mono);
  color: var(--accent);
  overflow-wrap: anywhere;
}

h1,
h2,
h3 {
  text-wrap: balance;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: -999px;
  top: 0.75rem;
  z-index: 10;
  background: var(--accent);
  color: var(--accent-ink);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
}

.skip-link:focus {
  left: 1rem;
}

.eyebrow {
  margin: 0 0 0.6rem;
  font: 600 0.72rem/1.4 var(--mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}

/* Split-flap tiles. The hinge sits behind each glyph so it never cuts a letter. */
.flaps {
  display: inline-flex;
  gap: 3px;
  flex: none;
}

.flap {
  display: inline-grid;
  place-items: center;
  width: var(--flap-w);
  height: calc(var(--flap-w) * 1.3);
  background: var(--tile);
  border: 1px solid var(--tile-edge);
  border-radius: 3px;
  font: 700 calc(var(--flap-w) * 0.62) / 1 var(--mono);
  color: #ffb43d;
  position: relative;
  isolation: isolate;
}

.flap::after {
  content: "";
  position: absolute;
  z-index: -1;
  left: 1px;
  right: 1px;
  top: 50%;
  height: 1px;
  background: var(--seam);
  opacity: 0.75;
}

.flap-blank {
  color: transparent;
}

.flaps-quiet .flap {
  color: #e8e2d6;
}

.flaps.status-pass .flap {
  color: #6fdc8c;
}

.flaps.status-warn .flap {
  color: #ffc84a;
}

.flaps.status-fail .flap {
  color: #ff6b62;
}

.flaps.status-unknown .flap {
  color: #e58ef0;
}

.flaps.status-skip .flap {
  color: #7d8794;
}

/* Top bar */
.topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem max(1rem, calc((100vw - var(--max-width)) / 2));
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.product-label {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.flaps-mark {
  --flap-w: 1.05rem;
}

.flaps-mark .flap {
  font-family: var(--display);
  font-size: 0.85rem;
}

.product-sub {
  font: 600 0.72rem/1 var(--mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--quiet);
}

.theme-toggle,
.clear-filters {
  font: 600 0.8rem/1 var(--mono);
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 0.6rem 0.85rem;
  cursor: pointer;
}

.theme-toggle:hover,
.clear-filters:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* Layout */
.shell {
  width: min(100% - 2rem, var(--max-width));
  margin: 0 auto;
  padding-block: 2.5rem 3rem;
  display: grid;
  gap: 3.5rem;
}

.section-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem 2.5rem;
  align-items: end;
  margin-bottom: 1.25rem;
}

.section-heading h2 {
  margin: 0;
  font: 800 clamp(1.6rem, 3.4vw, 2.3rem) / 1 var(--display);
  text-transform: uppercase;
  letter-spacing: 0.01em;
}

.section-heading p {
  margin: 0;
  color: var(--muted);
}

/* Summary */
.summary {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 2rem 3rem;
  align-items: start;
}

.repository-path {
  margin: 0 0 0.4rem;
  font: 600 0.9rem/1.4 var(--mono);
  color: var(--accent);
}

.summary h1 {
  margin: 0 0 1rem;
  font: 800 clamp(2.4rem, 6vw, 4.2rem) / 0.95 var(--display);
  text-transform: uppercase;
  letter-spacing: 0.005em;
}

.summary-text {
  margin: 0 0 1.25rem;
  max-width: 40rem;
  color: var(--muted);
  font-size: 1.05rem;
}

.priority-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.priority-links > span {
  font: 600 0.7rem/1.4 var(--mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--quiet);
  margin-right: 0.25rem;
}

.priority-links a {
  font-size: 0.88rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  text-decoration: none;
  background: var(--surface);
}

.priority-links a:hover {
  border-color: var(--accent);
}

.summary-state {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.4rem 1.5rem 1.2rem;
}

.score-board {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.flaps-score {
  --flap-w: 3.2rem;
  gap: 5px;
}

.flaps-score .flap {
  font-family: var(--display);
  font-size: 2.4rem;
  border-radius: 6px;
}

.flaps-score .flap::after {
  height: 2px;
}

.score-unit {
  font: 600 1rem/1 var(--mono);
  color: var(--quiet);
  padding-bottom: 0.4rem;
}

.verdict-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.verdict {
  margin: 0;
  font: 700 0.85rem/1.4 var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.score {
  font: 600 0.9rem/1 var(--mono);
  color: var(--muted);
}

progress {
  appearance: none;
  width: 100%;
  height: 6px;
  border: 0;
  border-radius: 999px;
  background: var(--surface-active);
  overflow: hidden;
  margin: 0.75rem 0 1rem;
  display: block;
}

progress::-webkit-progress-bar {
  background: var(--surface-active);
}

progress::-webkit-progress-value {
  background: var(--accent);
  border-radius: 999px;
}

progress::-moz-progress-bar {
  background: var(--accent);
  border-radius: 999px;
}

.status-summary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  font-size: 0.9rem;
  color: var(--muted);
}

.status-summary li {
  padding: 0.45rem 0;
  border-top: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
}

.status-summary strong {
  font: 700 1rem/1 var(--mono);
  color: var(--ink);
  margin-right: 0.3rem;
}

/* Departure board of domains */
.board {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.board-top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--line);
  font: 500 0.72rem/1.4 var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--quiet);
}

.board-top b {
  color: var(--accent);
  font-weight: 700;
}

.board-labels,
.board-row {
  display: grid;
  grid-template-columns:
    calc((var(--flap-w) + 3px) * 12) calc((var(--flap-w) + 3px) * 2 + 1rem)
    calc((var(--flap-w) + 3px) * 7) minmax(9rem, 1fr);
  column-gap: 1.5rem;
  align-items: center;
}

.board-labels {
  padding: 0.85rem 1.25rem 0.4rem 1.45rem;
  font: 600 0.66rem/1 var(--mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--quiet);
}

.board-row {
  width: 100%;
  margin: 0;
  padding: 0.55rem 1.25rem 0.55rem 1.3rem;
  background: none;
  border: 0;
  border-left: 3px solid transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms var(--ease);
}

.board-row:hover {
  background: color-mix(in srgb, var(--ink) 3%, transparent);
}

.board-row[aria-pressed="true"] {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}

.board-row:last-child {
  padding-bottom: 0.9rem;
}

.board-cell {
  display: flex;
  min-width: 0;
}

.board-text {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.board-score {
  display: grid;
  grid-template-columns: auto minmax(3rem, 1fr);
  gap: 0.15rem 0.75rem;
  align-items: center;
}

.board-score-value {
  font: 700 0.95rem/1 var(--mono);
  font-variant-numeric: tabular-nums;
}

.board-meter {
  margin: 0;
  height: 5px;
}

.board-note {
  grid-column: 1 / -1;
  font: 0.74rem/1.3 var(--mono);
  color: var(--quiet);
}

.flaps-accent .flap {
  color: #ffb43d;
}

/* Comparison with baseline */
.comparison-panel {
  display: grid;
  gap: 1.25rem;
}

.comparison-heading {
  margin-bottom: 0;
}

.comparison-baseline {
  color: var(--ink);
}

.comparison-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2.5rem;
  margin: 0;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.comparison-metrics dt {
  font: 600 0.68rem/1.4 var(--mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--quiet);
}

.comparison-metrics dd {
  margin: 0.2rem 0 0;
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.comparison-metrics dd strong {
  font: 700 1.5rem/1 var(--mono);
}

.comparison-delta {
  font: 0.8rem/1 var(--mono);
  color: var(--quiet);
}

.comparison-summary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  gap: 0.6rem;
}

.comparison-count {
  display: grid;
  gap: 0.2rem;
  padding: 0.8rem 1rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  border-left: 3px solid var(--line-strong);
}

.comparison-count strong {
  font: 700 1.5rem/1 var(--mono);
}

.comparison-count span {
  font-size: 0.82rem;
  color: var(--muted);
}

.comparison-count-regression {
  border-left-color: var(--fail);
}

.comparison-count-improvement {
  border-left-color: var(--pass);
}

.comparison-count-evidence {
  border-left-color: var(--unknown);
}

.comparison-count-added,
.comparison-count-removed {
  border-left-color: var(--accent);
}

.comparison-clear {
  margin: 0;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
}

.comparison-clear-mark {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  border: 1px solid var(--pass);
  color: var(--pass);
  font-size: 0.85rem;
  flex: none;
}

.comparison-groups {
  display: grid;
  gap: 1rem;
}

.comparison-group {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
}

.comparison-group-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.6rem;
}

.comparison-group-heading > span {
  font: 700 0.85rem/1 var(--mono);
  color: var(--quiet);
}

.comparison-group-heading h3 {
  margin: 0;
  font: 700 0.8rem/1.4 var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.comparison-group-regression .comparison-group-heading h3 {
  color: var(--fail);
}

.comparison-group-improvement .comparison-group-heading h3 {
  color: var(--pass);
}

.comparison-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.comparison-group li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.6rem 0;
  border-top: 1px solid var(--line);
}

.comparison-rule {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.comparison-rule-meta,
.comparison-context {
  font: 0.75rem/1.4 var(--mono);
  color: var(--quiet);
}

.comparison-transition {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  font: 0.8rem/1 var(--mono);
}

.comparison-status {
  font: 700 0.74rem/1 var(--mono);
  padding: 0.3rem 0.5rem;
  border-radius: 3px;
  background: var(--tile);
  border: 1px solid var(--tile-edge);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.comparison-status.status-pass {
  color: #6fdc8c;
}

.comparison-status.status-warn {
  color: #ffc84a;
}

.comparison-status.status-fail {
  color: #ff6b62;
}

.comparison-status.status-unknown {
  color: #e58ef0;
}

.comparison-status.status-skip {
  color: #a7afba;
}

/* Filters */
.filter-bar {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr)) auto;
  gap: 0.75rem;
  align-items: end;
  padding: 1rem 1.1rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.field {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.field label {
  font: 600 0.68rem/1.4 var(--mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--quiet);
}

.field input,
.field select {
  width: 100%;
  font: 0.92rem/1.3 var(--sans);
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 0.6rem 0.7rem;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.result-count {
  margin: 1rem 0 0.6rem;
  font: 0.82rem/1.4 var(--mono);
  color: var(--quiet);
}

/* Findings */
.findings {
  display: grid;
  gap: 0.5rem;
}

.finding {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  transition: border-color 160ms var(--ease);
}

.finding:hover {
  border-color: var(--line-strong);
}

.finding summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 0.8rem 1rem;
  cursor: pointer;
  list-style: none;
}

.finding summary::-webkit-details-marker {
  display: none;
}

.finding summary::after {
  content: "+";
  font: 600 1.15rem/1 var(--mono);
  color: var(--accent);
}

.finding details[open] summary::after {
  content: "\\2212";
}

.finding details[open] {
  border-bottom: 0;
}

.status-mark {
  display: inline-grid;
  place-items: center;
  width: 1.75rem;
  height: 2.2rem;
  border-radius: 4px;
  background: var(--tile);
  border: 1px solid var(--tile-edge);
  font: 700 0.9rem/1 var(--mono);
  position: relative;
  isolation: isolate;
}

.status-mark::after {
  content: "";
  position: absolute;
  z-index: -1;
  left: 1px;
  right: 1px;
  top: 50%;
  height: 1px;
  background: var(--seam);
}

.status-mark.status-pass {
  color: #6fdc8c;
}

.status-mark.status-warn {
  color: #ffc84a;
}

.status-mark.status-fail {
  color: #ff6b62;
}

.status-mark.status-unknown {
  color: #e58ef0;
}

.status-mark.status-skip {
  color: #a7afba;
}

.finding-heading {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.finding-heading strong {
  font-weight: 600;
}

.finding-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  font: 0.76rem/1.4 var(--mono);
  color: var(--quiet);
}

.finding-meta .severity {
  color: var(--muted);
}

.finding[data-severity="high"] .finding-meta .severity {
  color: var(--fail);
}

.finding-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem 2rem;
  padding: 0.25rem 1rem 1.1rem 3.75rem;
  border-top: 1px solid var(--line);
}

.finding-body h3 {
  margin: 1rem 0 0.35rem;
  font: 700 0.7rem/1.4 var(--mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}

.finding-body p {
  margin: 0 0 0.5rem;
  color: var(--muted);
}

.evidence-list {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--muted);
  display: grid;
  gap: 0.3rem;
}

.empty-state {
  margin: 0;
  padding: 1.25rem;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
}

.report-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
  font: 0.78rem/1.5 var(--mono);
  color: var(--quiet);
}

/* Responsive */
@media (max-width: 960px) {
  .summary,
  .section-heading {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-search {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  :root {
    --flap-w: 0.95rem;
  }

  .board-labels,
  .board-row {
    grid-template-columns: calc((var(--flap-w) + 3px) * 12) calc((var(--flap-w) + 3px) * 7) minmax(0, 1fr);
    column-gap: 0.9rem;
  }

  .board-checks,
  .board-labels span:nth-child(2) {
    display: none;
  }

  .board-score {
    grid-template-columns: minmax(0, 1fr);
  }

  .board-meter {
    display: none;
  }

  .finding-body {
    grid-template-columns: minmax(0, 1fr);
    padding-left: 1rem;
  }
}

@media (max-width: 520px) {
  .shell {
    width: min(100% - 2rem, var(--max-width));
    padding-block: 1.5rem 2rem;
    gap: 2.5rem;
  }

  .board-labels,
  .board-row {
    grid-template-columns: calc((var(--flap-w) + 3px) * 12) minmax(0, 1fr);
  }

  .board-status,
  .board-labels span:nth-child(3) {
    display: none;
  }

  .filter-bar {
    grid-template-columns: minmax(0, 1fr);
  }

  .product-sub {
    display: none;
  }

  .flaps-score {
    --flap-w: 2.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

@media print {
  :root {
    color-scheme: light;
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-raised: #f4f1ea;
    --ink: #1c1f24;
    --muted: #3f4752;
    --quiet: #565f6b;
    --line: #d6cfc2;
    --line-strong: #a89f8f;
    --accent: #8a5100;
  }

  .topbar {
    position: static;
  }

  .theme-toggle,
  .filter-bar,
  .skip-link {
    display: none;
  }

  .shell {
    width: 100%;
    padding: 1rem 0;
  }

  .finding[hidden] {
    display: block;
  }

  .finding details[open] summary::after,
  .finding summary::after {
    content: "";
  }
}
`;
export default REPORT_STYLES;
//# sourceMappingURL=styles.js.map