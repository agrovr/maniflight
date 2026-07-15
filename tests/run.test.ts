import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runManiflight } from "../src/run.js";

const HEALTHY = resolve(import.meta.dirname, "fixtures", "healthy");

describe("runManiflight", () => {
  it("returns the loaded config, deterministic report, and 0-100 metrics", async () => {
    const options = { root: HEALTHY, generatedAt: "2026-07-14T00:00:00.000Z" } as const;
    const first = await runManiflight(options);
    const second = await runManiflight(options);

    expect(first).toEqual(second);
    expect(first.config.version).toBe(1);
    expect(first.configPath).toBeUndefined();
    expect(first.report.generatedAt).toBe(options.generatedAt);
    expect(first.report.overall.score).toBeGreaterThanOrEqual(0);
    expect(first.report.overall.score).toBeLessThanOrEqual(100);
    expect(first.report.overall.confidence).toBeGreaterThanOrEqual(0);
    expect(first.report.overall.confidence).toBeLessThanOrEqual(100);
  });

  it("requires an explicit repository when GitHub metadata is mandatory", async () => {
    await expect(runManiflight({ root: HEALTHY, requireGitHub: true })).rejects.toThrow(
      "no repository",
    );
  });
});
