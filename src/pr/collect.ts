import { Octokit } from "@octokit/rest";
import { VERSION } from "../version.js";
import type {
  BranchPolicyFact,
  CheckRunFact,
  CollectionSource,
  CollectionSourceId,
  CommitStatusFact,
  PullRequestFlightFacts,
  PullRequestSubject,
  ReviewFact,
  ReviewThreadFact,
  WorkflowRunFact,
} from "./model.js";
import type { PullRequestReference } from "./reference.js";
import { optionalSanitizedText, sanitizeText, sanitizeUrl } from "./sanitize.js";

export interface PullRequestApiResponse {
  data: unknown;
  headers?: Readonly<Record<string, string | number | undefined>>;
}

export interface PullRequestApi {
  request(
    route: string,
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<PullRequestApiResponse>;
  graphql?(query: string, variables: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export interface PullRequestFlightCollectionOptions {
  token?: string;
  client?: PullRequestApi;
}

export type PullRequestCollectionOptions = PullRequestFlightCollectionOptions;

type UnknownRecord = Record<string, unknown>;

const GRAPHQL_PULL_REQUEST_QUERY = `
  query ManiflightPullRequest($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        mergeStateStatus
        reviewDecision
        reviewThreads(first: 100) {
          totalCount
          nodes {
            isResolved
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    }
  }
`;

const MAX_ACTION_REQUIRED_JOB_LOOKUPS = 20;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecord(value: unknown, key: string): UnknownRecord | undefined {
  if (!isRecord(value)) return undefined;
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function positiveId(value: unknown): number | undefined {
  const number = numberValue(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function normalizedToken(value: unknown, fallback: string): string {
  const text = sanitizeText(value, 80).toLowerCase();
  return text || fallback;
}

function safeUrl(value: unknown, fallback: string): string {
  return sanitizeUrl(value) ?? fallback;
}

function safeSource(
  id: CollectionSourceId,
  status: CollectionSource["status"],
  detail?: string,
): CollectionSource {
  return detail ? { id, status, detail } : { id, status };
}

function statusOf(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const direct = numberValue(error.status);
  if (direct !== undefined && direct >= 100 && direct <= 599) return direct;
  const response = getRecord(error, "response");
  const nested = response ? numberValue(response.status) : undefined;
  return nested !== undefined && nested >= 100 && nested <= 599 ? nested : undefined;
}

function httpSuffix(error: unknown): string {
  const status = statusOf(error);
  return status === undefined ? "" : ` (HTTP ${status})`;
}

function hasNextPage(response: PullRequestApiResponse): boolean {
  if (!response.headers) return false;
  for (const [name, value] of Object.entries(response.headers)) {
    if (name.toLowerCase() !== "link" || typeof value !== "string") continue;
    if (/(?:^|,)\s*<[^>]+>\s*;[^,]*\brel=["']?next["']?/iu.test(value)) return true;
  }
  return false;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueById<T extends { id: number }>(values: T[]): T[] {
  const byId = new Map<number, T>();
  for (const value of values) {
    if (!byId.has(value.id)) byId.set(value.id, value);
  }
  return [...byId.values()];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function repositoryName(value: unknown, fallback: string): string {
  const fullName = optionalSanitizedText(getRecord(value, "repo")?.full_name, 140);
  return fullName ?? fallback;
}

function parseSubject(
  data: unknown,
  reference: PullRequestReference,
): PullRequestSubject | undefined {
  if (!isRecord(data)) return undefined;
  const base = getRecord(data, "base");
  const head = getRecord(data, "head");
  const state = normalizedToken(data.state, "");
  const baseRef = optionalSanitizedText(base?.ref, 255);
  const baseSha = optionalSanitizedText(base?.sha, 100);
  const headRef = optionalSanitizedText(head?.ref, 255);
  const headSha = optionalSanitizedText(head?.sha, 100);
  if (!base || !head || (state !== "open" && state !== "closed")) return undefined;
  if (!baseRef || !baseSha || !headRef || !headSha) return undefined;

  const fallbackUrl = `https://github.com/${reference.repository}/pull/${reference.number}`;
  const user = getRecord(data, "user");
  const mergeable = typeof data.mergeable === "boolean" ? data.mergeable : null;
  const mergeState = optionalSanitizedText(data.mergeable_state, 80)?.toLowerCase() ?? null;
  return {
    repository: reference.repository,
    number: reference.number,
    url: safeUrl(data.html_url, fallbackUrl),
    title: sanitizeText(data.title, 240) || `Pull request #${reference.number}`,
    state,
    merged: data.merged === true || typeof data.merged_at === "string",
    draft: data.draft === true,
    author: sanitizeText(user?.login, 80) || "unknown",
    base: {
      ref: baseRef,
      sha: baseSha,
      repository: repositoryName(base, reference.repository),
    },
    head: {
      ref: headRef,
      sha: headSha,
      repository: repositoryName(head, reference.repository),
    },
    mergeable,
    mergeState,
    reviewDecision: null,
  };
}

function unwrapGraphqlResult(value: unknown): UnknownRecord | undefined {
  if (!isRecord(value)) return undefined;
  if (isRecord(value.repository)) return value;
  return isRecord(value.data) ? value.data : value;
}

function parseGraphqlAggregate(value: unknown): {
  mergeState: string | null;
  reviewDecision: string | null;
  reviewThreads: ReviewThreadFact | null;
  partial: boolean;
} | null {
  const root = unwrapGraphqlResult(value);
  const repository = getRecord(root, "repository");
  const pullRequest = getRecord(repository, "pullRequest");
  if (!pullRequest) return null;

  let partial = false;
  const hasMergeState = Object.hasOwn(pullRequest, "mergeStateStatus");
  const hasReviewDecision = Object.hasOwn(pullRequest, "reviewDecision");
  if (!hasMergeState || !hasReviewDecision) partial = true;
  const mergeState = optionalSanitizedText(pullRequest.mergeStateStatus, 80)?.toLowerCase() ?? null;
  const reviewDecision =
    optionalSanitizedText(pullRequest.reviewDecision, 80)?.toLowerCase() ?? null;

  const threads = getRecord(pullRequest, "reviewThreads");
  if (!threads || !Array.isArray(threads.nodes)) {
    return { mergeState, reviewDecision, reviewThreads: null, partial: true };
  }

  let unresolved = 0;
  let validNodes = 0;
  for (const node of threads.nodes) {
    if (!isRecord(node) || typeof node.isResolved !== "boolean") {
      partial = true;
      continue;
    }
    validNodes += 1;
    if (!node.isResolved) unresolved += 1;
  }
  const reportedTotal = numberValue(threads.totalCount);
  if (reportedTotal === undefined) partial = true;
  const total = reportedTotal ?? validNodes;
  const pageInfo = getRecord(threads, "pageInfo");
  if (!pageInfo || typeof pageInfo.hasNextPage !== "boolean") partial = true;
  if (pageInfo?.hasNextPage === true || total > threads.nodes.length) partial = true;
  return {
    mergeState,
    reviewDecision,
    reviewThreads: { total, unresolved },
    partial,
  };
}

function parseReviews(
  data: unknown,
  fallbackUrl: string,
): {
  values: ReviewFact[];
  malformed: boolean;
} | null {
  if (!Array.isArray(data)) return null;
  let malformed = false;
  const values: ReviewFact[] = [];
  for (const item of data) {
    if (!isRecord(item)) {
      malformed = true;
      continue;
    }
    const id = positiveId(item.id);
    if (id === undefined) {
      malformed = true;
      continue;
    }
    values.push({
      id,
      user: sanitizeText(getRecord(item, "user")?.login, 80) || "unknown",
      state: normalizedToken(item.state, "unknown"),
      submittedAt: optionalSanitizedText(item.submitted_at, 80),
      url: safeUrl(item.html_url, fallbackUrl),
    });
  }
  return {
    values: uniqueById(values).sort((left, right) => {
      const user = compareText(left.user, right.user);
      if (user !== 0) return user;
      const submitted = compareText(left.submittedAt ?? "", right.submittedAt ?? "");
      return submitted !== 0 ? submitted : left.id - right.id;
    }),
    malformed,
  };
}

function parseCheckRuns(
  data: unknown,
  fallbackUrl: string,
): {
  values: CheckRunFact[];
  malformed: boolean;
  total: number;
} | null {
  if (!isRecord(data) || !Array.isArray(data.check_runs)) return null;
  let malformed = false;
  const values: CheckRunFact[] = [];
  for (const item of data.check_runs) {
    if (!isRecord(item)) {
      malformed = true;
      continue;
    }
    const id = positiveId(item.id);
    if (id === undefined) {
      malformed = true;
      continue;
    }
    const app = getRecord(item, "app");
    values.push({
      id,
      name: sanitizeText(item.name, 160) || `Check run ${id}`,
      status: normalizedToken(item.status, "unknown"),
      conclusion:
        item.conclusion === null
          ? null
          : (optionalSanitizedText(item.conclusion, 80)?.toLowerCase() ?? null),
      app: optionalSanitizedText(app?.slug ?? app?.name, 120),
      appId: positiveId(app?.id) ?? null,
      url: safeUrl(item.html_url ?? item.details_url, fallbackUrl),
    });
  }
  const total = numberValue(data.total_count) ?? data.check_runs.length;
  return {
    values: uniqueById(values).sort((left, right) => {
      const name = compareText(left.name, right.name);
      if (name !== 0) return name;
      const app = compareText(left.app ?? "", right.app ?? "");
      return app !== 0 ? app : left.id - right.id;
    }),
    malformed,
    total,
  };
}

function parseCommitStatuses(
  data: unknown,
  fallbackUrl: string,
): {
  values: CommitStatusFact[];
  malformed: boolean;
  total: number;
} | null {
  if (!isRecord(data) || !Array.isArray(data.statuses)) return null;
  let malformed = false;
  const values: CommitStatusFact[] = [];
  for (const item of data.statuses) {
    if (!isRecord(item)) {
      malformed = true;
      continue;
    }
    const id = positiveId(item.id);
    if (id === undefined) {
      malformed = true;
      continue;
    }
    values.push({
      id,
      context: sanitizeText(item.context, 160) || `Commit status ${id}`,
      state: normalizedToken(item.state, "unknown"),
      creator: optionalSanitizedText(getRecord(item, "creator")?.login, 80),
      url: safeUrl(item.target_url, fallbackUrl),
    });
  }
  const total = numberValue(data.total_count) ?? data.statuses.length;
  return {
    values: uniqueById(values).sort((left, right) => {
      const context = compareText(left.context, right.context);
      if (context !== 0) return context;
      const creator = compareText(left.creator ?? "", right.creator ?? "");
      return creator !== 0 ? creator : left.id - right.id;
    }),
    malformed,
    total,
  };
}

function parseWorkflowRuns(
  data: unknown,
  fallbackUrl: string,
): {
  values: WorkflowRunFact[];
  malformed: boolean;
  total: number;
} | null {
  if (!isRecord(data) || !Array.isArray(data.workflow_runs)) return null;
  let malformed = false;
  const values: WorkflowRunFact[] = [];
  for (const item of data.workflow_runs) {
    if (!isRecord(item)) {
      malformed = true;
      continue;
    }
    const id = positiveId(item.id);
    if (id === undefined) {
      malformed = true;
      continue;
    }
    values.push({
      id,
      name: sanitizeText(item.name ?? item.display_title, 160) || `Workflow run ${id}`,
      event: normalizedToken(item.event, "unknown"),
      status: normalizedToken(item.status, "unknown"),
      conclusion:
        item.conclusion === null
          ? null
          : (optionalSanitizedText(item.conclusion, 80)?.toLowerCase() ?? null),
      jobs: null,
      url: safeUrl(item.html_url, fallbackUrl),
    });
  }
  const total = numberValue(data.total_count) ?? data.workflow_runs.length;
  return {
    values: uniqueById(values).sort((left, right) => {
      const name = compareText(left.name, right.name);
      if (name !== 0) return name;
      const event = compareText(left.event, right.event);
      return event !== 0 ? event : left.id - right.id;
    }),
    malformed,
    total,
  };
}

function booleanAggregate(values: Array<boolean | undefined>): boolean | null {
  if (values.includes(true)) return true;
  return values.includes(false) ? false : null;
}

function parseBranchPolicy(data: unknown): {
  policy: BranchPolicyFact | null;
  malformed: boolean;
  count: number;
} | null {
  const rules = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.rules)
      ? data.rules
      : null;
  if (!rules) return null;

  let malformed = false;
  const approvals: number[] = [];
  const codeOwnerValues: Array<boolean | undefined> = [];
  const lastPushValues: Array<boolean | undefined> = [];
  const threadValues: Array<boolean | undefined> = [];
  const upToDateValues: Array<boolean | undefined> = [];
  const requiredChecks: string[] = [];
  const requiredCheckApps: Array<{ context: string; integrationId: number | null }> = [];
  let relevantRules = 0;
  for (const item of rules) {
    if (!isRecord(item)) {
      malformed = true;
      continue;
    }
    const type = normalizedToken(item.type, "");
    if (type !== "pull_request" && type !== "required_status_checks") continue;
    relevantRules += 1;
    const parameters = getRecord(item, "parameters");
    if (!parameters) {
      malformed = true;
      continue;
    }
    if (type === "pull_request") {
      const approvalCount = numberValue(parameters.required_approving_review_count);
      if (approvalCount !== undefined) approvals.push(approvalCount);
      codeOwnerValues.push(
        typeof parameters.require_code_owner_review === "boolean"
          ? parameters.require_code_owner_review
          : undefined,
      );
      lastPushValues.push(
        typeof parameters.require_last_push_approval === "boolean"
          ? parameters.require_last_push_approval
          : undefined,
      );
      const threadResolution =
        parameters.required_review_thread_resolution ?? parameters.require_thread_resolution;
      threadValues.push(typeof threadResolution === "boolean" ? threadResolution : undefined);
      continue;
    }

    const checks = parameters.required_status_checks;
    upToDateValues.push(
      typeof parameters.strict_required_status_checks_policy === "boolean"
        ? parameters.strict_required_status_checks_policy
        : undefined,
    );
    if (!Array.isArray(checks)) {
      malformed = true;
      continue;
    }
    for (const check of checks) {
      const context = isRecord(check) ? check.context : check;
      const normalized = optionalSanitizedText(context, 160);
      if (!normalized) {
        malformed = true;
        continue;
      }
      requiredChecks.push(normalized);
      const integrationId = isRecord(check) ? positiveId(check.integration_id) : undefined;
      requiredCheckApps.push({ context: normalized, integrationId: integrationId ?? null });
    }
  }

  if (relevantRules === 0) return { policy: null, malformed, count: rules.length };
  return {
    policy: {
      requiredApprovals: approvals.length > 0 ? Math.max(...approvals) : null,
      requireCodeOwnerReview: booleanAggregate(codeOwnerValues),
      requireLastPushApproval: booleanAggregate(lastPushValues),
      requireThreadResolution: booleanAggregate(threadValues),
      requireUpToDate: booleanAggregate(upToDateValues),
      requiredStatusChecks: uniqueSorted(requiredChecks),
      requiredStatusCheckApps: requiredCheckApps
        .filter(
          (check, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.context === check.context &&
                candidate.integrationId === check.integrationId,
            ) === index,
        )
        .sort(
          (left, right) =>
            compareText(left.context, right.context) ||
            (left.integrationId ?? 0) - (right.integrationId ?? 0),
        ),
    },
    malformed,
    count: rules.length,
  };
}

function isRestPartial(response: PullRequestApiResponse, returned: number, total: number): boolean {
  return hasNextPage(response) || total > returned;
}

function unavailableWarning(label: string, error: unknown): string {
  return `${label} were unavailable${httpSuffix(error)}`;
}

export async function collectPullRequestFlight(
  reference: PullRequestReference,
  options: PullRequestFlightCollectionOptions = {},
): Promise<PullRequestFlightFacts> {
  const client =
    options.client ??
    (new Octokit({
      ...(options.token ? { auth: options.token } : {}),
      userAgent: `maniflight/${VERSION}`,
      request: {
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": "2026-03-10",
        },
      },
    }) as unknown as PullRequestApi);
  const parameters = {
    owner: reference.owner,
    repo: reference.repo,
    pull_number: reference.number,
  };
  const collection: CollectionSource[] = [];
  const warnings: string[] = [];

  let pullResponse: PullRequestApiResponse;
  try {
    pullResponse = await client.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      parameters,
    );
  } catch (error) {
    throw new Error(`GitHub pull request was unavailable${httpSuffix(error)}`);
  }
  const subject = parseSubject(pullResponse.data, reference);
  if (!subject) throw new Error("GitHub pull request metadata had an unexpected shape");
  collection.push(safeSource("pull_request", "available"));

  let reviewThreads: ReviewThreadFact | null = null;
  if (!options.token) {
    collection.push(
      safeSource(
        "graphql",
        "not_attempted",
        "Authentication is required for review-decision and review-thread evidence.",
      ),
    );
  } else if (!client.graphql) {
    const warning = "GitHub GraphQL pull request evidence was unavailable";
    collection.push(safeSource("graphql", "unavailable", warning));
    warnings.push(warning);
  } else {
    try {
      const response = await client.graphql(GRAPHQL_PULL_REQUEST_QUERY, {
        owner: reference.owner,
        repo: reference.repo,
        number: reference.number,
      });
      const aggregate = parseGraphqlAggregate(response);
      if (!aggregate) {
        const warning = "GitHub GraphQL pull request evidence had an unexpected shape";
        collection.push(safeSource("graphql", "unavailable", warning));
        warnings.push(warning);
      } else {
        subject.mergeState = aggregate.mergeState ?? subject.mergeState;
        subject.reviewDecision = aggregate.reviewDecision;
        reviewThreads = aggregate.reviewThreads;
        if (aggregate.partial) {
          const warning = "GitHub GraphQL pull request evidence was incomplete";
          collection.push(safeSource("graphql", "partial", warning));
          warnings.push(warning);
        } else {
          collection.push(safeSource("graphql", "available"));
        }
      }
    } catch (error) {
      const warning = unavailableWarning("GitHub GraphQL pull request evidence", error);
      collection.push(safeSource("graphql", "unavailable", warning));
      warnings.push(warning);
    }
  }

  let reviews: ReviewFact[] = [];
  try {
    const response = await client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
      ...parameters,
      per_page: 100,
    });
    const parsed = parseReviews(response.data, subject.url);
    if (!parsed) {
      const warning = "GitHub pull request reviews had an unexpected shape";
      collection.push(safeSource("reviews", "unavailable", warning));
      warnings.push(warning);
    } else {
      reviews = parsed.values;
      const partial = hasNextPage(response) || parsed.malformed;
      if (partial) {
        const warning = "GitHub pull request reviews were incomplete";
        collection.push(safeSource("reviews", "partial", warning));
        warnings.push(warning);
      } else {
        collection.push(safeSource("reviews", "available"));
      }
    }
  } catch (error) {
    const warning = unavailableWarning("GitHub pull request reviews", error);
    collection.push(safeSource("reviews", "unavailable", warning));
    warnings.push(warning);
  }

  let checkRuns: CheckRunFact[] = [];
  try {
    const response = await client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
      owner: reference.owner,
      repo: reference.repo,
      ref: subject.head.sha,
      filter: "latest",
      per_page: 100,
    });
    const parsed = parseCheckRuns(response.data, subject.url);
    if (!parsed) {
      const warning = "GitHub check runs had an unexpected shape";
      collection.push(safeSource("check_runs", "unavailable", warning));
      warnings.push(warning);
    } else {
      checkRuns = parsed.values;
      const partial =
        parsed.malformed || isRestPartial(response, parsed.values.length, parsed.total);
      if (partial) {
        const warning = "GitHub check runs were incomplete";
        collection.push(safeSource("check_runs", "partial", warning));
        warnings.push(warning);
      } else {
        collection.push(safeSource("check_runs", "available"));
      }
    }
  } catch (error) {
    const warning = unavailableWarning("GitHub check runs", error);
    collection.push(safeSource("check_runs", "unavailable", warning));
    warnings.push(warning);
  }

  let commitStatuses: CommitStatusFact[] = [];
  try {
    const response = await client.request("GET /repos/{owner}/{repo}/commits/{ref}/status", {
      owner: reference.owner,
      repo: reference.repo,
      ref: subject.head.sha,
      per_page: 100,
    });
    const parsed = parseCommitStatuses(response.data, subject.url);
    if (!parsed) {
      const warning = "GitHub commit statuses had an unexpected shape";
      collection.push(safeSource("commit_statuses", "unavailable", warning));
      warnings.push(warning);
    } else {
      commitStatuses = parsed.values;
      const partial =
        parsed.malformed || isRestPartial(response, parsed.values.length, parsed.total);
      if (partial) {
        const warning = "GitHub commit statuses were incomplete";
        collection.push(safeSource("commit_statuses", "partial", warning));
        warnings.push(warning);
      } else {
        collection.push(safeSource("commit_statuses", "available"));
      }
    }
  } catch (error) {
    const warning = unavailableWarning("GitHub commit statuses", error);
    collection.push(safeSource("commit_statuses", "unavailable", warning));
    warnings.push(warning);
  }

  let workflowRuns: WorkflowRunFact[] = [];
  let workflowSourceStatus: CollectionSource["status"] = "available";
  let workflowSourceDetail: string | undefined;
  try {
    const response = await client.request("GET /repos/{owner}/{repo}/actions/runs", {
      owner: reference.owner,
      repo: reference.repo,
      head_sha: subject.head.sha,
      per_page: 100,
    });
    const parsed = parseWorkflowRuns(response.data, subject.url);
    if (!parsed) {
      const warning = "GitHub workflow runs had an unexpected shape";
      workflowSourceStatus = "unavailable";
      workflowSourceDetail = warning;
      warnings.push(warning);
    } else {
      workflowRuns = parsed.values;
      if (parsed.malformed || isRestPartial(response, parsed.values.length, parsed.total)) {
        workflowSourceStatus = "partial";
        workflowSourceDetail = "GitHub workflow runs were incomplete";
        warnings.push(workflowSourceDetail);
      }

      const actionRequired = workflowRuns.filter((run) => run.conclusion === "action_required");
      if (actionRequired.length > MAX_ACTION_REQUIRED_JOB_LOOKUPS) {
        workflowSourceStatus = "partial";
        workflowSourceDetail = "Some action-required workflow job counts were not inspected";
        warnings.push(workflowSourceDetail);
      }
      for (const run of actionRequired.slice(0, MAX_ACTION_REQUIRED_JOB_LOOKUPS)) {
        try {
          const jobsResponse = await client.request(
            "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
            {
              owner: reference.owner,
              repo: reference.repo,
              run_id: run.id,
              per_page: 100,
            },
          );
          if (!isRecord(jobsResponse.data) || !Array.isArray(jobsResponse.data.jobs)) {
            workflowSourceStatus = "partial";
            workflowSourceDetail = "Some action-required workflow job counts were unavailable";
            warnings.push(workflowSourceDetail);
            continue;
          }
          const total = numberValue(jobsResponse.data.total_count);
          run.jobs = total ?? jobsResponse.data.jobs.length;
          if (total === undefined && hasNextPage(jobsResponse)) {
            workflowSourceStatus = "partial";
            workflowSourceDetail = "Some action-required workflow job counts were incomplete";
            warnings.push(workflowSourceDetail);
          }
        } catch (error) {
          workflowSourceStatus = "partial";
          workflowSourceDetail = "Some action-required workflow job counts were unavailable";
          warnings.push(`${workflowSourceDetail}${httpSuffix(error)}`);
        }
      }
    }
  } catch (error) {
    workflowSourceStatus = "unavailable";
    workflowSourceDetail = unavailableWarning("GitHub workflow runs", error);
    warnings.push(workflowSourceDetail);
  }
  collection.push(safeSource("workflow_runs", workflowSourceStatus, workflowSourceDetail));

  let branchPolicy: BranchPolicyFact | null = null;
  try {
    const response = await client.request("GET /repos/{owner}/{repo}/rules/branches/{branch}", {
      owner: reference.owner,
      repo: reference.repo,
      branch: subject.base.ref,
      per_page: 100,
    });
    const parsed = parseBranchPolicy(response.data);
    if (!parsed) {
      const warning = "GitHub active branch rules had an unexpected shape";
      collection.push(safeSource("branch_rules", "unavailable", warning));
      warnings.push(warning);
    } else {
      branchPolicy = parsed.policy;
      const partial = parsed.malformed || hasNextPage(response);
      if (partial) {
        const warning = "GitHub active branch rules were incomplete";
        collection.push(safeSource("branch_rules", "partial", warning));
        warnings.push(warning);
      } else {
        const detail =
          parsed.policy === null
            ? "No active pull-request or required-status-check rules were reported."
            : undefined;
        collection.push(safeSource("branch_rules", "available", detail));
      }
    }
  } catch (error) {
    const warning = unavailableWarning("GitHub active branch rules", error);
    collection.push(safeSource("branch_rules", "unavailable", warning));
    warnings.push(warning);
  }

  return {
    subject,
    reviews,
    checkRuns,
    commitStatuses,
    workflowRuns,
    branchPolicy,
    reviewThreads,
    collection,
    warnings: uniqueSorted(warnings),
  };
}
