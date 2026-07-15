import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { constants } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { lstat, mkdir, open, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import type { ManiflightReport } from "./model.js";
import { renderReportHtml } from "./render/html.js";
import { renderReportSvg } from "./render/svg.js";
import type { ComparisonReport } from "./report/compare.js";

export const BASELINE_REPORT_MAX_BYTES = 2 * 1024 * 1024;

export interface ReportArtifactPaths {
  directory: string;
  html: string;
  json: string;
  svg: string;
  comparison?: string;
}

const finiteNumberSchema = z.number().finite();
const nonNegativeFiniteNumberSchema = finiteNumberSchema.nonnegative();
const positiveFiniteNumberSchema = finiteNumberSchema.positive();
const percentageSchema = finiteNumberSchema.min(0).max(100);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const domainSchema = z.enum(["architecture", "automation", "security", "community"]);
const statusSchema = z.enum(["pass", "warn", "fail", "unknown", "not_applicable"]);
const severitySchema = z.enum(["info", "low", "medium", "high"]);

const evidenceSchema = z
  .object({
    kind: z.enum(["present", "missing", "risk", "unknown"]),
    message: z.string(),
    path: z.string().optional(),
    line: z.number().int().positive().optional(),
    url: z.string().optional(),
  })
  .strict();

const waiverSchema = z
  .object({
    reason: z.string(),
    path: z.string().optional(),
  })
  .strict();

const checkResultSchema = z
  .object({
    ruleId: z.string(),
    domain: domainSchema,
    title: z.string(),
    description: z.string(),
    status: statusSchema,
    severity: severitySchema,
    weight: positiveFiniteNumberSchema,
    evidence: z.array(evidenceSchema),
    remediation: z.string().optional(),
    documentationUrl: z.string().optional(),
    waiver: waiverSchema.optional(),
  })
  .strict();

function domainResultSchema(domain: "architecture" | "automation" | "security" | "community") {
  return z
    .object({
      domain: z.literal(domain),
      score: percentageSchema.nullable(),
      confidence: percentageSchema,
      earnedWeight: nonNegativeFiniteNumberSchema,
      evaluatedWeight: nonNegativeFiniteNumberSchema,
      possibleWeight: nonNegativeFiniteNumberSchema,
      checks: z.array(checkResultSchema),
    })
    .strict();
}

const baselineReportSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    tool: z
      .object({
        name: z.literal("Maniflight"),
        version: z.string().min(1),
      })
      .strict(),
    repository: z
      .object({
        name: z.string(),
        owner: z.string().optional(),
        url: z.string().optional(),
        description: z.string().optional(),
        defaultBranch: z.string().optional(),
        visibility: z.string().optional(),
        topics: z.array(z.string()),
        languages: z.record(z.string(), nonNegativeFiniteNumberSchema),
      })
      .strict(),
    generatedAt: z.string().optional(),
    domains: z
      .object({
        architecture: domainResultSchema("architecture"),
        automation: domainResultSchema("automation"),
        security: domainResultSchema("security"),
        community: domainResultSchema("community"),
      })
      .strict(),
    overall: z
      .object({
        score: percentageSchema.nullable(),
        confidence: percentageSchema,
        label: z.enum(["ready", "stable", "developing", "insufficient-data"]),
      })
      .strict(),
    summary: z
      .object({
        pass: nonNegativeIntegerSchema,
        warn: nonNegativeIntegerSchema,
        fail: nonNegativeIntegerSchema,
        unknown: nonNegativeIntegerSchema,
        notApplicable: nonNegativeIntegerSchema,
        highFindings: nonNegativeIntegerSchema,
      })
      .strict(),
  })
  .strict();

function isWithin(base: string, candidate: string): boolean {
  const fromBase = relative(base, candidate);
  return fromBase === "" || (!fromBase.startsWith("..") && !isAbsolute(fromBase));
}

function sameFile(
  left: { dev: number | bigint; ino: number | bigint },
  right: { dev: number | bigint; ino: number | bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

async function assertBaselinePath(path: string, allowedRoot?: string): Promise<void> {
  if (!allowedRoot) return;

  const root = resolve(allowedRoot);
  if (!isWithin(root, path)) {
    throw new Error(`Baseline report must remain inside ${root}`);
  }

  let rootMetadata: Stats;
  try {
    rootMetadata = await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Baseline report root does not exist: ${root}`, { cause: error });
    }
    throw error;
  }
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error("Baseline report root must be a real directory");
  }

  let cursor = root;
  const parentSegments = relative(root, dirname(path))
    .split(/[\\/]+/)
    .filter(Boolean);
  for (const segment of parentSegments) {
    cursor = resolve(cursor, segment);
    let metadata: Stats;
    try {
      metadata = await lstat(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Baseline report directory does not exist: ${cursor}`, { cause: error });
      }
      throw error;
    }
    if (metadata.isSymbolicLink()) {
      throw new Error(`Baseline report path cannot contain symbolic-link ancestors: ${cursor}`);
    }
    if (!metadata.isDirectory()) {
      throw new Error(`Baseline report ancestor must be a directory: ${cursor}`);
    }
  }

  const canonicalRoot = await realpath(root);
  const canonicalParent = await realpath(dirname(path));
  if (!isWithin(canonicalRoot, canonicalParent)) {
    throw new Error("Baseline report resolves outside the allowed root");
  }
}

async function readBoundedBaseline(path: string, allowedRoot?: string): Promise<string> {
  let beforeOpen: Stats;
  try {
    beforeOpen = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Baseline report does not exist: ${path}`, { cause: error });
    }
    throw error;
  }
  if (beforeOpen.isSymbolicLink()) {
    throw new Error(`Baseline report cannot be a symbolic link: ${path}`);
  }
  if (!beforeOpen.isFile()) {
    throw new Error(`Baseline report must be a regular file: ${path}`);
  }
  if (beforeOpen.size > BASELINE_REPORT_MAX_BYTES) {
    throw new Error(
      `Baseline report exceeds the ${BASELINE_REPORT_MAX_BYTES}-byte size limit: ${path}`,
    );
  }

  const noFollow = constants.O_NOFOLLOW ?? 0;
  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error(`Baseline report cannot be a symbolic link: ${path}`, { cause: error });
    }
    throw error;
  }

  try {
    const opened = await handle.stat();
    if (!opened.isFile()) {
      throw new Error(`Baseline report must be a regular file: ${path}`);
    }
    if (!sameFile(beforeOpen, opened)) {
      throw new Error(`Baseline report changed while it was being opened: ${path}`);
    }
    if (opened.size > BASELINE_REPORT_MAX_BYTES) {
      throw new Error(
        `Baseline report exceeds the ${BASELINE_REPORT_MAX_BYTES}-byte size limit: ${path}`,
      );
    }

    // Re-check the path after opening so an ancestor swapped during the initial checks cannot
    // redirect the descriptor outside the caller's allowed root.
    await assertBaselinePath(path, allowedRoot);
    const afterOpen = await lstat(path);
    if (afterOpen.isSymbolicLink()) {
      throw new Error(`Baseline report cannot be a symbolic link: ${path}`);
    }
    if (!sameFile(opened, afterOpen)) {
      throw new Error(`Baseline report changed while it was being opened: ${path}`);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= BASELINE_REPORT_MAX_BYTES) {
      const remaining = BASELINE_REPORT_MAX_BYTES + 1 - total;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
    }
    if (total > BASELINE_REPORT_MAX_BYTES) {
      throw new Error(
        `Baseline report exceeds the ${BASELINE_REPORT_MAX_BYTES}-byte size limit: ${path}`,
      );
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
    } catch (error) {
      throw new Error(`Baseline report is not valid UTF-8: ${path}`, { cause: error });
    }
  } finally {
    await handle.close();
  }
}

function safeIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "report";
  return path
    .map((segment) => {
      const value = String(segment);
      return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : "<field>";
    })
    .join(".");
}

function safeIssueMessage(code: string): string {
  switch (code) {
    case "unrecognized_keys":
      return "Unrecognized key";
    case "invalid_type":
      return "Invalid type";
    case "too_big":
      return "Value exceeds the allowed maximum";
    case "too_small":
      return "Value is below the allowed minimum";
    default:
      return "Invalid value";
  }
}

function parseBaselineReport(contents: string, path: string): ManiflightReport {
  let value: unknown;
  try {
    value = JSON.parse(contents) as unknown;
  } catch {
    throw new Error(`Baseline report is not valid JSON: ${JSON.stringify(path)}`);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion !== "1.0"
  ) {
    throw new Error(
      `Unsupported baseline report schemaVersion in ${JSON.stringify(path)}; expected "1.0"`,
    );
  }

  const parsed = baselineReportSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${safeIssuePath(issue.path)}: ${safeIssueMessage(issue.code)}`)
      .join("; ");
    throw new Error(
      `Baseline report does not match schema 1.0: ${JSON.stringify(path)}: ${details}`,
    );
  }

  // JSON cannot encode `undefined`, so validated optional fields are absent rather than present
  // with an undefined value. This satisfies the model's exact optional-property contract.
  return parsed.data as ManiflightReport;
}

export async function loadBaselineReport(
  reportPath: string,
  allowedRoot?: string,
): Promise<ManiflightReport> {
  const path = resolve(reportPath);
  await assertBaselinePath(path, allowedRoot);
  return parseBaselineReport(await readBoundedBaseline(path, allowedRoot), path);
}

async function prepareOutputDirectory(
  outputDirectory: string,
  allowedRoot?: string,
): Promise<string> {
  const directory = resolve(outputDirectory);
  const root = allowedRoot ? resolve(allowedRoot) : undefined;

  if (root && !isWithin(root, directory)) {
    throw new Error(`Output directory must remain inside ${root}`);
  }

  if (root) {
    const rootMetadata = await lstat(root);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
      throw new Error("Allowed output root must be a real directory");
    }

    let cursor = root;
    const segments = relative(root, directory)
      .split(/[\\/]+/)
      .filter(Boolean);
    for (const segment of segments) {
      cursor = resolve(cursor, segment);
      try {
        const metadata = await lstat(cursor);
        if (metadata.isSymbolicLink()) {
          throw new Error("Output directory cannot contain symbolic-link ancestors");
        }
        if (!metadata.isDirectory()) {
          throw new Error("Output path must be a directory");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await mkdir(cursor);
      }
    }
  } else {
    try {
      const metadata = await lstat(directory);
      if (metadata.isSymbolicLink()) {
        throw new Error("Output directory cannot be a symbolic link");
      }
      if (!metadata.isDirectory()) {
        throw new Error("Output path must be a directory");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(directory, { recursive: true });
    }
  }

  const canonicalDirectory = await realpath(directory);
  if (root) {
    const canonicalRoot = await realpath(root);
    if (!isWithin(canonicalRoot, canonicalDirectory)) {
      throw new Error("Output directory resolves outside the allowed root");
    }
  }

  return canonicalDirectory;
}

async function writeArtifact(path: string, contents: string): Promise<void> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Report artifact cannot be a symbolic link: ${path}`);
    }
    if (!metadata.isFile()) {
      throw new Error(`Report artifact path must be a regular file: ${path}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const temporary = resolve(
    dirname(path),
    `.maniflight-${randomUUID()}-${path.endsWith(".json") ? "report.json" : "artifact.tmp"}`,
  );
  try {
    await writeFile(temporary, contents, { encoding: "utf8", flag: "wx", mode: 0o644 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function writeComparisonArtifactInDirectory(
  comparison: ComparisonReport,
  directory: string,
): Promise<string> {
  const path = resolve(directory, "comparison.json");
  await writeArtifact(path, `${JSON.stringify(comparison, null, 2)}\n`);
  return path;
}

export async function writeComparisonArtifact(
  comparison: ComparisonReport,
  outputDirectory: string,
  allowedRoot?: string,
): Promise<string> {
  const directory = await prepareOutputDirectory(outputDirectory, allowedRoot);
  return writeComparisonArtifactInDirectory(comparison, directory);
}

export async function writeReportArtifacts(
  report: ManiflightReport,
  outputDirectory: string,
  allowedRoot?: string,
  comparison?: ComparisonReport,
): Promise<ReportArtifactPaths> {
  const directory = await prepareOutputDirectory(outputDirectory, allowedRoot);
  const html = resolve(directory, "report.html");
  const json = resolve(directory, "report.json");
  const svg = resolve(directory, "orbit.svg");

  const writes: Promise<unknown>[] = [
    writeArtifact(html, `${renderReportHtml(report, comparison)}\n`),
    writeArtifact(json, `${JSON.stringify(report, null, 2)}\n`),
    writeArtifact(svg, `${renderReportSvg(report)}\n`),
  ];
  if (comparison) writes.push(writeComparisonArtifactInDirectory(comparison, directory));
  await Promise.all(writes);

  return {
    directory,
    html,
    json,
    svg,
    ...(comparison ? { comparison: resolve(directory, "comparison.json") } : {}),
  };
}
