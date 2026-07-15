import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBaselineReport, writeReportArtifacts } from "../src/output.js";
import { compareReports } from "../src/report/compare.js";
import { runManiflight } from "../src/run.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const demoDirectory = resolve(root, "demo");
const baseline = await loadBaselineReport(resolve(demoDirectory, "baseline-report.json"), root);
const result = await runManiflight({ root });
const report = {
  ...result.report,
  repository: { ...result.report.repository, name: "Maniflight" },
};
const comparison = compareReports(report, baseline);
const artifacts = await writeReportArtifacts(report, demoDirectory, root, comparison);

process.stdout.write(`Generated Maniflight demo at ${artifacts.html}\n`);
