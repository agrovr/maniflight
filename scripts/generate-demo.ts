import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeReportArtifacts } from "../src/output.js";
import { runManiflight } from "../src/run.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = await runManiflight({ root });
const report = {
  ...result.report,
  repository: { ...result.report.repository, name: "Maniflight" },
};
const artifacts = await writeReportArtifacts(report, resolve(root, "demo"), root);

process.stdout.write(`Generated Maniflight demo at ${artifacts.html}\n`);
