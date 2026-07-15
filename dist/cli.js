#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command, InvalidArgumentError } from "commander";
import { evaluateGates } from "./gates.js";
import { loadBaselineReport, writeReportArtifacts } from "./output.js";
import { compareReports } from "./report/compare.js";
import { runManiflight } from "./run.js";
import { VERSION } from "./version.js";
function scoreValue(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        throw new InvalidArgumentError("Score must be an integer from 0 to 100");
    }
    return parsed;
}
function displayScore(score) {
    return score === null ? "not scored" : `${score}/100`;
}
export async function runCli(arguments_ = process.argv) {
    const program = new Command();
    program.name("maniflight").description("Evidence-backed repository preflight").version(VERSION);
    program
        .command("scan")
        .description("Inspect a repository without executing its code")
        .argument("[path]", "repository path", ".")
        .option("-o, --output <directory>", "report output directory", "maniflight-report")
        .option("-r, --repository <owner/name>", "repository used for optional GitHub metadata")
        .option("-c, --config <path>", "configuration path inside the repository", ".maniflight.yml")
        .option("--offline", "skip GitHub API enrichment", false)
        .option("--baseline-report <path>", "compare against a previous Maniflight report.json")
        .option("--fail-under <score>", "fail below this readiness score", scoreValue)
        .option("--fail-on-high", "fail when an unwaived high-severity finding is present")
        .option("--fail-on-regression", "fail when the scan regresses from the baseline report")
        .action(async (path, options) => {
        if (options.failOnRegression && !options.baselineReport) {
            throw new Error("--fail-on-regression requires --baseline-report");
        }
        const root = resolve(path);
        const repository = options.repository ?? process.env.GITHUB_REPOSITORY;
        const token = process.env.GITHUB_TOKEN;
        const result = await runManiflight({
            root,
            configPath: options.config,
            generatedAt: new Date().toISOString(),
            ...(!options.offline && repository ? { repository } : {}),
            ...(!options.offline && token ? { token } : {}),
        });
        const baseline = options.baselineReport
            ? await loadBaselineReport(resolve(options.baselineReport))
            : undefined;
        const comparison = baseline ? compareReports(result.report, baseline) : undefined;
        const artifacts = await writeReportArtifacts(result.report, resolve(options.output), undefined, comparison);
        const failures = evaluateGates(result.report, {
            failUnder: options.failUnder ?? result.config.thresholds.failUnder,
            failOnHigh: options.failOnHigh ?? result.config.thresholds.failOnHigh,
            failOnRegression: options.failOnRegression ?? false,
            ...(comparison ? { regressionCount: comparison.summary.regressions } : {}),
        });
        const comparisonLines = comparison
            ? [
                `${comparison.summary.regressions} regressions, ${comparison.summary.improvements} improvements from baseline`,
                `Comparison: ${artifacts.comparison}`,
            ]
            : [];
        process.stdout.write(`${[
            `Maniflight ${displayScore(result.report.overall.score)} (${result.report.overall.confidence}% confidence)`,
            `${result.report.summary.fail} failed, ${result.report.summary.warn} warning, ${result.report.summary.unknown} unknown`,
            ...comparisonLines,
            `Report: ${artifacts.html}`,
        ].join("\n")}\n`);
        if (failures.length > 0) {
            process.stderr.write(`${failures.join("\n")}\n`);
            process.exitCode = 1;
        }
    });
    await program.parseAsync(arguments_);
}
const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
    runCli().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown Maniflight error";
        process.stderr.write(`Maniflight failed: ${message}\n`);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=cli.js.map