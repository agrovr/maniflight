/**
 * Generates the README artwork in Maniflight's departure-board style:
 *
 *   demo/readme/banner.svg     split-flap board of pull requests
 *   demo/readme/flow.svg       seven GitHub sources -> classifier -> three outputs
 *   demo/readme/badge-*.svg    static badges (version is read from src/version.ts)
 *
 * Every glyph sits in its own positioned tile or anchor, so the art stays aligned
 * whichever fonts GitHub's viewer has. Output is deterministic for CI's artifact check.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION } from "../src/version.js";
import { boardRow, scenarios } from "./showcase-scenarios.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "demo", "readme");

const C = {
  night: "#0b0e13",
  board: "#11161d",
  tile: "#1a212b",
  tileEdge: "#232c38",
  seam: "#07090c",
  amber: "#ffb43d",
  amberDim: "#8a6a35",
  text: "#e8e2d6",
  muted: "#7d8794",
  line: "#2a3340",
  red: "#ff6b62",
  yellow: "#ffc84a",
  cyan: "#5fd1e4",
  magenta: "#e58ef0",
  green: "#6fdc8c",
};

const MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, DejaVu Sans Mono, monospace";
const SANS = "Inter, Segoe UI, Helvetica Neue, Arial, sans-serif";

const esc = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** A row of split-flap tiles, one glyph per tile. */
function tiles(
  text: string,
  x: number,
  y: number,
  opts: {
    w: number;
    h: number;
    gap: number;
    size: number;
    color: string;
    weight?: number;
    font?: string;
  },
): string {
  const parts: string[] = [];
  [...text].forEach((ch, i) => {
    const tx = x + i * (opts.w + opts.gap);
    parts.push(
      `<rect x="${tx}" y="${y}" width="${opts.w}" height="${opts.h}" rx="${Math.max(2, opts.w * 0.08).toFixed(1)}" fill="${C.tile}" stroke="${C.tileEdge}"/>`,
    );
    // The hinge between the two flaps sits behind the glyph, so it never cuts through a letter.
    parts.push(
      `<line x1="${tx + 1}" x2="${tx + opts.w - 1}" y1="${y + opts.h / 2}" y2="${y + opts.h / 2}" stroke="${C.seam}" stroke-width="${opts.h > 50 ? 2 : 1}" stroke-opacity="${opts.h > 50 ? 1 : 0.55}"/>`,
    );
    if (ch !== " ") {
      parts.push(
        `<text x="${tx + opts.w / 2}" y="${y + opts.h / 2}" text-anchor="middle" dominant-baseline="central" font-family="${opts.font ?? MONO}" font-size="${opts.size}" font-weight="${opts.weight ?? 600}" fill="${opts.color}">${esc(ch)}</text>`,
      );
    }
  });
  return parts.join("");
}

const STATUS_COLOR: Record<string, string> = {
  BLOCKED: C.red,
  ACTION: C.yellow,
  MERGED: C.green,
  CLOSED: C.muted,
  WAITING: C.cyan,
  UNKNOWN: C.magenta,
  READY: C.green,
};

function banner(): string {
  const W = 1280;
  const H = 512;
  const left = 56;
  const word = "MANIFLIGHT";
  const wTile = { w: 76, h: 96, gap: 8, size: 66, color: C.amber, weight: 700, font: SANS };

  // Board: PR(5) BRANCH(14) STATUS(7) NEXT(11), two blank tiles between columns.
  const cols = [
    { label: "PULL REQUEST", width: 5 },
    { label: "BRANCH", width: 15 },
    { label: "STATUS", width: 7 },
    { label: "NEXT ACTOR", width: 11 },
  ];
  const rows: [string, string, string, string][] = scenarios.map((scenario) => {
    const row = boardRow(scenario.report);
    return [row.number, row.branch, row.status, row.next];
  });

  const t = { w: 24, h: 30, gap: 3, size: 17 };
  const step = t.w + t.gap;
  const gapTiles = 1;
  const boardTop = 268;
  const rowStep = 36;

  const colX: number[] = [];
  let cursor = left;
  for (const col of cols) {
    colX.push(cursor);
    cursor += (col.width + gapTiles) * step;
  }

  const header = cols
    .map(
      (col, i) =>
        `<text x="${colX[i]}" y="${boardTop - 12}" font-family="${MONO}" font-size="12" letter-spacing="2" fill="${C.muted}">${col.label}</text>`,
    )
    .join("");
  const body = rows
    .map((row, r) =>
      row
        .map((cell, c) => {
          const width = cols[c]?.width ?? 0;
          const color = c === 2 ? (STATUS_COLOR[cell] ?? C.amber) : c === 0 ? C.text : C.amber;
          return tiles(cell.padEnd(width), colX[c] ?? 0, boardTop + r * rowStep, { ...t, color });
        })
        .join(""),
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="bt bd">
  <title id="bt">Maniflight</title>
  <desc id="bd">Maniflight wordmark above a split-flap departure board of pull requests, each with a status such as blocked, action, waiting, unknown or ready, and the next actor who has to move.</desc>
  <defs>
    <radialGradient id="glow" cx="0.18" cy="0.18" r="0.7">
      <stop offset="0" stop-color="${C.amber}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${C.amber}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="18" fill="${C.night}"/>
  <rect width="${W}" height="${H}" rx="18" fill="url(#glow)"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="17.5" fill="none" stroke="${C.line}"/>

  <g font-family="${MONO}" font-size="13" letter-spacing="2.4">
    <circle cx="${left + 5}" cy="47" r="5" fill="${C.amber}"/>
    <text x="${left + 20}" y="52" fill="${C.amber}">PR FLIGHT DIRECTOR</text>
    <text x="${W - left}" y="52" text-anchor="end" fill="${C.muted}">READ-ONLY  ·  EVIDENCE-LINKED  ·  V${esc(VERSION)}</text>
  </g>

  ${tiles(word, left, 76, wTile)}

  <g font-family="${MONO}" font-size="13" letter-spacing="1.6">
    <text x="${W - left - 190}" y="104" fill="${C.muted}">BASE</text>
    <text x="${W - left}" y="104" text-anchor="end" fill="${C.text}">main</text>
    <text x="${W - left - 190}" y="132" fill="${C.muted}">OBSERVED</text>
    <text x="${W - left}" y="132" text-anchor="end" fill="${C.text}">16:00 UTC</text>
    <text x="${W - left - 190}" y="160" fill="${C.muted}">SOURCES</text>
    <text x="${W - left}" y="160" text-anchor="end" fill="${C.green}">7 / 7</text>
  </g>

  <text x="${left}" y="216" font-family="${SANS}" font-size="25" font-weight="500" fill="${C.text}">Why is this pull request blocked, and who has to move next?</text>

  <line x1="${left}" x2="${W - left}" y1="236" y2="236" stroke="${C.line}"/>
  ${header}
  ${body}
</svg>
`;
}

function flow(): string {
  const W = 1280;
  const H = 500;
  const sources = [
    "Pull request",
    "GraphQL review state",
    "Reviews",
    "Check runs",
    "Commit statuses",
    "Actions runs",
    "Active branch rules",
  ];
  const outputs = [
    {
      title: "OBSERVED CONDITIONS",
      sub: "blocked · action · waiting",
      color: C.red,
      dashed: false,
    },
    {
      title: "EVIDENCE GAPS",
      sub: "unknown, never a guessed pass",
      color: C.magenta,
      dashed: true,
    },
    { title: "NEXT STEPS", sub: "one instruction per actor", color: C.green, dashed: false },
  ];
  const srcX = 56;
  const srcW = 268;
  const srcH = 40;
  const srcTop = 92;
  const srcStep = 52;
  const core = { x: 560, y: 196, w: 200, h: 124 };
  const outX = 900;
  const outW = 324;
  const outH = 74;
  const outTop = [118, 222, 326];
  const coreMidY = core.y + core.h / 2;

  const sourceNodes = sources
    .map((label, i) => {
      const y = srcTop + i * srcStep;
      const cy = y + srcH / 2;
      return `<path d="M${srcX + srcW} ${cy} C ${srcX + srcW + 120} ${cy}, ${core.x - 110} ${coreMidY}, ${core.x} ${coreMidY}" fill="none" stroke="${C.amberDim}" stroke-width="1.4"/>
    <rect x="${srcX}" y="${y}" width="${srcW}" height="${srcH}" rx="8" fill="${C.board}" stroke="${C.line}"/>
    <circle cx="${srcX + 20}" cy="${cy}" r="4" fill="${C.amber}"/>
    <text x="${srcX + 36}" y="${cy}" dominant-baseline="central" font-family="${MONO}" font-size="15" fill="${C.text}">${esc(label)}</text>`;
    })
    .join("\n    ");

  const outputNodes = outputs
    .map((o, i) => {
      const y = outTop[i] ?? 0;
      const cy = y + outH / 2;
      return `<path d="M${core.x + core.w} ${coreMidY} C ${core.x + core.w + 70} ${coreMidY}, ${outX - 70} ${cy}, ${outX} ${cy}" fill="none" stroke="${o.color}" stroke-width="2"${o.dashed ? ' stroke-dasharray="7 6"' : ""}/>
    <rect x="${outX}" y="${y}" width="${outW}" height="${outH}" rx="10" fill="${C.board}" stroke="${o.color}" stroke-opacity="0.55"${o.dashed ? ' stroke-dasharray="6 5"' : ""}/>
    <rect x="${outX}" y="${y + 14}" width="4" height="${outH - 28}" rx="2" fill="${o.color}"/>
    <text x="${outX + 22}" y="${y + 31}" font-family="${MONO}" font-size="15" font-weight="700" letter-spacing="1.5" fill="${o.color}">${esc(o.title)}</text>
    <text x="${outX + 22}" y="${y + 54}" font-family="${SANS}" font-size="15" fill="${C.muted}">${esc(o.sub)}</text>`;
    })
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ft fd">
  <title id="ft">How Maniflight reads a pull request</title>
  <desc id="fd">Seven read-only GitHub sources feed a deterministic classifier, which separates observed conditions from evidence gaps and produces next steps for each actor.</desc>
  <rect width="${W}" height="${H}" rx="18" fill="${C.night}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="17.5" fill="none" stroke="${C.line}"/>
  <g font-family="${MONO}" font-size="12" letter-spacing="2.2" fill="${C.muted}">
    <text x="${srcX}" y="62">READ-ONLY EVIDENCE</text>
    <text x="${core.x + core.w / 2}" y="62" text-anchor="middle">CLASSIFY</text>
    <text x="${outX}" y="62">FLIGHT PLAN</text>
  </g>
    ${sourceNodes}
    ${outputNodes}
  <rect x="${core.x}" y="${core.y}" width="${core.w}" height="${core.h}" rx="14" fill="${C.board}" stroke="${C.amber}" stroke-width="1.6"/>
  ${tiles("PR", core.x + 62, core.y + 22, { w: 34, h: 44, gap: 8, size: 26, color: C.amber, weight: 700, font: SANS })}
  <text x="${core.x + core.w / 2}" y="${core.y + 92}" text-anchor="middle" font-family="${MONO}" font-size="13" letter-spacing="1.5" fill="${C.text}">DETERMINISTIC RULES</text>
  <text x="${core.x + core.w / 2}" y="${H - 30}" text-anchor="middle" font-family="${SANS}" font-size="14" fill="${C.muted}">GET requests and GraphQL queries only. No comments, approvals, reruns, labels or merges.</text>
</svg>
`;
}

/** Flat badge with monospace text so widths are predictable without font metrics. */
function badge(label: string, value: string, color: string): string {
  const cw = 7.2;
  const pad = 10;
  const lw = Math.round(label.length * cw + pad * 2);
  const vw = Math.round(value.length * cw + pad * 2);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22" viewBox="0 0 ${w} 22" role="img" aria-label="${esc(`${label}: ${value}`)}">
  <title>${esc(`${label}: ${value}`)}</title>
  <rect width="${w}" height="22" rx="4" fill="${C.board}"/>
  <rect x="${lw}" width="${vw}" height="22" rx="4" fill="${color}"/>
  <rect x="${lw}" width="6" height="22" fill="${color}"/>
  <g font-family="${MONO}" font-size="12" font-weight="600">
    <text x="${lw / 2}" y="15" text-anchor="middle" fill="${C.text}">${esc(label)}</text>
    <text x="${lw + vw / 2}" y="15" text-anchor="middle" fill="${C.night}">${esc(value)}</text>
  </g>
</svg>
`;
}

await mkdir(out, { recursive: true });
await writeFile(resolve(out, "banner.svg"), banner());
await writeFile(resolve(out, "flow.svg"), flow());
await writeFile(resolve(out, "badge-release.svg"), badge("release", `v${VERSION}`, C.amber));
await writeFile(resolve(out, "badge-node.svg"), badge("node", "22.12+ | 24", C.green));
await writeFile(resolve(out, "badge-license.svg"), badge("license", "MIT", C.cyan));
await writeFile(resolve(out, "badge-readonly.svg"), badge("github", "read-only", C.magenta));
process.stdout.write("Generated demo/readme artwork\n");
