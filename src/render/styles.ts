export const REPORT_STYLES = `
:root {
  color-scheme: dark light;
  --bg: #090611;
  --surface: #110b1c;
  --surface-raised: #181024;
  --surface-active: #231533;
  --ink: #f8f3ff;
  --muted: #c9bdd6;
  --quiet: #9f91ad;
  --line: #332442;
  --line-strong: #765990;
  --purple: #7650a8;
  --lavender: #c2a5e8;
  --orange: #f2a45b;
  --pass: #79d8ae;
  --warn: #f2a45b;
  --fail: #ff8b9d;
  --skip: #aaa0b4;
  --focus: #f2a45b;
  --max-width: 74rem;
  --radius: 14px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #f7f4fb;
    --surface: #ffffff;
    --surface-raised: #f0eaf7;
    --surface-active: #e7daf4;
    --ink: #17101f;
    --muted: #554a61;
    --quiet: #6b6074;
    --line: #d8cae4;
    --line-strong: #9e82b7;
    --purple: #613891;
    --lavender: #70449c;
    --orange: #8c480c;
    --pass: #176b4a;
    --warn: #80420b;
    --fail: #9e2940;
    --skip: #625a69;
    --focus: #8c480c;
  }
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f7f4fb;
  --surface: #ffffff;
  --surface-raised: #f0eaf7;
  --surface-active: #e7daf4;
  --ink: #17101f;
  --muted: #554a61;
  --quiet: #6b6074;
  --line: #d8cae4;
  --line-strong: #9e82b7;
  --purple: #613891;
  --lavender: #70449c;
  --orange: #8c480c;
  --pass: #176b4a;
  --warn: #80420b;
  --fail: #9e2940;
  --skip: #625a69;
  --focus: #8c480c;
}

:root[data-theme="dark"] {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  min-width: 20rem;
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-size: 1rem;
  line-height: 1.55;
  text-rendering: optimizeLegibility;
}

button,
input,
select {
  font: inherit;
}

button,
select {
  cursor: pointer;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
summary:focus-visible,
a:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

a {
  color: var(--lavender);
  text-underline-offset: 0.18em;
}

a:hover {
  color: var(--orange);
}

.skip-link {
  position: fixed;
  inset: 0 auto auto 0;
  z-index: 20;
  padding: 0.75rem 1rem;
  background: var(--ink);
  color: var(--bg);
  transform: translateY(-120%);
}

.skip-link:focus {
  transform: translateY(0);
}

.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3.75rem;
  padding: 0.75rem max(1rem, calc((100vw - var(--max-width)) / 2));
  border-bottom: 1px solid var(--line);
}

.product-label {
  margin: 0;
  color: var(--lavender);
  font-size: 0.78rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.theme-toggle {
  min-width: 4.5rem;
  min-height: 2.75rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  font-size: 0.88rem;
  font-weight: 650;
  white-space: nowrap;
  transition:
    background-color 180ms var(--ease),
    border-color 180ms var(--ease);
}

.theme-toggle:hover {
  border-color: var(--orange);
  background: var(--surface-raised);
}

.shell {
  display: flex;
  flex-direction: column;
  width: min(calc(100% - 2rem), var(--max-width));
  margin-inline: auto;
  padding-block: 2.25rem 4.5rem;
}

.summary {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.6fr);
  gap: 2.5rem;
  align-items: end;
  padding-bottom: 2.4rem;
}

.summary-copy {
  min-width: 0;
}

.summary h1 {
  max-width: 18ch;
  margin: 0.45rem 0 0.7rem;
  font-size: 2.55rem;
  line-height: 1.04;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.summary-text {
  max-width: 68ch;
  margin: 0;
  color: var(--muted);
  text-wrap: pretty;
}

.priority-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  align-items: baseline;
  margin-top: 0.9rem;
  font-size: 0.875rem;
}

.priority-links > span {
  color: var(--ink);
  font-weight: 750;
}

.priority-links a {
  color: var(--muted);
}

.priority-links a:hover {
  color: var(--orange);
}

.repository-path {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: var(--orange);
  font-size: 0.875rem;
  font-weight: 750;
  letter-spacing: 0.03em;
  overflow-wrap: anywhere;
}

.repository-path::before {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: currentColor;
  content: "";
}

.summary-state {
  display: grid;
  gap: 0.85rem;
  padding: 1.15rem 0 0.2rem 1.35rem;
  border-left: 1px solid var(--line-strong);
}

.verdict-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.verdict {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 750;
}

.score {
  color: var(--orange);
  font-variant-numeric: tabular-nums;
  font-weight: 760;
}

.summary-state progress,
.domain-control progress {
  width: 100%;
  height: 0.38rem;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: var(--surface-raised);
  accent-color: var(--purple);
}

progress::-webkit-progress-bar {
  background: var(--surface-raised);
}

progress::-webkit-progress-value {
  background: var(--purple);
}

progress::-moz-progress-bar {
  background: var(--purple);
}

.status-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: 0.875rem;
}

.status-summary strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.section-heading p {
  max-width: 60ch;
  margin: 0;
  color: var(--muted);
  font-size: 0.93rem;
  text-wrap: pretty;
}

.constellation-panel {
  padding-block: 2rem 2.5rem;
  border-block: 1px solid var(--line);
}

.constellation {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-areas:
    ". architecture ."
    "security core automation"
    ". community .";
  grid-template-columns: minmax(11rem, 1fr) minmax(12rem, 1.15fr) minmax(11rem, 1fr);
  gap: 1rem 1.5rem;
  align-items: center;
  min-height: 25rem;
  padding: 1.25rem;
}

.orbit-art {
  position: absolute;
  inset: 2.5% 4%;
  z-index: -1;
  width: 92%;
  height: 95%;
  color: var(--line-strong);
  pointer-events: none;
}

.orbit-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
  transition:
    stroke 180ms var(--ease),
    opacity 180ms var(--ease);
}

.orbit-line[data-active="true"] {
  stroke: var(--orange);
  stroke-width: 2;
  stroke-dasharray: 8 10;
  animation: orbit-signal 2.4s linear infinite;
}

@keyframes orbit-signal {
  to {
    stroke-dashoffset: -36;
  }
}

.domain-control {
  min-width: 0;
}

.domain-control[data-domain="architecture"] {
  grid-area: architecture;
}

.domain-control[data-domain="automation"] {
  grid-area: automation;
}

.domain-control[data-domain="security"] {
  grid-area: security;
}

.domain-control[data-domain="community"] {
  grid-area: community;
}

.domain-button {
  display: grid;
  width: 100%;
  min-height: 5.5rem;
  gap: 0.65rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  transition:
    transform 180ms var(--ease),
    background-color 180ms var(--ease),
    border-color 180ms var(--ease);
}

.domain-button:hover {
  transform: translateY(-2px);
  border-color: var(--lavender);
  background: var(--surface-raised);
}

.domain-button[aria-pressed="true"] {
  border-color: var(--orange);
  background: var(--surface-active);
}

.domain-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.domain-title {
  font-weight: 750;
}

.domain-count {
  color: var(--muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.domain-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
  line-height: 1.35;
}

.repo-core {
  grid-area: core;
  justify-self: center;
  display: grid;
  place-items: center;
  width: min(100%, 11.5rem);
  aspect-ratio: 1;
  padding: 1.25rem;
  border: 1px solid var(--purple);
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink);
  text-align: center;
  transition:
    transform 180ms var(--ease),
    border-color 180ms var(--ease),
    background-color 180ms var(--ease);
}

.repo-core:hover {
  transform: scale(1.025);
  border-color: var(--orange);
  background: var(--surface-raised);
}

.repo-core[aria-pressed="true"] {
  border-color: var(--orange);
}

.repo-star {
  display: block;
  color: var(--orange);
  font-size: 2rem;
  line-height: 1;
}

.repo-name {
  display: block;
  max-width: 11rem;
  font-size: 0.95rem;
  font-weight: 780;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.repo-core-note {
  display: block;
  color: var(--muted);
  font-size: 0.875rem;
}

.findings-section {
  padding-top: 2.5rem;
}

.filter-bar {
  display: grid;
  grid-template-columns: minmax(14rem, 1.5fr) repeat(3, minmax(8rem, 0.6fr)) auto;
  gap: 0.8rem;
  align-items: end;
  margin-bottom: 1rem;
  padding: 1rem;
  border-block: 1px solid var(--line);
  background: var(--bg);
}

.field {
  display: grid;
  gap: 0.35rem;
}

.field label {
  color: var(--muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.field input,
.field select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
}

.field input::placeholder {
  color: var(--quiet);
  opacity: 1;
}

.clear-filters {
  min-height: 2.75rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-weight: 680;
}

.clear-filters:hover {
  border-color: var(--orange);
  background: var(--surface-raised);
}

.result-count {
  min-height: 1.5rem;
  margin: 0 0 0.85rem;
  color: var(--muted);
  font-size: 0.88rem;
}

.findings {
  display: grid;
  gap: 0.7rem;
}

.finding {
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.finding[hidden] {
  display: none;
}

.finding details {
  border-radius: 10px;
}

.finding details[open] {
  background: var(--surface-raised);
}

.finding summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: center;
  min-height: 4.6rem;
  padding: 0.8rem 0.9rem;
  cursor: pointer;
  list-style: none;
}

.finding summary::-webkit-details-marker {
  display: none;
}

.finding summary::after {
  color: var(--muted);
  content: "+";
  font-size: 1.2rem;
  font-weight: 500;
}

.finding details[open] summary::after {
  content: "−";
}

.status-mark {
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 0.78rem;
  font-weight: 800;
}

.status-pass {
  color: var(--pass);
}

.status-warn {
  color: var(--warn);
}

.status-fail {
  color: var(--fail);
}

.status-skip,
.status-unknown {
  color: var(--skip);
}

.finding-heading {
  min-width: 0;
}

.finding-heading strong {
  display: block;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.finding-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin-top: 0.25rem;
  color: var(--muted);
  font-size: 0.875rem;
}

.severity {
  color: var(--ink);
  font-weight: 700;
  text-transform: capitalize;
}

.finding-body {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(14rem, 0.9fr);
  gap: 1.4rem;
  padding: 0.1rem 3.7rem 1.15rem;
}

.finding-body p {
  max-width: 70ch;
  margin: 0;
  color: var(--muted);
  text-wrap: pretty;
}

.finding-body h3 {
  margin: 0 0 0.4rem;
  font-size: 0.9375rem;
}

.evidence-list,
.remediation-list {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--muted);
  font-size: 0.9375rem;
}

.evidence-list code,
.remediation-list code {
  color: var(--ink);
  overflow-wrap: anywhere;
}

.empty-state {
  padding: 2rem 1rem;
  border-block: 1px solid var(--line);
  color: var(--muted);
  text-align: center;
}

.report-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  color: var(--quiet);
  font-size: 0.875rem;
}

@media (max-width: 52rem) {
  .summary {
    grid-template-columns: 1fr;
    gap: 1.35rem;
  }

  .summary-state {
    padding: 1rem 0 0;
    border-top: 1px solid var(--line-strong);
    border-left: 0;
  }

  .constellation {
    grid-template-areas:
      "core core"
      "architecture automation"
      "security community";
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-height: 0;
    padding: 1rem 0;
  }

  .orbit-art {
    display: none;
  }

  .repo-core {
    width: 11rem;
    margin-bottom: 0.4rem;
  }

  .filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-search {
    grid-column: 1 / -1;
  }

  .finding-body {
    grid-template-columns: 1fr;
    padding-inline: 3.7rem 1rem;
  }
}

@media (max-width: 37rem) {
  .topbar {
    align-items: center;
    gap: 0.75rem;
  }

  .product-label {
    max-width: 12rem;
  }

  .shell {
    width: min(calc(100% - 1.25rem), var(--max-width));
    padding-top: 1.5rem;
  }

  .summary h1 {
    font-size: 2rem;
  }

  .section-heading {
    display: block;
  }

  .section-heading p {
    margin-top: 0.45rem;
  }

  .findings-section {
    order: 1;
    padding-top: 2rem;
    border-top: 1px solid var(--line);
  }

  .constellation-panel {
    order: 2;
    margin-top: 3rem;
  }

  .report-footer {
    order: 3;
  }

  .constellation {
    grid-template-areas:
      "core core"
      "architecture automation"
      "security community";
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .domain-button {
    min-height: 5.25rem;
    padding: 0.8rem;
  }

  .domain-title-row {
    display: grid;
    gap: 0.1rem;
  }

  .filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-search {
    grid-column: 1 / -1;
  }

  .finding summary {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.65rem;
  }

  .finding-body {
    padding: 0 1rem 1rem;
  }

  .report-footer {
    display: block;
  }

  .report-footer span {
    display: block;
    margin-top: 0.35rem;
  }
}

@media print {
  :root {
    color-scheme: light;
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-raised: #f5f2f8;
    --ink: #17101f;
    --muted: #4d4555;
    --quiet: #625a69;
    --line: #cfc6d6;
    --line-strong: #8f809d;
    --lavender: #5f337d;
    --orange: #80420b;
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

  .finding details[open] {
    break-inside: avoid;
  }

  .finding details:not([open]) > :not(summary) {
    display: block !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  .domain-button:hover,
  .repo-core:hover {
    transform: none;
  }
}
`;

export default REPORT_STYLES;
