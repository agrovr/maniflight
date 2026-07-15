import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeReportArtifacts } from "../src/output.js";
import { runManiflight } from "../src/run.js";

const HEALTHY = resolve(import.meta.dirname, "fixtures", "healthy");
const temporaryDirectories: string[] = [];

async function temporaryDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `maniflight-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function sampleReport() {
  return (await runManiflight({ root: HEALTHY })).report;
}

describe("report artifact boundaries", () => {
  it("writes all artifacts inside an allowed root", async () => {
    const root = await temporaryDirectory("output");
    const artifacts = await writeReportArtifacts(await sampleReport(), join(root, "reports"), root);

    await expect(readFile(artifacts.html, "utf8")).resolves.toContain("<!doctype html>");
    await expect(readFile(artifacts.json, "utf8")).resolves.toContain('"schemaVersion"');
    await expect(readFile(artifacts.svg, "utf8")).resolves.toMatch(/^<svg /);
  });

  it("rejects a pre-existing artifact symlink without modifying its target", async () => {
    const root = await temporaryDirectory("leaf-link");
    const output = join(root, "reports");
    const artifacts = await writeReportArtifacts(await sampleReport(), output, root);
    const outside = join(root, "outside.txt");
    await writeFile(outside, "unchanged", "utf8");
    await rm(artifacts.html);
    await symlink(outside, artifacts.html, "file");

    await expect(writeReportArtifacts(await sampleReport(), output, root)).rejects.toThrow(
      "cannot be a symbolic link",
    );
    await expect(readFile(outside, "utf8")).resolves.toBe("unchanged");
  });

  it("rejects a symbolic-link ancestor inside an allowed root", async () => {
    const root = await temporaryDirectory("ancestor-link");
    const outside = await temporaryDirectory("outside");
    const link = join(root, "redirect");
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");

    await expect(
      writeReportArtifacts(await sampleReport(), join(link, "reports"), root),
    ).rejects.toThrow("symbolic-link ancestors");
  });
});
