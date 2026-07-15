import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function temporaryRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "maniflight-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("configuration", () => {
  it("loads bounded defaults when no configuration exists", async () => {
    const root = await temporaryRepository();
    const loaded = await loadConfig(root);

    expect(loaded.path).toBeUndefined();
    expect(loaded.config).toMatchObject({
      version: 1,
      exclude: [],
      github: { enabled: true },
      thresholds: { failUnder: null, failOnHigh: false },
      ignore: [],
    });
  });

  it("parses a documented waiver without exposing arbitrary YAML behavior", async () => {
    const root = await temporaryRepository();
    await writeFile(
      join(root, ".maniflight.yml"),
      [
        "version: 1",
        "ignore:",
        "  - rule: security/sensitive-filename",
        "    paths: [.env]",
        '    reason: "Fixture intentionally contains a placeholder."',
      ].join("\n"),
      "utf8",
    );

    const loaded = await loadConfig(root);
    expect(loaded.path).toBe(".maniflight.yml");
    expect(loaded.config.ignore[0]).toEqual({
      rule: "security/sensitive-filename",
      paths: [".env"],
      reason: "Fixture intentionally contains a placeholder.",
    });
  });

  it("rejects a configuration path outside the repository", async () => {
    const root = await temporaryRepository();
    await expect(loadConfig(root, "../outside.yml")).rejects.toThrow("inside the repository");
  });
});
