import { Octokit } from "@octokit/rest";
import type { GitHubRepositoryMetadata } from "../model.js";
import { VERSION } from "../version.js";

interface ApiResponse {
  data: unknown;
}

export interface GitHubApi {
  repos: {
    get(parameters: { owner: string; repo: string }): Promise<ApiResponse>;
    listLanguages(parameters: { owner: string; repo: string }): Promise<ApiResponse>;
    getCommunityProfileMetrics(parameters: { owner: string; repo: string }): Promise<ApiResponse>;
  };
}

export interface GitHubCollection {
  metadata?: GitHubRepositoryMetadata;
  warnings: string[];
}

export interface GitHubCollectionOptions {
  token?: string;
  required?: boolean;
  client?: GitHubApi;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseRepositorySlug(value: string): { owner: string; repo: string } {
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})$/u.exec(value);
  if (!match?.[1] || !match[2] || match[2] === "." || match[2] === "..") {
    throw new Error("Repository must use the owner/name format");
  }
  return { owner: match[1], repo: match[2] };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function communityFiles(data: UnknownRecord): string[] {
  if (!isRecord(data.files)) return [];
  const paths = new Set<string>();
  for (const value of Object.values(data.files)) {
    if (!isRecord(value)) continue;
    const htmlUrl = optionalString(value.html_url);
    const name = optionalString(value.name);
    if (name) paths.add(name);
    else if (htmlUrl) {
      const marker = "/blob/";
      const markerIndex = htmlUrl.indexOf(marker);
      const pathStart = markerIndex >= 0 ? htmlUrl.indexOf("/", markerIndex + marker.length) : -1;
      if (pathStart >= 0) paths.add(decodeURIComponent(htmlUrl.slice(pathStart + 1)));
    }
  }
  return [...paths].sort();
}

function statusOf(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

export async function collectGitHub(
  repository: string,
  options: GitHubCollectionOptions = {},
): Promise<GitHubCollection> {
  const { owner, repo } = parseRepositorySlug(repository);
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
    }) as unknown as GitHubApi);

  const [repositoryResult, languagesResult, communityResult] = await Promise.allSettled([
    client.repos.get({ owner, repo }),
    client.repos.listLanguages({ owner, repo }),
    client.repos.getCommunityProfileMetrics({ owner, repo }),
  ]);

  if (repositoryResult.status === "rejected") {
    const status = statusOf(repositoryResult.reason);
    const message = `GitHub repository metadata was unavailable${status ? ` (HTTP ${status})` : ""}`;
    if (options.required) throw new Error(message);
    return { warnings: [message] };
  }
  if (!isRecord(repositoryResult.value.data)) {
    if (options.required) throw new Error("GitHub repository metadata had an unexpected shape");
    return { warnings: ["GitHub repository metadata had an unexpected shape"] };
  }

  const repositoryData = repositoryResult.value.data;
  const warnings: string[] = [];
  let languages: Record<string, number> = {};
  if (languagesResult.status === "fulfilled" && isRecord(languagesResult.value.data)) {
    languages = Object.fromEntries(
      Object.entries(languagesResult.value.data)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number")
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  } else {
    warnings.push("GitHub language metadata was unavailable");
  }

  let healthPercentage: number | undefined;
  let files: string[] = [];
  if (communityResult.status === "fulfilled" && isRecord(communityResult.value.data)) {
    const health = communityResult.value.data.health_percentage;
    if (typeof health === "number") healthPercentage = health;
    files = communityFiles(communityResult.value.data);
  } else {
    warnings.push("GitHub community profile metadata was unavailable");
  }

  const topics = Array.isArray(repositoryData.topics)
    ? repositoryData.topics.filter((topic): topic is string => typeof topic === "string").sort()
    : [];
  const name = optionalString(repositoryData.name) ?? repo;
  const url = optionalString(repositoryData.html_url) ?? `https://github.com/${owner}/${repo}`;
  const description = optionalString(repositoryData.description);
  const defaultBranch = optionalString(repositoryData.default_branch);
  const visibility = optionalString(repositoryData.visibility);
  const hasIssues = optionalBoolean(repositoryData.has_issues);
  const hasDiscussions = optionalBoolean(repositoryData.has_discussions);
  const metadata: GitHubRepositoryMetadata = {
    owner,
    name,
    url,
    ...(description ? { description } : {}),
    ...(defaultBranch ? { defaultBranch } : {}),
    ...(visibility ? { visibility } : {}),
    topics,
    languages,
    ...(hasIssues === undefined ? {} : { hasIssues }),
    ...(hasDiscussions === undefined ? {} : { hasDiscussions }),
    ...(healthPercentage === undefined ? {} : { communityHealthPercentage: healthPercentage }),
    communityFiles: files,
  };

  return { metadata, warnings };
}
