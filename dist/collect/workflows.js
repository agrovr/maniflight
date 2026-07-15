import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { parseDocument } from "yaml";
const UNTRUSTED_CONTEXT = /(?:^|\s)(?:github\.(?:head_ref|ref|ref_name)|github\.event\.[\w.-]*(?:body|default_branch|email|head_ref|label|message|name|page_name|ref|title))(?:\s|$|[|&=!<>])/iu;
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isWithinRoot(root, candidate) {
    const fromRoot = relative(root, candidate);
    return fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}
function parseTriggers(value) {
    if (typeof value === "string")
        return [value];
    if (Array.isArray(value))
        return value.filter((item) => typeof item === "string").sort();
    if (isRecord(value))
        return Object.keys(value).sort();
    return [];
}
function parsePermissions(value) {
    if (value === "read-all" || value === "write-all")
        return value;
    if (!isRecord(value))
        return undefined;
    const permissions = {};
    for (const [scope, level] of Object.entries(value)) {
        if (level === "read" || level === "write" || level === "none")
            permissions[scope] = level;
    }
    return permissions;
}
function parseActionReference(value) {
    if (value.startsWith("./")) {
        return { value, local: true, docker: false, pinnedToCommit: true };
    }
    if (value.startsWith("docker://")) {
        const at = value.lastIndexOf("@");
        const digest = at >= 0 ? value.slice(at + 1) : "";
        return {
            value,
            local: false,
            docker: true,
            pinnedToCommit: /^sha256:[0-9a-f]{64}$/iu.test(digest),
            ...(digest ? { ref: digest } : {}),
        };
    }
    const at = value.lastIndexOf("@");
    const repository = at >= 0 ? value.slice(0, at) : value;
    const ref = at >= 0 ? value.slice(at + 1) : undefined;
    return {
        value,
        repository,
        ...(ref ? { ref } : {}),
        local: false,
        docker: false,
        pinnedToCommit: Boolean(ref && /^[0-9a-f]{40}$/iu.test(ref)),
    };
}
function detectQualitySignals(script) {
    const lower = script.toLowerCase();
    const signals = new Set();
    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(pytest|go test|cargo test|dotnet test|mvn test|gradle test)\b/u.test(lower)) {
        signals.add("test");
    }
    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b|\b(eslint|biome check|ruff check|golangci-lint)\b/u.test(lower)) {
        signals.add("lint");
    }
    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\b(go build|cargo build|dotnet build|mvn package|gradle build)\b/u.test(lower)) {
        signals.add("build");
    }
    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(typecheck|type-check|check:types)\b|\btsc\s+--noemit\b/u.test(lower)) {
        signals.add("typecheck");
    }
    if (/\b(codeql|semgrep|trivy|gitleaks|npm audit|pnpm audit|yarn audit)\b/u.test(lower)) {
        signals.add("security");
    }
    if (/\b(deploy|kubectl\s+apply|helm\s+upgrade|terraform\s+apply|vercel\s+deploy)\b/u.test(lower)) {
        signals.add("deploy");
    }
    return [...signals].sort();
}
function collectUntrustedExpressions(script, path, job, step) {
    const output = [];
    const expressionPattern = /\$\{\{\s*([^}]+?)\s*\}\}/gu;
    for (const match of script.matchAll(expressionPattern)) {
        const expression = match[1]?.trim();
        if (expression && UNTRUSTED_CONTEXT.test(expression)) {
            output.push({ expression: expression.slice(0, 200), path, job, step });
        }
    }
    return output;
}
function parseEnvironment(value) {
    if (typeof value === "string")
        return value;
    if (isRecord(value) && typeof value.name === "string")
        return value.name;
    return undefined;
}
function parseJobs(value, workflowPath) {
    if (!isRecord(value))
        return [];
    const jobs = [];
    for (const [jobId, jobValue] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
        if (!isRecord(jobValue))
            continue;
        const actionReferences = [];
        const qualitySignals = new Set();
        const untrustedExpressions = [];
        const steps = Array.isArray(jobValue.steps) ? jobValue.steps : [];
        steps.forEach((stepValue, stepIndex) => {
            if (!isRecord(stepValue))
                return;
            if (typeof stepValue.uses === "string")
                actionReferences.push(parseActionReference(stepValue.uses));
            if (typeof stepValue.run === "string") {
                for (const signal of detectQualitySignals(stepValue.run))
                    qualitySignals.add(signal);
                untrustedExpressions.push(...collectUntrustedExpressions(stepValue.run, workflowPath, jobId, stepIndex + 1));
            }
        });
        const reusable = typeof jobValue.uses === "string" ? parseActionReference(jobValue.uses) : undefined;
        if (reusable)
            actionReferences.push(reusable);
        const permissions = parsePermissions(jobValue.permissions);
        const environment = parseEnvironment(jobValue.environment);
        const timeoutMinutes = typeof jobValue["timeout-minutes"] === "number" ? jobValue["timeout-minutes"] : undefined;
        jobs.push({
            id: jobId,
            ...(permissions ? { permissions } : {}),
            ...(timeoutMinutes !== undefined ? { timeoutMinutes } : {}),
            ...(environment ? { environment } : {}),
            actionReferences,
            qualitySignals: [...qualitySignals].sort(),
            untrustedExpressions,
        });
    }
    return jobs;
}
export async function collectWorkflows(root, files, config, alreadyParsedBytes = 0) {
    const canonicalRoot = await realpath(root);
    const workflowFiles = files.filter((file) => file.category === "workflow");
    const workflows = [];
    const warnings = [];
    let parsedBytes = 0;
    for (const file of workflowFiles) {
        if (file.size > config.limits.maxFileBytes) {
            workflows.push({
                path: file.path,
                triggers: [],
                concurrency: false,
                jobs: [],
                parseError: "Workflow exceeds the file safety limit",
            });
            continue;
        }
        if (alreadyParsedBytes + parsedBytes + file.size > config.limits.maxParsedBytes) {
            workflows.push({
                path: file.path,
                triggers: [],
                concurrency: false,
                jobs: [],
                parseError: "Parsed data safety limit reached",
            });
            continue;
        }
        const candidate = resolve(canonicalRoot, file.path);
        const canonicalPath = await realpath(candidate);
        if (!isWithinRoot(canonicalRoot, canonicalPath)) {
            warnings.push(`Skipped workflow outside repository boundary: ${file.path}`);
            continue;
        }
        const metadata = await lstat(canonicalPath);
        if (!metadata.isFile() || metadata.isSymbolicLink()) {
            warnings.push(`Skipped non-regular workflow file: ${file.path}`);
            continue;
        }
        const source = await readFile(canonicalPath, "utf8");
        parsedBytes += Buffer.byteLength(source);
        const document = parseDocument(source, { prettyErrors: false, uniqueKeys: true });
        if (document.errors.length > 0) {
            workflows.push({
                path: file.path,
                triggers: [],
                concurrency: false,
                jobs: [],
                parseError: "Workflow is not valid YAML",
            });
            continue;
        }
        let parsed;
        try {
            parsed = document.toJS({ maxAliasCount: 20 });
        }
        catch {
            workflows.push({
                path: file.path,
                triggers: [],
                concurrency: false,
                jobs: [],
                parseError: "Workflow aliases exceed the safety limit",
            });
            continue;
        }
        if (!isRecord(parsed)) {
            workflows.push({
                path: file.path,
                triggers: [],
                concurrency: false,
                jobs: [],
                parseError: "Workflow root must be a mapping",
            });
            continue;
        }
        const permissions = parsePermissions(parsed.permissions);
        workflows.push({
            path: file.path,
            ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
            triggers: parseTriggers(parsed.on),
            ...(permissions ? { permissions } : {}),
            concurrency: parsed.concurrency !== undefined,
            jobs: parseJobs(parsed.jobs, file.path),
        });
    }
    return { workflows, parsedBytes, warnings };
}
//# sourceMappingURL=workflows.js.map