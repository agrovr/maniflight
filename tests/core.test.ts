import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectFilesystem } from "../src/collect/filesystem.js";
import { collectWorkflows } from "../src/collect/workflows.js";
import { maniflightConfigSchema } from "../src/config.js";
import type { RepositorySnapshot } from "../src/model.js";
import { evaluateRules } from "../src/rules/index.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

async function fixtureSnapshot(name: string): Promise<RepositorySnapshot> {
  const config = maniflightConfigSchema.parse({});
  const filesystem = await collectFilesystem(resolve(FIXTURES, name), config);
  const workflows = await collectWorkflows(filesystem.root, filesystem.files, config);
  return {
    root: filesystem.root,
    repositoryName: filesystem.repositoryName,
    files: filesystem.files,
    manifests: filesystem.manifests,
    workflows: workflows.workflows,
    facts: filesystem.facts,
    collection: {
      ...filesystem.collection,
      parsedBytes: filesystem.collection.parsedBytes + workflows.parsedBytes,
      warnings: [...filesystem.collection.warnings, ...workflows.warnings],
    },
  };
}

function result(snapshot: RepositorySnapshot, ruleId: string) {
  const check = evaluateRules(snapshot).find((candidate) => candidate.ruleId === ruleId);
  if (!check) throw new Error(`Missing rule ${ruleId}`);
  return check;
}

describe("core repository collection and rules", () => {
  it("collects deterministic facts from a healthy TypeScript repository", async () => {
    const first = await fixtureSnapshot("healthy");
    const second = await fixtureSnapshot("healthy");

    expect(first).toEqual(second);
    expect(first.files.map((file) => file.path)).toEqual(
      [...first.files.map((file) => file.path)].sort((left, right) => left.localeCompare(right)),
    );
    expect(first.facts.typescript).toEqual({
      used: true,
      configPath: "tsconfig.json",
      strict: true,
    });
    expect(first.manifests[0]?.entrypoints).toEqual([
      { name: "exports", target: "./src/index.ts", exists: true },
    ]);
    expect(first.workflows[0]?.jobs[0]?.qualitySignals).toEqual(["lint", "test"]);
  });

  it("passes the core architecture and pull request validation signals", async () => {
    const snapshot = await fixtureSnapshot("healthy");

    expect(result(snapshot, "architecture/manifest-present").status).toBe("pass");
    expect(result(snapshot, "architecture/test-capability").status).toBe("pass");
    expect(result(snapshot, "architecture/typescript-strict").status).toBe("pass");
    expect(result(snapshot, "architecture/package-entrypoints").status).toBe("pass");
    expect(result(snapshot, "automation/pr-validation").status).toBe("pass");
    expect(result(snapshot, "security/action-reference-pinned").status).toBe("pass");
  });

  it("flags privileged checkout, shell interpolation, mutable Actions, and sensitive paths", async () => {
    const snapshot = await fixtureSnapshot("hostile");

    expect(result(snapshot, "security/workflow-permissions").status).toBe("fail");
    expect(result(snapshot, "security/action-reference-pinned").status).toBe("fail");
    expect(result(snapshot, "security/pull-request-target-checkout").status).toBe("fail");
    expect(result(snapshot, "security/untrusted-context-in-run").status).toBe("fail");
    expect(result(snapshot, "security/sensitive-filename").status).toBe("fail");
    expect(
      result(snapshot, "security/untrusted-context-in-run").evidence[0]?.message,
    ).not.toContain("not-a-secret");
  });
});
