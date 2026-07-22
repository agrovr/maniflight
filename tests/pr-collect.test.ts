import { describe, expect, it } from "vitest";
import {
  collectPullRequestFlight,
  type PullRequestApi,
  type PullRequestApiResponse,
} from "../src/pr/collect.js";
import type { CollectionSourceId } from "../src/pr/model.js";
import type { PullRequestReference } from "../src/pr/reference.js";

const HEAD_SHA = "1f8915e111111111111111111111111111111111";
const BASE_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RUN_ID = 29_800_767_510;

const ROUTES = {
  pull: "GET /repos/{owner}/{repo}/pulls/{pull_number}",
  reviews: "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
  checks: "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
  statuses: "GET /repos/{owner}/{repo}/commits/{ref}/status",
  workflows: "GET /repos/{owner}/{repo}/actions/runs",
  jobs: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
  rules: "GET /repos/{owner}/{repo}/rules/branches/{branch}",
} as const;

const REFERENCE: PullRequestReference = {
  owner: "rtk-ai",
  repo: "rtk",
  number: 3114,
  repository: "rtk-ai/rtk",
};

interface RestCall {
  route: string;
  parameters: Readonly<Record<string, unknown>>;
}

interface GraphqlCall {
  query: string;
  variables: Readonly<Record<string, unknown>>;
}

type RestFixture =
  | PullRequestApiResponse
  | ((
      parameters: Readonly<Record<string, unknown>>,
    ) => PullRequestApiResponse | Promise<PullRequestApiResponse>);

type GraphqlFixture = (
  query: string,
  variables: Readonly<Record<string, unknown>>,
) => unknown | Promise<unknown>;

function pullRequestData(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    html_url: "https://github.com/rtk-ai/rtk/pull/3114",
    title: "refactor(ci): extract ShellCheck SARIF conversion",
    state: "open",
    merged: false,
    merged_at: null,
    draft: false,
    mergeable: true,
    mergeable_state: "blocked",
    user: { login: "agrovr" },
    base: {
      ref: "develop",
      sha: BASE_SHA,
      repo: { full_name: "rtk-ai/rtk" },
    },
    head: {
      ref: "codex/extract-shellcheck-sarif-helper",
      sha: HEAD_SHA,
      repo: { full_name: "agrovr/rtk" },
    },
    ...overrides,
  };
}

function defaultRestFixtures(): Record<string, RestFixture> {
  return {
    [ROUTES.pull]: { data: pullRequestData() },
    [ROUTES.reviews]: { data: [] },
    [ROUTES.checks]: {
      data: {
        total_count: 1,
        check_runs: [
          {
            id: 1,
            name: "check-target",
            status: "completed",
            conclusion: "skipped",
            app: { slug: "github-actions" },
            html_url: "https://github.com/rtk-ai/rtk/actions/runs/visible",
          },
        ],
      },
    },
    [ROUTES.statuses]: {
      data: {
        total_count: 1,
        statuses: [
          {
            id: 2,
            context: "license/cla",
            state: "success",
            creator: { login: "cla-bot" },
            target_url: "https://github.com/rtk-ai/rtk/pull/3114/checks",
          },
        ],
      },
    },
    [ROUTES.workflows]: {
      data: {
        total_count: 1,
        workflow_runs: [
          {
            id: RUN_ID,
            name: "CI",
            event: "pull_request",
            status: "completed",
            conclusion: "action_required",
            html_url: `https://github.com/rtk-ai/rtk/actions/runs/${RUN_ID}`,
          },
        ],
      },
    },
    [ROUTES.jobs]: { data: { total_count: 0, jobs: [] } },
    [ROUTES.rules]: {
      data: [
        {
          id: 101,
          type: "pull_request",
          parameters: {
            required_approving_review_count: 1,
            require_code_owner_review: false,
            require_last_push_approval: false,
            required_review_thread_resolution: true,
          },
        },
      ],
    },
  };
}

function completeGraphqlResponse(): Record<string, unknown> {
  return {
    repository: {
      pullRequest: {
        mergeStateStatus: "BLOCKED",
        reviewDecision: "REVIEW_REQUIRED",
        reviewThreads: {
          totalCount: 1,
          nodes: [{ isResolved: false }],
          pageInfo: { hasNextPage: false },
        },
      },
    },
  };
}

function createFake(
  options: { rest?: Readonly<Record<string, RestFixture>>; graphql?: GraphqlFixture } = {},
): {
  client: PullRequestApi;
  restCalls: RestCall[];
  graphqlCalls: GraphqlCall[];
} {
  const fixtures = { ...defaultRestFixtures(), ...options.rest };
  const restCalls: RestCall[] = [];
  const graphqlCalls: GraphqlCall[] = [];
  const client: PullRequestApi = {
    request: async (route, parameters) => {
      restCalls.push({ route, parameters: { ...parameters } });
      const fixture = fixtures[route];
      if (!fixture) throw new Error(`Unexpected request route: ${route}`);
      return typeof fixture === "function" ? fixture(parameters) : fixture;
    },
  };
  if (options.graphql) {
    client.graphql = async (query, variables) => {
      graphqlCalls.push({ query, variables: { ...variables } });
      return options.graphql?.(query, variables);
    };
  }
  return { client, restCalls, graphqlCalls };
}

function sourceStatus(
  collection: ReadonlyArray<{ id: CollectionSourceId; status: string }>,
  id: CollectionSourceId,
): string | undefined {
  return collection.find((source) => source.id === id)?.status;
}

describe("pull request flight collection", () => {
  it("collects the frozen RTK-like blocker evidence through exact read-only routes", async () => {
    const fake = createFake({ graphql: async () => completeGraphqlResponse() });

    const facts = await collectPullRequestFlight(REFERENCE, {
      client: fake.client,
      token: "test-token-never-rendered",
    });

    expect(fake.restCalls).toEqual([
      {
        route: ROUTES.pull,
        parameters: { owner: "rtk-ai", repo: "rtk", pull_number: 3114 },
      },
      {
        route: ROUTES.reviews,
        parameters: { owner: "rtk-ai", repo: "rtk", pull_number: 3114, per_page: 100 },
      },
      {
        route: ROUTES.checks,
        parameters: {
          owner: "rtk-ai",
          repo: "rtk",
          ref: HEAD_SHA,
          filter: "latest",
          per_page: 100,
        },
      },
      {
        route: ROUTES.statuses,
        parameters: { owner: "rtk-ai", repo: "rtk", ref: HEAD_SHA, per_page: 100 },
      },
      {
        route: ROUTES.workflows,
        parameters: { owner: "rtk-ai", repo: "rtk", head_sha: HEAD_SHA, per_page: 100 },
      },
      {
        route: ROUTES.jobs,
        parameters: { owner: "rtk-ai", repo: "rtk", run_id: RUN_ID, per_page: 100 },
      },
      {
        route: ROUTES.rules,
        parameters: { owner: "rtk-ai", repo: "rtk", branch: "develop", per_page: 100 },
      },
    ]);
    expect(fake.restCalls.every(({ route }) => route.startsWith("GET "))).toBe(true);
    expect(fake.graphqlCalls).toHaveLength(1);
    expect(fake.graphqlCalls[0]?.query).toMatch(/query ManiflightPullRequest/u);
    expect(fake.graphqlCalls[0]?.query).not.toMatch(/\bmutation\b/iu);
    expect(fake.graphqlCalls[0]?.variables).toEqual({
      owner: "rtk-ai",
      repo: "rtk",
      number: 3114,
    });

    expect(facts.subject).toMatchObject({
      repository: "rtk-ai/rtk",
      number: 3114,
      head: { sha: HEAD_SHA, repository: "agrovr/rtk" },
      base: { ref: "develop", repository: "rtk-ai/rtk" },
      mergeState: "blocked",
      reviewDecision: "review_required",
    });
    expect(facts.reviewThreads).toEqual({ total: 1, unresolved: 1 });
    expect(facts.checkRuns).toEqual([
      expect.objectContaining({ name: "check-target", conclusion: "skipped" }),
    ]);
    expect(facts.commitStatuses).toEqual([
      expect.objectContaining({ context: "license/cla", state: "success" }),
    ]);
    expect(facts.workflowRuns).toEqual([
      expect.objectContaining({
        id: RUN_ID,
        name: "CI",
        conclusion: "action_required",
        jobs: 0,
      }),
    ]);
    expect(facts.branchPolicy).toEqual({
      requiredApprovals: 1,
      requireCodeOwnerReview: false,
      requireLastPushApproval: false,
      requireThreadResolution: true,
      requireUpToDate: null,
      requiredStatusChecks: [],
      requiredStatusCheckApps: [],
    });
    expect(facts.collection).toEqual([
      { id: "pull_request", status: "available" },
      { id: "graphql", status: "available" },
      { id: "reviews", status: "available" },
      { id: "check_runs", status: "available" },
      { id: "commit_statuses", status: "available" },
      { id: "workflow_runs", status: "available" },
      { id: "branch_rules", status: "available" },
    ]);
    expect(facts.warnings).toEqual([]);
  });

  it("does not attempt GraphQL without a token", async () => {
    const fake = createFake({
      graphql: async () => {
        throw new Error("GraphQL must not run without authentication");
      },
    });

    const facts = await collectPullRequestFlight(REFERENCE, { client: fake.client });

    expect(fake.graphqlCalls).toEqual([]);
    expect(facts.subject.reviewDecision).toBeNull();
    expect(facts.reviewThreads).toBeNull();
    expect(facts.collection).toContainEqual(
      expect.objectContaining({ id: "graphql", status: "not_attempted" }),
    );
    expect(facts.warnings).toEqual([]);
  });

  it("keeps failed and malformed ancillary evidence explicitly unavailable without leaking errors", async () => {
    const secret = "never-print-this-secret";
    const fail =
      (status: number): RestFixture =>
      () => {
        throw { status, message: `request failed?token=${secret}` };
      };
    const fake = createFake({
      rest: {
        [ROUTES.reviews]: fail(403),
        [ROUTES.checks]: fail(404),
        [ROUTES.statuses]: { data: { statuses: "not-an-array", error: secret } },
        [ROUTES.workflows]: { data: { workflow_runs: "not-an-array", error: secret } },
        [ROUTES.rules]: fail(403),
      },
      graphql: async () => {
        throw { response: { status: 403 }, message: `GraphQL failed: ${secret}` };
      },
    });

    const facts = await collectPullRequestFlight(REFERENCE, {
      client: fake.client,
      token: "another-secret-token",
    });

    expect(facts.reviews).toEqual([]);
    expect(facts.checkRuns).toEqual([]);
    expect(facts.commitStatuses).toEqual([]);
    expect(facts.workflowRuns).toEqual([]);
    expect(facts.branchPolicy).toBeNull();
    expect(facts.reviewThreads).toBeNull();
    for (const id of [
      "graphql",
      "reviews",
      "check_runs",
      "commit_statuses",
      "workflow_runs",
      "branch_rules",
    ] as const) {
      expect(sourceStatus(facts.collection, id)).toBe("unavailable");
    }
    expect(sourceStatus(facts.collection, "pull_request")).toBe("available");
    expect(facts.warnings).toEqual(
      expect.arrayContaining([
        "GitHub GraphQL pull request evidence were unavailable (HTTP 403)",
        "GitHub pull request reviews were unavailable (HTTP 403)",
        "GitHub check runs were unavailable (HTTP 404)",
        "GitHub commit statuses had an unexpected shape",
        "GitHub workflow runs had an unexpected shape",
        "GitHub active branch rules were unavailable (HTTP 403)",
      ]),
    );
    const serialized = JSON.stringify(facts);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("another-secret-token");
    expect(serialized).not.toContain("request failed");
    expect(serialized).not.toContain("GraphQL failed");
  });

  it("marks paginated and truncated evidence partial instead of treating it as complete", async () => {
    const nextPage = {
      link: '<https://api.github.com/resource?page=2>; rel="next", <https://api.github.com/resource?page=2>; rel="last"',
    };
    const fake = createFake({
      rest: {
        [ROUTES.reviews]: { data: [], headers: nextPage },
        [ROUTES.checks]: {
          data: {
            total_count: 2,
            check_runs: [
              {
                id: 10,
                name: "unit",
                status: "completed",
                conclusion: "success",
                html_url: "https://github.com/rtk-ai/rtk/actions/runs/10",
              },
            ],
          },
        },
        [ROUTES.statuses]: {
          data: {
            total_count: 2,
            statuses: [
              {
                id: 11,
                context: "lint",
                state: "success",
                target_url: "https://github.com/rtk-ai/rtk/pull/3114/checks",
              },
            ],
          },
        },
        [ROUTES.workflows]: {
          data: {
            total_count: 2,
            workflow_runs: [
              {
                id: 12,
                name: "CI",
                event: "pull_request",
                status: "completed",
                conclusion: "success",
                html_url: "https://github.com/rtk-ai/rtk/actions/runs/12",
              },
            ],
          },
        },
        [ROUTES.rules]: { data: [], headers: nextPage },
      },
      graphql: async () => ({
        repository: {
          pullRequest: {
            mergeStateStatus: "BLOCKED",
            reviewDecision: "REVIEW_REQUIRED",
            reviewThreads: {
              totalCount: 2,
              nodes: [{ isResolved: false }],
              pageInfo: { hasNextPage: false },
            },
          },
        },
      }),
    });

    const facts = await collectPullRequestFlight(REFERENCE, {
      client: fake.client,
      token: "test-token",
    });

    for (const id of [
      "graphql",
      "reviews",
      "check_runs",
      "commit_statuses",
      "workflow_runs",
      "branch_rules",
    ] as const) {
      expect(sourceStatus(facts.collection, id)).toBe("partial");
    }
    expect(facts.warnings).toEqual(
      expect.arrayContaining([
        "GitHub GraphQL pull request evidence was incomplete",
        "GitHub pull request reviews were incomplete",
        "GitHub check runs were incomplete",
        "GitHub commit statuses were incomplete",
        "GitHub workflow runs were incomplete",
        "GitHub active branch rules were incomplete",
      ]),
    );
  });

  it("sanitizes hostile remote metadata and redacts credential query parameters", async () => {
    const fallbackUrl = "https://github.com/rtk-ai/rtk/pull/3114";
    const fake = createFake({
      rest: {
        [ROUTES.pull]: {
          data: pullRequestData({
            title: "\u001b[31mDanger\u202e README\nTitle",
            html_url: `${fallbackUrl}?token=top-secret&apiKey=api-secret&X-Amz-Signature=aws-secret&clientSecret=client-secret&view=files#credential-fragment`,
            user: { login: "evil\r\nuser\u2066" },
          }),
        },
        [ROUTES.reviews]: {
          data: [
            {
              id: 20,
              user: { login: "reviewer\u202e" },
              state: "APPROVED\nspoofed",
              submitted_at: "2026-07-21T05:00:00Z",
              html_url: `${fallbackUrl}?signature=review-secret#fragment`,
            },
          ],
        },
        [ROUTES.checks]: {
          data: {
            total_count: 1,
            check_runs: [
              {
                id: 21,
                name: "ci\u001b[2J\nspoofed",
                status: "completed",
                conclusion: "success",
                app: { slug: "bot\u202e" },
                html_url: `${fallbackUrl}?accessToken=check-secret&authToken=auth-secret#fragment`,
              },
            ],
          },
        },
        [ROUTES.statuses]: {
          data: {
            total_count: 1,
            statuses: [
              {
                id: 22,
                context: "license\r\ncla",
                state: "success",
                creator: { login: "bot\u2066" },
                target_url: "https://user:password@github.com/rtk-ai/rtk/checks",
              },
            ],
          },
        },
        [ROUTES.workflows]: {
          data: {
            total_count: 1,
            workflow_runs: [
              {
                id: 23,
                name: "workflow\u0000spoofed",
                event: "pull_request",
                status: "completed",
                conclusion: "success",
                html_url: "javascript:alert(1)",
              },
            ],
          },
        },
        [ROUTES.rules]: {
          data: [
            {
              type: "required_status_checks",
              parameters: {
                strict_required_status_checks_policy: true,
                required_status_checks: [{ context: "required\ncheck\u202e" }],
              },
            },
          ],
        },
      },
    });

    const facts = await collectPullRequestFlight(REFERENCE, { client: fake.client });

    expect(facts.subject.title).toBe("[31mDanger README Title");
    expect(facts.subject.author).toBe("evil user");
    expect(facts.subject.url).toBe(fallbackUrl);
    expect(facts.subject.url).not.toContain("credential-fragment");
    expect(facts.reviews[0]).toMatchObject({
      user: "reviewer",
      state: "approved spoofed",
    });
    expect(facts.reviews[0]?.url).toBe(fallbackUrl);
    expect(facts.checkRuns[0]).toMatchObject({ name: "ci [2J spoofed", app: "bot" });
    expect(facts.checkRuns[0]?.url).toBe(fallbackUrl);
    expect(facts.commitStatuses[0]).toMatchObject({
      context: "license cla",
      creator: "bot",
      url: facts.subject.url,
    });
    expect(facts.workflowRuns[0]).toMatchObject({
      name: "workflow spoofed",
      url: facts.subject.url,
    });
    expect(facts.branchPolicy?.requiredStatusChecks).toEqual(["required check"]);

    const serialized = JSON.stringify(facts);
    for (const secret of [
      "top-secret",
      "review-secret",
      "check-secret",
      "api-secret",
      "aws-secret",
      "client-secret",
      "auth-secret",
      "password@",
      "credential-fragment",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(
      [...serialized].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return (
          codePoint <= 0x1f ||
          (codePoint >= 0x7f && codePoint <= 0x9f) ||
          (codePoint >= 0x202a && codePoint <= 0x202e) ||
          (codePoint >= 0x2066 && codePoint <= 0x2069)
        );
      }),
    ).toBe(false);
  });

  it("fails a primary pull-request error with only a safe HTTP status", async () => {
    const fake = createFake({
      rest: {
        [ROUTES.pull]: () => {
          throw {
            response: { status: 502 },
            message: "upstream leaked https://example.test?token=primary-secret",
          };
        },
      },
    });

    await expect(collectPullRequestFlight(REFERENCE, { client: fake.client })).rejects.toThrow(
      /^GitHub pull request was unavailable \(HTTP 502\)$/u,
    );
    expect(fake.restCalls).toHaveLength(1);
  });
});
