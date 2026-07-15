import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";
import type { CheckResult, ManiflightReport } from "../src/model.js";
import { runManiflight } from "../src/run.js";

const HEALTHY = resolve(import.meta.dirname, "fixtures", "healthy");
const HOSTILE = resolve(import.meta.dirname, "fixtures", "hostile");
const temporaryDirectories: string[] = [];

async function temporaryDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `maniflight-cli-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

function silenceCli(): {
  stdout: ReturnType<typeof vi.spyOn>;
  stderr: ReturnType<typeof vi.spyOn>;
} {
  return {
    stdout: vi.spyOn(process.stdout, "write").mockImplementation(() => true),
    stderr: vi.spyOn(process.stderr, "write").mockImplementation(() => true),
  };
}

function allChecks(report: ManiflightReport): CheckResult[] {
  return Object.values(report.domains).flatMap((domain) => domain.checks);
}

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("baseline-aware CLI", () => {
  it("writes comparison artifacts for an explicit baseline", async () => {
    const root = await temporaryDirectory("comparison");
    const baselinePath = join(root, "baseline.json");
    const output = join(root, "output");
    const baseline = (
      await runManiflight({
        root: HEALTHY,
        generatedAt: "2026-07-14T00:00:00.000Z",
      })
    ).report;
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    const outputCapture = silenceCli();

    await runCli([
      "node",
      "maniflight",
      "scan",
      HEALTHY,
      "--offline",
      "--baseline-report",
      baselinePath,
      "--output",
      output,
    ]);

    const comparison = JSON.parse(await readFile(join(output, "comparison.json"), "utf8")) as {
      summary: { regressions: number };
    };
    expect(comparison.summary.regressions).toBe(0);
    await expect(readFile(join(output, "report.html"), "utf8")).resolves.toContain(
      "Changes from baseline",
    );
    expect(outputCapture.stdout).toHaveBeenCalledWith(expect.stringContaining("0 regressions"));
    expect(process.exitCode).toBeUndefined();
  });

  it("requires a baseline when regression gating is enabled", async () => {
    silenceCli();

    await expect(
      runCli(["node", "maniflight", "scan", HEALTHY, "--fail-on-regression"]),
    ).rejects.toThrow("--fail-on-regression requires --baseline-report");
  });

  it("fails only when the current scan introduces a regression", async () => {
    const root = await temporaryDirectory("regression");
    const baselinePath = join(root, "baseline.json");
    const baseline = structuredClone(
      (
        await runManiflight({
          root: HOSTILE,
          generatedAt: "2026-07-14T00:00:00.000Z",
        })
      ).report,
    );
    const baselineFinding = allChecks(baseline).find(
      (check) => check.status === "warn" || check.status === "fail",
    );
    if (!baselineFinding) throw new Error("Hostile fixture must include a warning or failure");
    baselineFinding.status = "pass";
    await writeFile(baselinePath, JSON.stringify(baseline), "utf8");
    const outputCapture = silenceCli();

    await runCli([
      "node",
      "maniflight",
      "scan",
      HOSTILE,
      "--offline",
      "--baseline-report",
      baselinePath,
      "--fail-on-regression",
      "--output",
      join(root, "output"),
    ]);

    expect(process.exitCode).toBe(1);
    expect(outputCapture.stderr).toHaveBeenCalledWith(
      expect.stringContaining("readiness regression was introduced"),
    );
  });
});
