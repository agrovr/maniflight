import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import * as core from "@actions/core";
import { evaluateGates } from "./gates.js";
import { loadBaselineReport, writeReportArtifacts } from "./output.js";
import { compareReports } from "./report/compare.js";
import { runManiflight } from "./run.js";
function optionalInput(name) {
    const value = core.getInput(name).trim();
    return value.length > 0 ? value : undefined;
}
function optionalScore(name) {
    const value = optionalInput(name);
    if (value === undefined)
        return undefined;
    const score = Number(value);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
        throw new Error(`${name} must be an integer from 0 to 100`);
    }
    return score;
}
function resolveInsideWorkspace(workspace, input, label) {
    const candidate = resolve(workspace, input);
    const fromWorkspace = relative(workspace, candidate);
    if (fromWorkspace.startsWith("..") || isAbsolute(fromWorkspace)) {
        throw new Error(`${label} must remain inside the GitHub workspace`);
    }
    return candidate;
}
function isWithin(base, candidate) {
    const fromBase = relative(base, candidate);
    return fromBase === "" || (!fromBase.startsWith("..") && !isAbsolute(fromBase));
}
export async function runAction() {
    try {
        const workspace = resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
        const root = resolveInsideWorkspace(workspace, core.getInput("path") || ".", "path");
        const outputDirectory = resolveInsideWorkspace(workspace, core.getInput("output-dir") || "maniflight-report", "output-dir");
        const canonicalWorkspace = await realpath(workspace);
        const canonicalRoot = await realpath(root);
        if (!isWithin(canonicalWorkspace, canonicalRoot)) {
            throw new Error("path cannot resolve outside the GitHub workspace");
        }
        const token = optionalInput("github-token");
        const repository = optionalInput("repository") ?? process.env.GITHUB_REPOSITORY;
        const baselineInput = optionalInput("baseline-report");
        const baselinePath = baselineInput
            ? resolveInsideWorkspace(workspace, baselineInput, "baseline-report")
            : undefined;
        const failOnRegressionInput = optionalInput("fail-on-regression");
        const failOnRegression = failOnRegressionInput === undefined ? false : core.getBooleanInput("fail-on-regression");
        if (failOnRegression && !baselinePath) {
            throw new Error("fail-on-regression requires baseline-report");
        }
        if (token)
            core.setSecret(token);
        const result = await runManiflight({
            root,
            configPath: core.getInput("config") || ".maniflight.yml",
            generatedAt: new Date().toISOString(),
            ...(repository ? { repository } : {}),
            ...(token ? { token } : {}),
        });
        const baseline = baselinePath ? await loadBaselineReport(baselinePath, workspace) : undefined;
        const comparison = baseline ? compareReports(result.report, baseline) : undefined;
        const artifacts = await writeReportArtifacts(result.report, outputDirectory, workspace, comparison);
        const failUnder = optionalScore("fail-under") ?? result.config.thresholds.failUnder;
        const failOnHighInput = optionalInput("fail-on-high");
        const failOnHigh = failOnHighInput === undefined
            ? result.config.thresholds.failOnHigh
            : core.getBooleanInput("fail-on-high");
        core.setOutput("overall-score", result.report.overall.score ?? "");
        core.setOutput("confidence", result.report.overall.confidence);
        core.setOutput("high-findings", result.report.summary.highFindings);
        core.setOutput("report-path", artifacts.html);
        core.setOutput("json-path", artifacts.json);
        core.setOutput("regressions", comparison?.summary.regressions ?? "");
        core.setOutput("comparison-path", artifacts.comparison ?? "");
        const summary = core.summary
            .addHeading("Maniflight repository diagnostics", 2)
            .addRaw(`**${result.report.overall.label.replaceAll("-", " ")}** · ` +
            `${result.report.overall.score ?? "not scored"}/100 · ` +
            `${result.report.overall.confidence}% confidence\n\n`)
            .addTable([
            [
                { data: "Passed", header: true },
                { data: "Warnings", header: true },
                { data: "Failed", header: true },
                { data: "Unknown", header: true },
            ],
            [
                String(result.report.summary.pass),
                String(result.report.summary.warn),
                String(result.report.summary.fail),
                String(result.report.summary.unknown),
            ],
        ]);
        if (comparison) {
            summary.addHeading("Changes from baseline", 3).addTable([
                [
                    { data: "Regressions", header: true },
                    { data: "Improvements", header: true },
                    { data: "Evidence changes", header: true },
                    { data: "Catalog changes", header: true },
                ],
                [
                    String(comparison.summary.regressions),
                    String(comparison.summary.improvements),
                    String(comparison.summary.evidenceChanges),
                    String(comparison.summary.added + comparison.summary.removed),
                ],
            ]);
        }
        await summary.addRaw(`\nReport files were written to \`${artifacts.directory}\`.\n`).write();
        const failures = evaluateGates(result.report, {
            failUnder,
            failOnHigh,
            failOnRegression,
            ...(comparison ? { regressionCount: comparison.summary.regressions } : {}),
        });
        if (failures.length > 0)
            core.setFailed(failures.join("; "));
    }
    catch (error) {
        core.setFailed(error instanceof Error ? error.message : "Unknown Maniflight error");
    }
}
void runAction();
//# sourceMappingURL=action.js.map