import { resolve } from "node:path";
import createIgnore from "ignore";
import { collectFilesystem } from "./collect/filesystem.js";
import { collectGitHub } from "./collect/github.js";
import { collectWorkflows } from "./collect/workflows.js";
import { loadConfig } from "./config.js";
import type { CheckResult, GitHubRepositoryMetadata, RunOptions, RunResult } from "./model.js";
import { buildReport } from "./report/score.js";
import { evaluateRules } from "./rules/index.js";
import { VERSION } from "./version.js";

function applyWaivers(
  checks: CheckResult[],
  ignoreRules: RunResult["config"]["ignore"],
): CheckResult[] {
  return checks.map((check) => {
    const waiver = ignoreRules.find((candidate) => {
      if (candidate.rule !== check.ruleId) return false;
      if (candidate.paths.length === 0) return true;
      const matcher = createIgnore().add(candidate.paths);
      return check.evidence.some((evidence) => evidence.path && matcher.ignores(evidence.path));
    });
    return waiver
      ? {
          ...check,
          waiver: {
            reason: waiver.reason,
            ...(waiver.paths.length > 0 ? { path: waiver.paths.join(", ") } : {}),
          },
        }
      : check;
  });
}

export async function runManiflight(options: RunOptions = {}): Promise<RunResult> {
  const root = resolve(options.root ?? process.cwd());
  const loaded = await loadConfig(root, options.configPath);
  const filesystem = await collectFilesystem(root, loaded.config);
  const workflowCollection = await collectWorkflows(
    filesystem.root,
    filesystem.files,
    loaded.config,
    filesystem.collection.parsedBytes,
  );

  let github: GitHubRepositoryMetadata | undefined;
  const warnings = [...filesystem.collection.warnings, ...workflowCollection.warnings];
  if (options.repository && loaded.config.github.enabled) {
    const githubCollection = await collectGitHub(options.repository, {
      ...(options.token ? { token: options.token } : {}),
      ...(options.requireGitHub === undefined ? {} : { required: options.requireGitHub }),
    });
    github = githubCollection.metadata;
    warnings.push(...githubCollection.warnings);
  } else if (options.requireGitHub) {
    throw new Error("GitHub metadata was required, but no repository was provided");
  }

  const snapshot = {
    root: filesystem.root,
    repositoryName: filesystem.repositoryName,
    files: filesystem.files,
    manifests: filesystem.manifests,
    workflows: workflowCollection.workflows,
    facts: filesystem.facts,
    collection: {
      ...filesystem.collection,
      parsedBytes: filesystem.collection.parsedBytes + workflowCollection.parsedBytes,
      warnings,
    },
    ...(github ? { github } : {}),
  };
  const checks = applyWaivers(evaluateRules(snapshot), loaded.config.ignore);
  const report = buildReport(snapshot, checks, {
    version: VERSION,
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
  });

  return {
    snapshot,
    report,
    config: loaded.config,
    ...(loaded.path ? { configPath: loaded.path } : {}),
  };
}
