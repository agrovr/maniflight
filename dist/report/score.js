import { DOMAINS, } from "../model.js";
export const DOMAIN_WEIGHTS = {
    architecture: 25,
    automation: 25,
    security: 30,
    community: 20,
};
function round(value) {
    return Math.round(value * 10) / 10;
}
function earnedFactor(check) {
    if (check.status === "pass")
        return 1;
    if (check.status === "warn")
        return 0.5;
    return 0;
}
export function scoreDomain(domain, checks) {
    const domainChecks = checks.filter((check) => check.domain === domain);
    const possibleChecks = domainChecks.filter((check) => check.status !== "not_applicable");
    const evaluatedChecks = possibleChecks.filter((check) => check.status !== "unknown");
    const possibleWeight = possibleChecks.reduce((total, check) => total + check.weight, 0);
    const evaluatedWeight = evaluatedChecks.reduce((total, check) => total + check.weight, 0);
    const earnedWeight = evaluatedChecks.reduce((total, check) => total + check.weight * earnedFactor(check), 0);
    return {
        domain,
        score: evaluatedWeight === 0 ? null : round((earnedWeight / evaluatedWeight) * 100),
        confidence: possibleWeight === 0 ? 0 : round((evaluatedWeight / possibleWeight) * 100),
        earnedWeight: round(earnedWeight),
        evaluatedWeight,
        possibleWeight,
        checks: domainChecks,
    };
}
export function scoreOverall(domains) {
    const scoredDomains = DOMAINS.filter((domain) => domains[domain].score !== null);
    const confidenceDomains = DOMAINS.filter((domain) => domains[domain].possibleWeight > 0);
    const scoredWeight = scoredDomains.reduce((total, domain) => total + DOMAIN_WEIGHTS[domain], 0);
    const confidenceWeight = confidenceDomains.reduce((total, domain) => total + DOMAIN_WEIGHTS[domain], 0);
    const score = scoredWeight === 0
        ? null
        : round(scoredDomains.reduce((total, domain) => total + (domains[domain].score ?? 0) * DOMAIN_WEIGHTS[domain], 0) / scoredWeight);
    const confidence = confidenceWeight === 0
        ? 0
        : round(confidenceDomains.reduce((total, domain) => total + domains[domain].confidence * DOMAIN_WEIGHTS[domain], 0) / confidenceWeight);
    return {
        score,
        confidence,
        label: score === null || confidence < 25
            ? "insufficient-data"
            : score >= 85
                ? "ready"
                : score >= 70
                    ? "stable"
                    : "developing",
    };
}
export function buildReport(snapshot, checks, options) {
    const domains = Object.fromEntries(DOMAINS.map((domain) => [domain, scoreDomain(domain, checks)]));
    const summary = {
        pass: checks.filter((check) => check.status === "pass").length,
        warn: checks.filter((check) => check.status === "warn").length,
        fail: checks.filter((check) => check.status === "fail").length,
        unknown: checks.filter((check) => check.status === "unknown").length,
        notApplicable: checks.filter((check) => check.status === "not_applicable").length,
        highFindings: checks.filter((check) => !check.waiver &&
            check.severity === "high" &&
            (check.status === "fail" || check.status === "warn")).length,
    };
    return {
        schemaVersion: "1.0",
        tool: { name: "Maniflight", version: options.version },
        repository: {
            name: snapshot.github?.name ?? snapshot.repositoryName,
            ...(snapshot.github?.owner ? { owner: snapshot.github.owner } : {}),
            ...(snapshot.github?.url ? { url: snapshot.github.url } : {}),
            ...(snapshot.github?.description ? { description: snapshot.github.description } : {}),
            ...(snapshot.github?.defaultBranch ? { defaultBranch: snapshot.github.defaultBranch } : {}),
            ...(snapshot.github?.visibility ? { visibility: snapshot.github.visibility } : {}),
            topics: snapshot.github?.topics ?? [],
            languages: snapshot.github?.languages ?? {},
        },
        ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
        domains,
        overall: scoreOverall(domains),
        summary,
    };
}
//# sourceMappingURL=score.js.map