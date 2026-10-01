/**
 * Fictional pull requests shared by the README artwork and the GitHub Pages site.
 * Each one is a raw GitHub fact set that runs through the real classifier, so every
 * status, actor, and next step shown in the showcase is what `maniflight pr` would print.
 */
import { classifyPullRequestFlight } from "../src/pr/classify.js";
import type {
  BranchPolicyFact,
  CheckRunFact,
  CollectionSource,
  PullRequestFlightFacts,
  PullRequestFlightReport,
  PullRequestSubject,
} from "../src/pr/model.js";

export const OBSERVED_AT = "2026-09-30T16:00:00.000Z";
const REPO = "acme/payments-api";
const ALL_SOURCES: CollectionSource[] = [
  { id: "pull_request", status: "available" },
  { id: "graphql", status: "available" },
  { id: "reviews", status: "available" },
  { id: "check_runs", status: "available" },
  { id: "commit_statuses", status: "available" },
  { id: "workflow_runs", status: "available" },
  { id: "branch_rules", status: "available" },
];

const POLICY: BranchPolicyFact = {
  requiredApprovals: 1,
  requireCodeOwnerReview: false,
  requireLastPushApproval: false,
  requireThreadResolution: true,
  requireUpToDate: false,
  requiredStatusChecks: ["build"],
};

function subject(
  number: number,
  branch: string,
  title: string,
  overrides: Partial<PullRequestSubject> = {},
): PullRequestSubject {
  return {
    repository: REPO,
    number,
    url: `https://github.com/${REPO}/pull/${number}`,
    title,
    state: "open",
    merged: false,
    draft: false,
    author: "dana-k",
    base: { ref: "main", sha: "a".repeat(40), repository: REPO },
    head: { ref: branch, sha: "7c41e09b2d5f8a3e6c1b9d04f2a7e8c3b5d1f6a2", repository: REPO },
    mergeable: true,
    mergeState: "blocked",
    reviewDecision: "review_required",
    ...overrides,
  };
}

function facts(
  subjectFact: PullRequestSubject,
  overrides: Partial<PullRequestFlightFacts> = {},
): PullRequestFlightFacts {
  return {
    subject: subjectFact,
    reviews: [],
    checkRuns: [],
    commitStatuses: [],
    workflowRuns: [],
    branchPolicy: POLICY,
    reviewThreads: { total: 0, unresolved: 0 },
    collection: ALL_SOURCES,
    warnings: [],
    ...overrides,
  };
}

const build = (id: number, conclusion: string | null, status = "completed"): CheckRunFact => ({
  id,
  name: "build",
  status,
  conclusion,
  app: "github-actions",
  url: `https://github.com/${REPO}/actions/runs/${id}`,
});

const approval = (id: number) => ({
  id,
  user: "lee-m",
  state: "APPROVED",
  submittedAt: "2026-09-30T14:12:00Z",
  url: `https://github.com/${REPO}/pull/1#pullrequestreview-${id}`,
});

export interface Scenario {
  id: string;
  tab: string;
  caption: string;
  report: PullRequestFlightReport;
}

export const scenarios: Scenario[] = [
  {
    id: "fork",
    tab: "Fork PR",
    caption:
      "A first-time contributor's fork: CI is parked until a maintainer approves it, and a review is still required.",
    report: classifyPullRequestFlight(
      facts(
        subject(231, "docs-refunds", "Document the refund webhook payload", {
          author: "new-contributor",
          head: {
            ref: "docs-refunds",
            sha: "e19a7c3f40b2d6e8a5c1f9b7d3e0a2c4b6d8f1e3",
            repository: "new-contributor/payments-api",
          },
        }),
        {
          workflowRuns: [
            {
              id: 9177,
              name: "CI",
              event: "pull_request",
              status: "completed",
              conclusion: "action_required",
              jobs: 0,
              url: `https://github.com/${REPO}/actions/runs/9177`,
            },
          ],
        },
      ),
      OBSERVED_AT,
    ),
  },
  {
    id: "failing",
    tab: "Failing check",
    caption: "Approved, but the required build failed and a review conversation is still open.",
    report: classifyPullRequestFlight(
      facts(
        subject(218, "webhook-retries", "Retry idempotent webhook deliveries", {
          reviewDecision: "approved",
        }),
        {
          reviews: [approval(51)],
          checkRuns: [build(9101, "failure")],
          reviewThreads: { total: 3, unresolved: 1 },
        },
      ),
      OBSERVED_AT,
    ),
  },
  {
    id: "parked",
    tab: "Parked CI",
    caption:
      "Approved, with nothing blocking the merge, but CI has never run on this fork. A maintainer has to approve the workflow.",
    report: classifyPullRequestFlight(
      facts(
        subject(204, "rate-limits", "Add per-merchant rate limits", {
          reviewDecision: "approved",
          mergeState: "clean",
          author: "sam-ortiz",
          head: {
            ref: "rate-limits",
            sha: "4b8e2a6c1d9f3e7a5c0b8d2f6e4a1c9b7d3f5e08",
            repository: "sam-ortiz/payments-api",
          },
        }),
        {
          branchPolicy: { ...POLICY, requiredStatusChecks: [] },
          reviews: [approval(52)],
          workflowRuns: [
            {
              id: 9140,
              name: "CI",
              event: "pull_request",
              status: "completed",
              conclusion: "action_required",
              jobs: 0,
              url: `https://github.com/${REPO}/actions/runs/9140`,
            },
          ],
        },
      ),
      OBSERVED_AT,
    ),
  },
  {
    id: "waiting",
    tab: "Waiting",
    caption:
      "Approved and conversation-free. The required build is still running, so the next move belongs to CI.",
    report: classifyPullRequestFlight(
      facts(
        subject(212, "ledger-export", "Stream ledger exports in pages", {
          reviewDecision: "approved",
        }),
        {
          reviews: [approval(53)],
          checkRuns: [build(9188, null, "in_progress")],
        },
      ),
      OBSERVED_AT,
    ),
  },
  {
    id: "unknown",
    tab: "Evidence gap",
    caption:
      "Run without a token: GitHub hides review data and still reports the PR as blocked. Maniflight says what it cannot see instead of guessing.",
    report: classifyPullRequestFlight(
      facts(
        subject(197, "anon-inspect", "Tighten refund amount validation", { reviewDecision: null }),
        {
          branchPolicy: { ...POLICY, requiredApprovals: null, requireThreadResolution: null },
          checkRuns: [build(9122, "success")],
          reviewThreads: null,
          collection: ALL_SOURCES.map((source) =>
            source.id === "graphql"
              ? {
                  ...source,
                  status: "unavailable",
                  detail: "GitHub GraphQL requires authentication.",
                }
              : source,
          ),
        },
      ),
      OBSERVED_AT,
    ),
  },
  {
    id: "ready",
    tab: "Ready",
    caption: "Everything required has reported success. Nothing left to chase.",
    report: classifyPullRequestFlight(
      facts(
        subject(189, "payout-csv", "Export payouts as CSV", {
          reviewDecision: "approved",
          mergeState: "clean",
        }),
        {
          reviews: [approval(54)],
          checkRuns: [build(9099, "success")],
        },
      ),
      OBSERVED_AT,
    ),
  },
];

const BOARD_STATUS: Record<PullRequestFlightReport["outcome"]["status"], string> = {
  ready: "READY",
  ready_with_warnings: "READY",
  blocked: "BLOCKED",
  action_required: "ACTION",
  waiting: "WAITING",
  unknown: "UNKNOWN",
  merged: "MERGED",
  closed: "CLOSED",
};

/** One departure-board row derived from a classified report. */
export function boardRow(report: PullRequestFlightReport): {
  number: string;
  branch: string;
  status: string;
  next: string;
} {
  const first = report.outcome.nextActors[0];
  return {
    number: `#${report.pullRequest.number}`,
    branch: report.pullRequest.head.ref.toUpperCase(),
    status: BOARD_STATUS[report.outcome.status],
    next: first === undefined ? "NONE" : first === "unknown" ? "UNASSIGNED" : first.toUpperCase(),
  };
}
