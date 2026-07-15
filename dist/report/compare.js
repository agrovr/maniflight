import { DOMAINS } from "../model.js";
export const COMPARISON_SCHEMA_VERSION = "1.0";
function reportChecks(report) {
    return DOMAINS.flatMap((domain) => report.domains[domain].checks);
}
function indexChecks(report, side) {
    const checksByRuleId = new Map();
    for (const check of reportChecks(report)) {
        if (checksByRuleId.has(check.ruleId)) {
            throw new Error(`Duplicate rule ID "${check.ruleId}" in ${side} report.`);
        }
        checksByRuleId.set(check.ruleId, check);
    }
    return checksByRuleId;
}
function ruleState(check) {
    return {
        domain: check.domain,
        title: check.title,
        status: check.status,
        severity: check.severity,
    };
}
function classifyMatchedRule(currentStatus, baselineStatus) {
    if (currentStatus === baselineStatus)
        return "unchanged";
    if (currentStatus === "unknown" ||
        currentStatus === "not_applicable" ||
        baselineStatus === "unknown" ||
        baselineStatus === "not_applicable") {
        return "evidence_change";
    }
    const readiness = {
        fail: 0,
        warn: 1,
        pass: 2,
    };
    return readiness[currentStatus] < readiness[baselineStatus] ? "regression" : "improvement";
}
function roundDelta(value) {
    const rounded = Math.round(value * 10) / 10;
    if (!Number.isFinite(rounded)) {
        throw new Error("Comparison metric delta must be finite.");
    }
    return Object.is(rounded, -0) ? 0 : rounded;
}
function assertPercentage(value, label) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
        throw new Error(`${label} must be a finite number from 0 to 100 or null.`);
    }
}
function metricDelta(current, baseline) {
    return {
        baseline,
        current,
        delta: roundDelta(current - baseline),
    };
}
function nullableMetricDelta(current, baseline) {
    return {
        baseline,
        current,
        delta: current === null || baseline === null ? null : roundDelta(current - baseline),
    };
}
function comparisonSubject(report) {
    return {
        repository: {
            name: report.repository.name,
            ...(report.repository.owner ? { owner: report.repository.owner } : {}),
            ...(report.repository.url ? { url: report.repository.url } : {}),
        },
        reportSchemaVersion: report.schemaVersion,
        toolVersion: report.tool.version,
        ...(report.generatedAt ? { generatedAt: report.generatedAt } : {}),
        score: report.overall.score,
        confidence: report.overall.confidence,
    };
}
export function compareReports(current, baseline) {
    assertPercentage(current.overall.score, "Current score");
    assertPercentage(current.overall.confidence, "Current confidence");
    assertPercentage(baseline.overall.score, "Baseline score");
    assertPercentage(baseline.overall.confidence, "Baseline confidence");
    const currentChecks = indexChecks(current, "current");
    const baselineChecks = indexChecks(baseline, "baseline");
    const ruleIds = [...new Set([...currentChecks.keys(), ...baselineChecks.keys()])].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const regressions = [];
    const improvements = [];
    const evidenceChanges = [];
    const added = [];
    const removed = [];
    const unchanged = [];
    for (const ruleId of ruleIds) {
        const currentCheck = currentChecks.get(ruleId);
        const baselineCheck = baselineChecks.get(ruleId);
        if (!baselineCheck && currentCheck) {
            added.push({ ruleId, kind: "added", current: ruleState(currentCheck) });
            continue;
        }
        if (baselineCheck && !currentCheck) {
            removed.push({ ruleId, kind: "removed", baseline: ruleState(baselineCheck) });
            continue;
        }
        if (!baselineCheck || !currentCheck) {
            continue;
        }
        const kind = classifyMatchedRule(currentCheck.status, baselineCheck.status);
        const change = {
            ruleId,
            baseline: ruleState(baselineCheck),
            current: ruleState(currentCheck),
        };
        if (kind === "regression")
            regressions.push({ ...change, kind });
        if (kind === "improvement")
            improvements.push({ ...change, kind });
        if (kind === "evidence_change")
            evidenceChanges.push({ ...change, kind });
        if (kind === "unchanged")
            unchanged.push({ ...change, kind });
    }
    return {
        schemaVersion: COMPARISON_SCHEMA_VERSION,
        baseline: comparisonSubject(baseline),
        current: comparisonSubject(current),
        metrics: {
            score: nullableMetricDelta(current.overall.score, baseline.overall.score),
            confidence: metricDelta(current.overall.confidence, baseline.overall.confidence),
        },
        summary: {
            regressions: regressions.length,
            improvements: improvements.length,
            evidenceChanges: evidenceChanges.length,
            added: added.length,
            removed: removed.length,
            unchanged: unchanged.length,
        },
        regressions,
        improvements,
        evidenceChanges,
        added,
        removed,
        unchanged,
    };
}
//# sourceMappingURL=compare.js.map