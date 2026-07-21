import { describe, expect, it } from "vitest";
import { classifyPullRequestFlight } from "../src/pr/classify.js";
import type {
  BranchPolicyFact,
  CheckRunFact,
  CollectionSource,
  CommitStatusFact,
  PullRequestFlightFacts,
  PullRequestSubject,
  ReviewFact,
  ReviewThreadFact,
  WorkflowRunFact,
} from "../src/pr/model.js";

const OBSERVED_AT = "2026-07-21T05:00:00.000Z";

const AVAILABLE_SOURCES: CollectionSource[] = [
  { id: "pull_request", status: "available" },
  { id: "graphql", status: "available" },
  { id: "reviews", status: "available" },
  { id: "check_runs", status: "available" },
  { id: "commit_statuses", status: "available" },
  { id: "workflow_runs", status: "available" },
  { id: "branch_rules", status: "available" },
];

const BASE_POLICY: BranchPolicyFact = {
  requiredApprovals: 0,
  requireCodeOwnerReview: false,
  requireLastPushApproval: false,
  requireThreadResolution: false,
  requireUpToDate: false,
  requiredStatusChecks: [],
};

const BASE_SUBJECT: PullRequestSubject = {
  repository: "example/project",
  number: 42,
  url: "https://github.com/example/project/pull/42",
  title: "Improve the contributor workflow",
  state: "open",
  merged: false,
  draft: false,
  author: "contributor",
  base: {
    ref: "main",
    sha: "1111111111111111111111111111111111111111",
    repository: "example/project",
  },
  head: {
    ref: "feature",
    sha: "2222222222222222222222222222222222222222",
    repository: "example/project",
  },
  mergeable: true,
  mergeState: "clean",
  reviewDecision: "approved",
};

interface FactOverrides {
  subject?: Partial<PullRequestSubject>;
  reviews?: ReviewFact[];
  checkRuns?: CheckRunFact[];
  commitStatuses?: CommitStatusFact[];
  workflowRuns?: WorkflowRunFact[];
  branchPolicy?: BranchPolicyFact | null;
  reviewThreads?: ReviewThreadFact | null;
  collection?: CollectionSource[];
  warnings?: string[];
}

function facts(overrides: FactOverrides = {}): PullRequestFlightFacts {
  return {
    subject: { ...BASE_SUBJECT, ...overrides.subject },
    reviews: overrides.reviews ?? [],
    checkRuns: overrides.checkRuns ?? [],
    commitStatuses: overrides.commitStatuses ?? [],
    workflowRuns: overrides.workflowRuns ?? [],
    branchPolicy:
      overrides.branchPolicy === undefined ? { ...BASE_POLICY } : overrides.branchPolicy,
    reviewThreads:
      overrides.reviewThreads === undefined ? { total: 0, unresolved: 0 } : overrides.reviewThreads,
    collection: overrides.collection ?? AVAILABLE_SOURCES,
    warnings: overrides.warnings ?? [],
  };
}

describe("pull request flight classification", () => {
  it("reports ready when complete evidence proves no review or merge blocker", () => {
    const report = classifyPullRequestFlight(
      facts({ subject: { reviewDecision: null } }),
      OBSERVED_AT,
    );

    expect(report.outcome).toEqual({
      status: "ready",
      nextActors: [],
      summary: "No observed blocker remains in the collected evidence.",
    });
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "review/decision",
        status: "pass",
        blocking: false,
      }),
    );
  });

  it("explains an unstable merge state without assigning a next actor", () => {
    const report = classifyPullRequestFlight(
      facts({ subject: { mergeable: true, mergeState: "unstable" } }),
      OBSERVED_AT,
    );

    expect(report.outcome).toMatchObject({ status: "ready_with_warnings", nextActors: [] });
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "pr/mergeability",
        status: "info",
        blocking: false,
        summary: "GitHub reports an unstable merge state",
      }),
    );
  });

  it("keeps a visible REST changes-requested review non-blocking without an authoritative decision", () => {
    const report = classifyPullRequestFlight(
      facts({
        subject: { reviewDecision: null },
        reviews: [
          {
            id: 20,
            user: "reviewer",
            state: "changes_requested",
            submittedAt: OBSERVED_AT,
            url: BASE_SUBJECT.url,
          },
        ],
      }),
      OBSERVED_AT,
    );

    expect(report.outcome).toMatchObject({ status: "ready_with_warnings", nextActors: [] });
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "review/visible-changes-requested",
        status: "info",
        actor: "contributor",
        blocking: false,
      }),
    );
    expect(report.signals).not.toContainEqual(
      expect.objectContaining({ id: "review/decision", status: "blocked" }),
    );
  });

  it("does not infer a missing approval from partial review evidence", () => {
    const report = classifyPullRequestFlight(
      facts({
        subject: { reviewDecision: null },
        branchPolicy: { ...BASE_POLICY, requiredApprovals: 1 },
        collection: AVAILABLE_SOURCES.map((source) =>
          source.id === "reviews" ? { ...source, status: "partial" as const } : source,
        ),
      }),
      OBSERVED_AT,
    );

    expect(report.outcome.status).toBe("unknown");
    expect(report.signals).toContainEqual(
      expect.objectContaining({ id: "review/decision", status: "unknown", blocking: false }),
    );
    expect(report.signals).not.toContainEqual(
      expect.objectContaining({ id: "review/decision", status: "blocked" }),
    );
  });

  it("classifies an action-required check run without guessing the actor", () => {
    const report = classifyPullRequestFlight(
      facts({
        branchPolicy: { ...BASE_POLICY, requiredStatusChecks: ["ci"] },
        checkRuns: [
          {
            id: 13,
            name: "ci",
            status: "completed",
            conclusion: "action_required",
            app: "github-actions",
            url: "https://github.com/example/project/actions/runs/13",
          },
        ],
      }),
      OBSERVED_AT,
    );

    expect(report.outcome.status).toBe("blocked");
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "check/13",
        status: "action_required",
        actor: "unknown",
        blocking: true,
      }),
    );
  });

  it("blocks an unresolved review thread only when active policy requires resolution", () => {
    const report = classifyPullRequestFlight(
      facts({
        branchPolicy: { ...BASE_POLICY, requireThreadResolution: true },
        reviewThreads: { total: 1, unresolved: 1 },
      }),
      OBSERVED_AT,
    );

    expect(report.outcome.status).toBe("blocked");
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "review/threads",
        status: "blocked",
        actor: "contributor",
        blocking: true,
      }),
    );
  });

  it("does not let a same-name check from the wrong app satisfy a required context", () => {
    const report = classifyPullRequestFlight(
      facts({
        branchPolicy: {
          ...BASE_POLICY,
          requiredStatusChecks: ["ci"],
          requiredStatusCheckApps: [{ context: "ci", integrationId: 7 }],
        },
        checkRuns: [
          {
            id: 14,
            name: "ci",
            status: "completed",
            conclusion: "success",
            app: "another-app",
            appId: 9,
            url: "https://github.com/example/project/actions/runs/14",
          },
        ],
      }),
      OBSERVED_AT,
    );

    expect(report.outcome.status).toBe("waiting");
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "required-status/ci/7",
        status: "waiting",
        actor: "automation",
        blocking: true,
      }),
    );
    expect(report.signals).not.toContainEqual(
      expect.objectContaining({ id: "pr/unexplained-blocker" }),
    );
  });

  it("does not infer a missing required check from partial check evidence", () => {
    const report = classifyPullRequestFlight(
      facts({
        branchPolicy: { ...BASE_POLICY, requiredStatusChecks: ["ci"] },
        collection: AVAILABLE_SOURCES.map((source) =>
          source.id === "check_runs" ? { ...source, status: "partial" as const } : source,
        ),
      }),
      OBSERVED_AT,
    );

    expect(report.outcome.status).toBe("unknown");
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "required-status/ci/any",
        status: "unknown",
        actor: "unknown",
        blocking: false,
      }),
    );
  });

  it("does not duplicate ordinary workflow failures already represented by checks", () => {
    const report = classifyPullRequestFlight(
      facts({
        workflowRuns: [
          {
            id: 99,
            name: "CI",
            event: "pull_request",
            status: "completed",
            conclusion: "failure",
            jobs: 3,
            url: "https://github.com/example/project/actions/runs/99",
          },
        ],
      }),
      OBSERVED_AT,
    );

    expect(report.signals).not.toContainEqual(expect.objectContaining({ id: "workflow/99" }));
    expect(report.outcome.status).toBe("ready");
  });

  it("does not report a pass when review-thread pagination is partial", () => {
    const report = classifyPullRequestFlight(
      facts({
        reviewThreads: { total: 101, unresolved: 0 },
        collection: AVAILABLE_SOURCES.map((source) =>
          source.id === "graphql" ? { ...source, status: "partial" as const } : source,
        ),
      }),
      OBSERVED_AT,
    );

    expect(report.outcome.status).toBe("unknown");
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "review/threads",
        status: "unknown",
        actor: "unknown",
      }),
    );
  });

  it("finds the reviewer and hidden maintainer actions in frozen RTK-like evidence", () => {
    const report = classifyPullRequestFlight(
      facts({
        subject: {
          repository: "rtk-ai/rtk",
          number: 3114,
          url: "https://github.com/rtk-ai/rtk/pull/3114",
          title: "refactor(ci): extract ShellCheck SARIF conversion",
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
        branchPolicy: { ...BASE_POLICY, requiredApprovals: 1 },
        checkRuns: [
          {
            id: 1,
            name: "check-target",
            status: "completed",
            conclusion: "skipped",
            app: "github-actions",
            url: "https://github.com/rtk-ai/rtk/actions/runs/visible",
          },
        ],
        commitStatuses: [
          {
            id: 2,
            context: "license/cla",
            state: "success",
            creator: "cla-bot",
            url: "https://github.com/rtk-ai/rtk/pull/3114/checks",
          },
        ],
        workflowRuns: [
          {
            id: 29_800_767_510,
            name: "CI",
            event: "pull_request",
            status: "completed",
            conclusion: "action_required",
            jobs: 0,
            url: "https://github.com/rtk-ai/rtk/actions/runs/29800767510",
          },
        ],
      }),
      OBSERVED_AT,
    );

    expect(report.observedAt).toBe(OBSERVED_AT);
    expect(report.outcome).toMatchObject({
      status: "blocked",
      nextActors: ["reviewer", "maintainer"],
    });
    expect(report.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "review/decision",
          status: "blocked",
          actor: "reviewer",
          blocking: true,
        }),
        expect.objectContaining({
          id: "workflow/29800767510",
          status: "action_required",
          actor: "maintainer",
          confidence: "inferred",
        }),
        expect.objectContaining({ id: "check/1", status: "pass" }),
        expect.objectContaining({ id: "status/2", status: "pass" }),
      ]),
    );
  });

  it.each([
    {
      label: "draft",
      subject: { draft: true },
      signal: { id: "pr/draft", status: "action_required", actor: "contributor" },
    },
    {
      label: "merge conflict",
      subject: { mergeable: false, mergeState: "dirty" },
      signal: { id: "pr/mergeability", status: "blocked", actor: "contributor" },
    },
    {
      label: "requested review changes",
      subject: { reviewDecision: "changes_requested" },
      signal: { id: "review/decision", status: "blocked", actor: "contributor" },
    },
  ])("blocks a $label with a contributor action", ({ subject, signal }) => {
    const report = classifyPullRequestFlight(facts({ subject }), OBSERVED_AT);

    expect(report.outcome.status).toBe("blocked");
    expect(report.outcome.nextActors).toContain("contributor");
    expect(report.signals).toContainEqual(expect.objectContaining({ ...signal, blocking: true }));
  });

  it("keeps unknown mergeability unknown instead of declaring the PR ready", () => {
    const report = classifyPullRequestFlight(
      facts({ subject: { mergeable: null, mergeState: "unknown" } }),
      OBSERVED_AT,
    );

    expect(report.outcome).toMatchObject({ status: "unknown", nextActors: ["wait"] });
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "pr/mergeability",
        status: "unknown",
        actor: "wait",
        confidence: "unknown",
      }),
    );
    expect(report.nextActions).toContainEqual({
      actor: "wait",
      summary: "Wait for GitHub to finish computing mergeability, then inspect again.",
      url: BASE_SUBJECT.url,
    });
  });

  it("distinguishes pending automation from a required failing status", () => {
    const report = classifyPullRequestFlight(
      facts({
        branchPolicy: { ...BASE_POLICY, requiredStatusChecks: ["ci", "lint"] },
        checkRuns: [
          {
            id: 10,
            name: "ci",
            status: "in_progress",
            conclusion: null,
            app: "github-actions",
            url: "https://github.com/example/project/actions/runs/10",
          },
        ],
        commitStatuses: [
          {
            id: 11,
            context: "lint",
            state: "failure",
            creator: "lint-bot",
            url: "https://github.com/example/project/pull/42/checks",
          },
        ],
      }),
      OBSERVED_AT,
    );

    expect(report.outcome.status).toBe("blocked");
    expect(report.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "check/10",
          status: "waiting",
          actor: "automation",
          blocking: true,
        }),
        expect.objectContaining({
          id: "status/11",
          status: "blocked",
          actor: "unknown",
          confidence: "unknown",
          blocking: true,
        }),
      ]),
    );
  });

  it("does not guess who owns a non-required failure", () => {
    const report = classifyPullRequestFlight(
      facts({
        checkRuns: [
          {
            id: 12,
            name: "optional smoke",
            status: "completed",
            conclusion: "failure",
            app: "github-actions",
            url: "https://github.com/example/project/actions/runs/12",
          },
        ],
      }),
      OBSERVED_AT,
    );

    expect(report.outcome).toMatchObject({ status: "action_required", nextActors: ["unknown"] });
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "check/12",
        status: "action_required",
        actor: "unknown",
        confidence: "unknown",
        blocking: false,
      }),
    );
  });

  it.each([
    { merged: true, state: "closed" as const, expected: "merged" },
    { merged: false, state: "closed" as const, expected: "closed" },
  ])("reports a terminal $expected pull request", ({ merged, state, expected }) => {
    const report = classifyPullRequestFlight(facts({ subject: { merged, state } }), OBSERVED_AT);

    expect(report.outcome.status).toBe(expected);
    expect(report.outcome.nextActors).toEqual([]);
    expect(report.signals).toHaveLength(1);
  });

  it("surfaces unavailable evidence as unknown", () => {
    const report = classifyPullRequestFlight(
      facts({
        collection: AVAILABLE_SOURCES.map((source) =>
          source.id === "workflow_runs"
            ? {
                id: "workflow_runs" as const,
                status: "unavailable" as const,
                detail: "GitHub workflow runs were unavailable (HTTP 403)",
              }
            : source,
        ),
        warnings: ["GitHub workflow runs were unavailable (HTTP 403)"],
      }),
      OBSERVED_AT,
    );

    expect(report.outcome).toMatchObject({ status: "unknown", nextActors: ["unknown"] });
    expect(report.signals).toContainEqual(
      expect.objectContaining({
        id: "collection/workflow_runs",
        status: "unknown",
        actor: "unknown",
      }),
    );
  });
});
