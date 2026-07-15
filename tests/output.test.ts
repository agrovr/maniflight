import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BASELINE_REPORT_MAX_BYTES,
  loadBaselineReport,
  writeComparisonArtifact,
  writeReportArtifacts,
} from "../src/output.js";
import { compareReports } from "../src/report/compare.js";
import { runManiflight } from "../src/run.js";

const HEALTHY = resolve(import.meta.dirname, "fixtures", "healthy");
const temporaryDirectories: string[] = [];

async function temporaryDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `maniflight-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function sampleReport() {
  return (await runManiflight({ root: HEALTHY })).report;
}

async function writeSampleReport(path: string): Promise<Awaited<ReturnType<typeof sampleReport>>> {
  const report = await sampleReport();
  await writeFile(path, JSON.stringify(report), "utf8");
  return report;
}

describe("baseline report input boundaries", () => {
  it("loads a schema-valid Maniflight report from a regular file", async () => {
    const root = await temporaryDirectory("baseline-valid");
    const path = join(root, "report.json");
    const expected = await writeSampleReport(path);

    await expect(loadBaselineReport(path, root)).resolves.toEqual(expected);
  });

  it("rejects a baseline report outside the allowed root", async () => {
    const root = await temporaryDirectory("baseline-root");
    const outside = await temporaryDirectory("baseline-outside");
    const path = join(outside, "report.json");
    await writeSampleReport(path);

    await expect(loadBaselineReport(path, root)).rejects.toThrow("must remain inside");
  });

  it("rejects baseline report symlinks", async () => {
    const root = await temporaryDirectory("baseline-link");
    const target = join(root, "target.json");
    const link = join(root, "report.json");
    await writeSampleReport(target);
    await symlink(target, link, "file");

    await expect(loadBaselineReport(link, root)).rejects.toThrow("cannot be a symbolic link");
  });

  it("rejects symbolic-link ancestors inside the allowed root", async () => {
    const root = await temporaryDirectory("baseline-ancestor-root");
    const outside = await temporaryDirectory("baseline-ancestor-outside");
    const path = join(outside, "report.json");
    const link = join(root, "redirect");
    await writeSampleReport(path);
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");

    await expect(loadBaselineReport(join(link, "report.json"), root)).rejects.toThrow(
      "symbolic-link ancestors",
    );
  });

  it("rejects non-files and reports larger than the bounded input limit", async () => {
    const root = await temporaryDirectory("baseline-bounds");
    const oversized = join(root, "oversized.json");
    await writeFile(oversized, Buffer.alloc(BASELINE_REPORT_MAX_BYTES + 1, 0x20));

    await expect(loadBaselineReport(root)).rejects.toThrow("regular file");
    await expect(loadBaselineReport(oversized)).rejects.toThrow(
      `${BASELINE_REPORT_MAX_BYTES}-byte size limit`,
    );
  });

  it("reports malformed JSON and unsupported schema versions clearly", async () => {
    const root = await temporaryDirectory("baseline-format");
    const malformed = join(root, "malformed.json");
    const unsupported = join(root, "unsupported.json");
    await writeFile(malformed, "{not-json", "utf8");
    await writeFile(unsupported, JSON.stringify({ schemaVersion: "2.0" }), "utf8");

    await expect(loadBaselineReport(malformed)).rejects.toThrow("not valid JSON");
    await expect(loadBaselineReport(unsupported)).rejects.toThrow(
      "Unsupported baseline report schemaVersion",
    );
  });

  it("does not echo malformed baseline content into error messages", async () => {
    const root = await temporaryDirectory("baseline-error-redaction");
    const malformed = join(root, "malformed.json");
    const unknownProperty = join(root, "unknown-property.json");
    await writeFile(malformed, '{"TOKEN123":oops}', "utf8");
    const report = await sampleReport();
    await writeFile(
      unknownProperty,
      JSON.stringify({ ...report, "SECRET-AS-A-KEY": true }),
      "utf8",
    );

    const parseError = await loadBaselineReport(malformed).catch((error: unknown) => error);
    const schemaError = await loadBaselineReport(unknownProperty).catch((error: unknown) => error);
    expect(parseError).toBeInstanceOf(Error);
    expect(schemaError).toBeInstanceOf(Error);
    expect((parseError as Error).message).not.toContain("TOKEN123");
    expect((schemaError as Error).message).not.toContain("SECRET-AS-A-KEY");
  });

  it("strictly validates nested report fields and rejects unknown properties", async () => {
    const root = await temporaryDirectory("baseline-schema");
    const wrongType = join(root, "wrong-type.json");
    const unknownProperty = join(root, "unknown-property.json");
    const report = await sampleReport();
    await writeFile(
      wrongType,
      JSON.stringify({ ...report, repository: { ...report.repository, name: 42 } }),
      "utf8",
    );
    await writeFile(unknownProperty, JSON.stringify({ ...report, unexpected: true }), "utf8");

    await expect(loadBaselineReport(wrongType)).rejects.toThrow("repository.name");
    await expect(loadBaselineReport(unknownProperty)).rejects.toThrow("Unrecognized key");
  });

  it("rejects out-of-range percentages and non-positive rule weights", async () => {
    const root = await temporaryDirectory("baseline-numeric-bounds");
    const invalidConfidence = join(root, "invalid-confidence.json");
    const invalidWeight = join(root, "invalid-weight.json");
    const report = await sampleReport();
    await writeFile(
      invalidConfidence,
      JSON.stringify({ ...report, overall: { ...report.overall, confidence: 101 } }),
      "utf8",
    );
    const reportWithInvalidWeight = structuredClone(report);
    const firstCheck = reportWithInvalidWeight.domains.architecture.checks[0];
    if (!firstCheck) throw new Error("Fixture must contain an architecture check");
    firstCheck.weight = 0;
    await writeFile(invalidWeight, JSON.stringify(reportWithInvalidWeight), "utf8");

    await expect(loadBaselineReport(invalidConfidence)).rejects.toThrow("overall.confidence");
    await expect(loadBaselineReport(invalidWeight)).rejects.toThrow(
      "domains.architecture.checks.0.weight",
    );
  });
});

describe("report artifact boundaries", () => {
  it("writes all artifacts inside an allowed root", async () => {
    const root = await temporaryDirectory("output");
    const artifacts = await writeReportArtifacts(await sampleReport(), join(root, "reports"), root);

    await expect(readFile(artifacts.html, "utf8")).resolves.toContain("<!doctype html>");
    await expect(readFile(artifacts.json, "utf8")).resolves.toContain('"schemaVersion"');
    await expect(readFile(artifacts.svg, "utf8")).resolves.toMatch(/^<svg /);
  });

  it("rejects a pre-existing artifact symlink without modifying its target", async () => {
    const root = await temporaryDirectory("leaf-link");
    const output = join(root, "reports");
    const artifacts = await writeReportArtifacts(await sampleReport(), output, root);
    const outside = join(root, "outside.txt");
    await writeFile(outside, "unchanged", "utf8");
    await rm(artifacts.html);
    await symlink(outside, artifacts.html, "file");

    await expect(writeReportArtifacts(await sampleReport(), output, root)).rejects.toThrow(
      "cannot be a symbolic link",
    );
    await expect(readFile(outside, "utf8")).resolves.toBe("unchanged");
  });

  it("rejects a symbolic-link ancestor inside an allowed root", async () => {
    const root = await temporaryDirectory("ancestor-link");
    const outside = await temporaryDirectory("outside");
    const link = join(root, "redirect");
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");

    await expect(
      writeReportArtifacts(await sampleReport(), join(link, "reports"), root),
    ).rejects.toThrow("symbolic-link ancestors");
  });

  it("writes a versioned comparison alongside the standard artifacts", async () => {
    const root = await temporaryDirectory("comparison");
    const baseline = await sampleReport();
    const current = structuredClone(baseline);
    const architectureCheck = current.domains.architecture.checks[0];
    if (!architectureCheck) throw new Error("Fixture must include an architecture check");
    current.domains.architecture.checks[0] = {
      ...architectureCheck,
      status: "fail",
    };
    const comparison = compareReports(current, baseline);

    const artifacts = await writeReportArtifacts(current, join(root, "reports"), root, comparison);

    expect(artifacts.comparison).toBe(join(artifacts.directory, "comparison.json"));
    const comparisonPath = artifacts.comparison;
    if (!comparisonPath) throw new Error("Comparison artifact path was not returned");
    const written = JSON.parse(await readFile(comparisonPath, "utf8")) as {
      schemaVersion: string;
      summary: { regressions: number };
    };
    expect(written.schemaVersion).toBe("1.0");
    expect(written.summary.regressions).toBe(1);
  });

  it("rejects a pre-existing comparison symlink without modifying its target", async () => {
    const root = await temporaryDirectory("comparison-link");
    const output = join(root, "reports");
    const report = await sampleReport();
    const comparison = compareReports(report, report);
    const comparisonPath = await writeComparisonArtifact(comparison, output, root);
    const outside = join(root, "outside-comparison.txt");
    await writeFile(outside, "unchanged", "utf8");
    await rm(comparisonPath);
    await symlink(outside, comparisonPath, "file");

    await expect(writeComparisonArtifact(comparison, output, root)).rejects.toThrow(
      "cannot be a symbolic link",
    );
    await expect(readFile(outside, "utf8")).resolves.toBe("unchanged");
  });
});
