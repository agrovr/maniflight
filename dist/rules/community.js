function localDocumentation(snapshot, names) {
    const lowered = names.map((name) => name.toLowerCase());
    return snapshot.facts.documentationPaths.find((path) => lowered.some((name) => path.toLowerCase().endsWith(name)));
}
function communityFile(snapshot, names) {
    return (localDocumentation(snapshot, names) ??
        snapshot.github?.communityFiles.find((path) => {
            const lower = path.toLowerCase();
            return names.some((name) => lower.endsWith(name.toLowerCase()));
        }));
}
function fileRule(snapshot, options) {
    const path = communityFile(snapshot, options.names);
    return {
        ruleId: options.id,
        domain: "community",
        title: options.title,
        description: options.description,
        status: path ? "pass" : "fail",
        severity: options.severity,
        weight: options.weight,
        evidence: path
            ? [{ kind: "present", message: `${options.title} detected`, path }]
            : [{ kind: "missing", message: `${options.title} was not detected` }],
        remediation: options.remediation,
    };
}
export const readme = (snapshot) => fileRule(snapshot, {
    id: "community/readme",
    title: "README",
    description: "The repository explains its purpose and basic use.",
    names: ["readme.md", "readme"],
    severity: "medium",
    weight: 3,
    remediation: "Add a concise README with purpose, setup, use, and support information.",
});
export const license = (snapshot) => fileRule(snapshot, {
    id: "community/license",
    title: "License",
    description: "The repository declares how others may use and contribute to the project.",
    names: ["license", "license.md", "license.txt"],
    severity: "high",
    weight: 3,
    remediation: "Add an OSI-approved license file appropriate for the project.",
});
export const contributing = (snapshot) => fileRule(snapshot, {
    id: "community/contributing",
    title: "Contribution guide",
    description: "Contributors have a documented development and review path.",
    names: ["contributing.md", "contributing"],
    severity: "low",
    weight: 2,
    remediation: "Add CONTRIBUTING.md with setup, test, and pull request expectations.",
});
export const codeOfConduct = (snapshot) => fileRule(snapshot, {
    id: "community/code-of-conduct",
    title: "Code of conduct",
    description: "The repository defines expected community behavior.",
    names: ["code_of_conduct.md", "code-of-conduct.md"],
    severity: "low",
    weight: 1,
    remediation: "Add a recognized code of conduct and enforcement contact.",
});
export const issueTemplate = (snapshot) => ({
    ruleId: "community/issue-template",
    domain: "community",
    title: "Issue template",
    description: "Issue forms or templates collect useful problem context.",
    status: snapshot.facts.issueTemplatePaths.length > 0 ? "pass" : "fail",
    severity: "low",
    weight: 1,
    evidence: snapshot.facts.issueTemplatePaths.length > 0
        ? snapshot.facts.issueTemplatePaths.map((path) => ({
            kind: "present",
            message: "Issue template",
            path,
        }))
        : [{ kind: "missing", message: "No issue template was detected" }],
    remediation: "Add focused issue forms under .github/ISSUE_TEMPLATE/.",
});
export const pullRequestTemplate = (snapshot) => ({
    ruleId: "community/pull-request-template",
    domain: "community",
    title: "Pull request template",
    description: "Pull requests prompt contributors for validation and context.",
    status: snapshot.facts.pullRequestTemplatePaths.length > 0 ? "pass" : "fail",
    severity: "low",
    weight: 1,
    evidence: snapshot.facts.pullRequestTemplatePaths.length > 0
        ? snapshot.facts.pullRequestTemplatePaths.map((path) => ({
            kind: "present",
            message: "Pull request template",
            path,
        }))
        : [{ kind: "missing", message: "No pull request template was detected" }],
    remediation: "Add a pull request template with summary, validation, and risk prompts.",
});
export const supportChannel = (snapshot) => {
    const path = communityFile(snapshot, ["support.md"]);
    return {
        ruleId: "community/support-channel",
        domain: "community",
        title: "Support channel",
        description: "Users can find an appropriate public or private support route.",
        status: path ? "pass" : "fail",
        severity: "medium",
        weight: 1,
        evidence: path
            ? [{ kind: "present", message: "Support route detected", path }]
            : [{ kind: "missing", message: "No SUPPORT.md route was detected" }],
        remediation: "Add SUPPORT.md and direct sensitive reports to a private channel.",
    };
};
export const repositoryMetadata = (snapshot) => {
    if (!snapshot.github) {
        return {
            ruleId: "community/repository-metadata",
            domain: "community",
            title: "Repository metadata",
            description: "The GitHub repository has a description and useful topics.",
            status: "unknown",
            severity: "low",
            weight: 1,
            evidence: [{ kind: "unknown", message: "GitHub metadata was not available" }],
            remediation: "Set a concise repository description and relevant topics on GitHub.",
        };
    }
    const description = Boolean(snapshot.github.description);
    const topics = snapshot.github.topics.length > 0;
    return {
        ruleId: "community/repository-metadata",
        domain: "community",
        title: "Repository metadata",
        description: "The GitHub repository has a description and useful topics.",
        status: description && topics ? "pass" : description || topics ? "warn" : "fail",
        severity: "low",
        weight: 1,
        evidence: [
            {
                kind: description ? "present" : "missing",
                message: description ? "Description is set" : "Description is missing",
            },
            {
                kind: topics ? "present" : "missing",
                message: topics ? `${snapshot.github.topics.length} topic(s) set` : "Topics are missing",
            },
        ],
        remediation: "Set a concise repository description and relevant discovery topics on GitHub.",
    };
};
export const communityRules = [
    readme,
    license,
    contributing,
    codeOfConduct,
    issueTemplate,
    pullRequestTemplate,
    supportChannel,
    repositoryMetadata,
];
//# sourceMappingURL=community.js.map