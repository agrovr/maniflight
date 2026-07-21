import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";
import type { CheckResult, ManiflightReport } from "../src/model.js";
import type { PullRequestFlightReport } from "../src/pr/model.js";
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

function blockedPullRequestReport(): PullRequestFlightReport {
  return {
    kind: "pull-request-flight",
    schemaVersion: "1.0",
    tool: { name: "Maniflight", version: "1.0.0" },
    observedAt: "2026-07-21T05:00:00.000Z",
    pullRequest: {
      repository: "rtk-ai/rtk",
      number: 3114,
      url: "https://github.com/rtk-ai/rtk/pull/3114",
      title: "A blocked pull request",
      state: "open",
      merged: false,
      draft: false,
      author: "agrovr",
      base: {
        ref: "develop",
        sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        repository: "rtk-ai/rtk",
      },
      head: {
        ref: "feature",
        sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        repository: "agrovr/rtk",
      },
      mergeable: true,
      mergeState: "blocked",
      reviewDecision: "review_required",
    },
    outcome: {
      status: "blocked",
      nextActors: ["reviewer"],
      summary: "One or more observed conditions currently block the pull request.",
    },
    counts: { blocked: 1, actionRequired: 0, waiting: 0, unknown: 0 },
    signals: [
      {
        id: "review/decision",
        status: "blocked",
        actor: "reviewer",
        confidence: "observed",
        blocking: true,
        summary: "An approving review is required",
        evidence: [],
      },
    ],
    nextActions: [
      {
        actor: "reviewer",
        summary: "Review and approve the pull request if it meets the project requirements.",
      },
    ],
    collection: {
      sources: [{ id: "pull_request", status: "available" }],
      warnings: [],
    },
  };
}

async function withGitHubTokens(
  ghToken: string | undefined,
  githubToken: string | undefined,
  action: () => Promise<void>,
): Promise<void> {
  const previousGhToken = process.env.GH_TOKEN;
  const previousGithubToken = process.env.GITHUB_TOKEN;
  try {
    if (ghToken === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = ghToken;
    if (githubToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = githubToken;
    await action();
  } finally {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = previousGhToken;
    if (previousGithubToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousGithubToken;
  }
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

describe("pull request CLI", () => {
  it("emits only the JSON document and treats a blocked PR as a successful diagnostic", async () => {
    const report = blockedPullRequestReport();
    const capture = silenceCli();
    const inspectPullRequest = vi.fn(async () => report);

    await withGitHubTokens(undefined, undefined, async () => {
      await runCli(["node", "maniflight", "pr", "rtk-ai/rtk#3114", "--json"], {
        inspectPullRequest,
        now: () => new Date("2026-07-21T05:00:00.000Z"),
      });
    });

    expect(capture.stdout).toHaveBeenCalledTimes(1);
    expect(capture.stdout).toHaveBeenCalledWith(`${JSON.stringify(report, null, 2)}\n`);
    expect(capture.stderr).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expect(inspectPullRequest).toHaveBeenCalledWith("rtk-ai/rtk#3114", {
      observedAt: "2026-07-21T05:00:00.000Z",
    });
  });

  it("prefers GH_TOKEN over GITHUB_TOKEN without writing either token", async () => {
    const report = blockedPullRequestReport();
    const capture = silenceCli();
    const inspectPullRequest = vi.fn(async () => report);

    await withGitHubTokens("preferred-secret", "fallback-secret", async () => {
      await runCli(["node", "maniflight", "pr", "rtk-ai/rtk#3114"], {
        inspectPullRequest,
        now: () => new Date("2026-07-21T05:00:00.000Z"),
      });
    });

    expect(inspectPullRequest).toHaveBeenCalledWith("rtk-ai/rtk#3114", {
      token: "preferred-secret",
      observedAt: "2026-07-21T05:00:00.000Z",
    });
    const output = capture.stdout.mock.calls.flat().join("");
    expect(output).not.toContain("preferred-secret");
    expect(output).not.toContain("fallback-secret");
  });

  it("does not accept a token argument", async () => {
    const capture = silenceCli();
    const inspectPullRequest = vi.fn(async () => blockedPullRequestReport());
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    await expect(
      runCli(["node", "maniflight", "pr", "rtk-ai/rtk#3114", "--token", "argument-secret"], {
        inspectPullRequest,
      }),
    ).rejects.toThrow("process.exit:1");

    expect(inspectPullRequest).not.toHaveBeenCalled();
    expect(capture.stderr.mock.calls.flat().join("")).not.toContain("argument-secret");
  });
});
