import { describe, expect, it } from "vitest";
import { collectGitHub, type GitHubApi, parseRepositorySlug } from "../src/collect/github.js";

describe("GitHub metadata collection", () => {
  it("validates owner/name without accepting path-like input", () => {
    expect(parseRepositorySlug("agrovr/maniflight")).toEqual({
      owner: "agrovr",
      repo: "maniflight",
    });
    expect(() => parseRepositorySlug("agrovr/maniflight/extra")).toThrow("owner/name");
    expect(() => parseRepositorySlug("../maniflight")).toThrow("owner/name");
  });

  it("normalizes read-only metadata and sorts topics and languages", async () => {
    const client: GitHubApi = {
      repos: {
        get: async () => ({
          data: {
            name: "maniflight",
            html_url: "https://github.com/agrovr/maniflight",
            description: "Repository diagnostics",
            default_branch: "main",
            visibility: "public",
            topics: ["typescript", "github-actions"],
            has_issues: true,
            has_discussions: false,
          },
        }),
        listLanguages: async () => ({ data: { TypeScript: 1000, CSS: 100 } }),
        getCommunityProfileMetrics: async () => ({
          data: {
            health_percentage: 100,
            files: {
              readme: { name: "README.md" },
              license: { name: "LICENSE" },
            },
          },
        }),
      },
    };

    const result = await collectGitHub("agrovr/maniflight", { client, required: true });
    expect(result.warnings).toEqual([]);
    expect(result.metadata?.languages).toEqual({ CSS: 100, TypeScript: 1000 });
    expect(result.metadata?.topics).toEqual(["github-actions", "typescript"]);
    expect(result.metadata?.communityFiles).toEqual(["LICENSE", "README.md"]);
    expect(result.metadata?.communityHealthPercentage).toBe(100);
  });

  it("degrades API failure to an explicit warning unless metadata is required", async () => {
    const failing: GitHubApi = {
      repos: {
        get: async () => Promise.reject({ status: 404 }),
        listLanguages: async () => Promise.reject({ status: 404 }),
        getCommunityProfileMetrics: async () => Promise.reject({ status: 404 }),
      },
    };
    await expect(collectGitHub("agrovr/missing", { client: failing })).resolves.toEqual({
      warnings: ["GitHub repository metadata was unavailable (HTTP 404)"],
    });
    await expect(
      collectGitHub("agrovr/missing", { client: failing, required: true }),
    ).rejects.toThrow("HTTP 404");
  });
});
