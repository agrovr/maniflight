import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/version.js";

describe("version metadata", () => {
  it("keeps runtime and package versions aligned", async () => {
    const packageMetadata = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: string };

    expect(VERSION).toBe(packageMetadata.version);
  });
});
