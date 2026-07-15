import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import * as core from "@actions/core";
import { evaluateGates } from "./gates.js";
import { writeReportArtifacts } from "./output.js";
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
        if (token)
            core.setSecret(token);
        const result = await runManiflight({
            root,
            configPath: core.getInput("config") || ".maniflight.yml",
            generatedAt: new Date().toISOString(),
            ...(repository ? { repository } : {}),
            ...(token ? { token } : {}),
        });
        const artifacts = await writeReportArtifacts(result.report, outputDirectory, workspace);
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
        await core.summary
            .addHeading("Maniflight repository preflight", 2)
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
        ])
            .addRaw(`\nReport files were written to \`${artifacts.directory}\`.\n`)
            .write();
        const failures = evaluateGates(result.report, { failUnder, failOnHigh });
        if (failures.length > 0)
            core.setFailed(failures.join("; "));
    }
    catch (error) {
        core.setFailed(error instanceof Error ? error.message : "Unknown Maniflight error");
    }
}
void runAction();
//# sourceMappingURL=action.js.map