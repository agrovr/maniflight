import { describe, expect, it } from "vitest";
import type { PullRequestFlightReport } from "../src/pr/model.js";
import { renderPullRequestFlight } from "../src/pr/render.js";

function report(): PullRequestFlightReport {
  return {
    kind: "pull-request-flight",
    schemaVersion: "1.0",
    tool: { name: "Maniflight", version: "1.0.0" },
    observedAt: "2026-07-21T05:00:00.000Z",
    pullRequest: {
      repository: "rtk-ai/rtk",
      number: 3114,
      url: "https://github.com/rtk-ai/rtk/pull/3114",
      title: "refactor(ci): extract ShellCheck SARIF conversion",
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
        ref: "codex/extract-shellcheck-sarif-helper",
        sha: "1f8915e111111111111111111111111111111111",
        repository: "agrovr/rtk",
      },
      mergeable: true,
      mergeState: "blocked",
      reviewDecision: "review_required",
    },
    outcome: {
      status: "blocked",
      nextActors: ["reviewer", "maintainer"],
      summary: "One or more observed conditions currently block the pull request.",
    },
    counts: { blocked: 1, actionRequired: 1, waiting: 0, unknown: 0 },
    signals: [
      {
        id: "review/decision",
        status: "blocked",
        actor: "reviewer",
        confidence: "observed",
        blocking: true,
        summary: "1 approving review is required",
        evidence: [{ label: "Pull request", url: "https://github.com/rtk-ai/rtk/pull/3114" }],
      },
      {
        id: "workflow/29800767510",
        status: "action_required",
        actor: "maintainer",
        confidence: "inferred",
        blocking: false,
        summary: "CI requires manual action",
        evidence: [
          {
            label: "Workflow run",
            url: "https://github.com/rtk-ai/rtk/actions/runs/29800767510",
          },
        ],
      },
      {
        id: "status/2",
        status: "pass",
        actor: "external",
        confidence: "inferred",
        blocking: false,
        summary: "license/cla reports success",
        evidence: [{ label: "Commit status", url: "https://cla-assistant.io/example" }],
      },
    ],
    nextActions: [
      {
        actor: "reviewer",
        summary: "Review and approve the pull request if it meets the project requirements.",
        url: "https://github.com/rtk-ai/rtk/pull/3114",
      },
      {
        actor: "maintainer",
        summary: "CI requires manual action",
        url: "https://github.com/rtk-ai/rtk/actions/runs/29800767510",
      },
    ],
    collection: {
      sources: [
        { id: "pull_request", status: "available" },
        { id: "workflow_runs", status: "available" },
      ],
      warnings: [],
    },
  };
}

describe("pull request terminal output", () => {
  it("renders a deterministic, compact flight summary", () => {
    const output = renderPullRequestFlight(report());
    const line = (label: string, value: string): string => `${label.padEnd(13)}${value}`;

    expect(output).toBe(
      `${[
        "Maniflight PR Flight Director",
        "rtk-ai/rtk#3114",
        "refactor(ci): extract ShellCheck SARIF conversion",
        "",
        line("STATUS", "BLOCKED"),
        line("NEXT ACTORS", "reviewer, maintainer"),
        line("HEAD", "1f8915e11111"),
        "",
        line("BLOCKED", "1 approving review is required [merge blocker]"),
        line("SOURCE", "https://github.com/rtk-ai/rtk/pull/3114"),
        line("ACTION", "CI requires manual action"),
        line("SOURCE", "https://github.com/rtk-ai/rtk/actions/runs/29800767510"),
      ].join("\n")}\n`,
    );
  });

  it("explains a ready pull request with an unstable merge state", () => {
    const unstable = report();
    unstable.pullRequest.mergeState = "unstable";
    unstable.outcome = {
      status: "ready_with_warnings",
      nextActors: [],
      summary: "No observed merge blocker remains, but non-blocking attention is useful.",
    };
    unstable.counts = { blocked: 0, actionRequired: 0, waiting: 0, unknown: 0 };
    unstable.signals = [
      {
        id: "pr/mergeability",
        status: "info",
        actor: "automation",
        confidence: "observed",
        blocking: false,
        summary: "GitHub reports an unstable merge state",
        detail: "The pull request is mergeable, but non-required checks may still need attention.",
        evidence: [{ label: "Pull request", url: unstable.pullRequest.url }],
      },
    ];

    const output = renderPullRequestFlight(unstable);

    expect(output).toContain("STATUS       READY WITH WARNINGS");
    expect(output).toContain("INFO         GitHub reports an unstable merge state");
    expect(output).toContain(
      "DETAIL       The pull request is mergeable, but non-required checks may still need attention.",
    );
    expect(output).toContain(`SOURCE       ${unstable.pullRequest.url}`);
  });

  it("neutralizes untrusted terminal controls and forged lines", () => {
    const hostile = report();
    const firstSignal = hostile.signals[0];
    if (!firstSignal) throw new Error("Hostile fixture requires a signal");
    hostile.pullRequest.title = "Safe\u001bforged\nline";
    firstSignal.summary = "Review\r\nSTATUS PASS\u202e";
    firstSignal.detail = "Open\tthis\u0007link";

    const output = renderPullRequestFlight(hostile);

    expect(output).toContain("Safe forged line");
    expect(output).toContain("Review STATUS PASS");
    expect(output).toContain("Open this link");
    expect(output).not.toContain("\r");
    expect(output).not.toContain("\t");
    expect(
      [...output].filter((character) => {
        const codePoint = character.codePointAt(0) ?? -1;
        return (
          codePoint === 0x7f ||
          (codePoint >= 0x00 && codePoint <= 0x08) ||
          (codePoint >= 0x0b && codePoint <= 0x0c) ||
          (codePoint >= 0x0e && codePoint <= 0x1f) ||
          (codePoint >= 0x80 && codePoint <= 0x9f) ||
          (codePoint >= 0x202a && codePoint <= 0x202e) ||
          (codePoint >= 0x2066 && codePoint <= 0x2069)
        );
      }),
    ).toEqual([]);
  });
});
