function allJobs(snapshot) {
    return snapshot.workflows.flatMap((workflow) => workflow.jobs);
}
export const workflowPresent = (snapshot) => ({
    ruleId: "automation/workflow-present",
    domain: "automation",
    title: "Automation workflow",
    description: "At least one readable GitHub Actions workflow is present.",
    status: snapshot.workflows.length === 0
        ? "fail"
        : snapshot.workflows.some((workflow) => !workflow.parseError)
            ? "pass"
            : "unknown",
    severity: "medium",
    weight: 3,
    evidence: snapshot.workflows.length > 0
        ? snapshot.workflows.map((workflow) => ({
            kind: workflow.parseError ? "unknown" : "present",
            message: workflow.parseError ?? "Readable workflow",
            path: workflow.path,
        }))
        : [{ kind: "missing", message: "No workflow was found under .github/workflows" }],
    remediation: "Add a minimal validation workflow that runs on pull requests.",
});
export const pullRequestValidation = (snapshot) => {
    const pullRequestWorkflows = snapshot.workflows.filter((workflow) => workflow.triggers.includes("pull_request") && !workflow.parseError);
    const signals = new Set(pullRequestWorkflows.flatMap((workflow) => workflow.jobs.flatMap((job) => job.qualitySignals)));
    const hasTest = signals.has("test");
    const hasSecondGate = ["lint", "build", "typecheck", "security"].some((signal) => signals.has(signal));
    const status = pullRequestWorkflows.length === 0
        ? "fail"
        : hasTest && hasSecondGate
            ? "pass"
            : signals.size > 0
                ? "warn"
                : "fail";
    return {
        ruleId: "automation/pr-validation",
        domain: "automation",
        title: "Pull request validation",
        description: "Pull requests run tests plus at least one additional quality gate.",
        status,
        severity: "high",
        weight: 3,
        evidence: pullRequestWorkflows.length === 0
            ? [{ kind: "missing", message: "No readable workflow runs on pull_request" }]
            : [
                ...pullRequestWorkflows.map((workflow) => ({
                    kind: "present",
                    message: "Runs on pull_request",
                    path: workflow.path,
                })),
                {
                    kind: hasTest ? "present" : "missing",
                    message: hasTest ? "Test gate detected" : "No test gate detected",
                },
                {
                    kind: hasSecondGate ? "present" : "missing",
                    message: hasSecondGate
                        ? "Additional quality gate detected"
                        : "No additional quality gate detected",
                },
            ],
        remediation: "Run tests and lint, build, typecheck, or security checks for pull requests.",
    };
};
export const jobTimeout = (snapshot) => {
    const jobs = allJobs(snapshot);
    const bounded = jobs.filter((job) => job.timeoutMinutes !== undefined);
    return {
        ruleId: "automation/job-timeout",
        domain: "automation",
        title: "Job timeouts",
        description: "Workflow jobs have explicit timeout limits.",
        status: jobs.length === 0
            ? "not_applicable"
            : bounded.length === jobs.length
                ? "pass"
                : bounded.length > 0
                    ? "warn"
                    : "fail",
        severity: "low",
        weight: 1,
        evidence: jobs.length === 0
            ? []
            : [
                {
                    kind: bounded.length === jobs.length ? "present" : "missing",
                    message: `${bounded.length} of ${jobs.length} job(s) declare timeout-minutes`,
                },
            ],
        remediation: "Set timeout-minutes on every workflow job to bound stalled runs.",
    };
};
export const deploySafety = (snapshot) => {
    const deployments = snapshot.workflows.flatMap((workflow) => workflow.jobs
        .filter((job) => job.qualitySignals.includes("deploy"))
        .map((job) => ({ workflow, job })));
    const protectedDeployments = deployments.filter(({ workflow, job }) => workflow.concurrency && job.environment);
    return {
        ruleId: "automation/deploy-safety",
        domain: "automation",
        title: "Deployment safety",
        description: "Detected deployment jobs use an environment and workflow concurrency control.",
        status: deployments.length === 0
            ? "not_applicable"
            : protectedDeployments.length === deployments.length
                ? "pass"
                : protectedDeployments.length > 0
                    ? "warn"
                    : "fail",
        severity: "high",
        weight: 2,
        evidence: deployments.map(({ workflow, job }) => ({
            kind: workflow.concurrency && job.environment ? "present" : "missing",
            message: `${job.id}: ${job.environment ? "environment set" : "no environment"}; ${workflow.concurrency ? "concurrency set" : "no concurrency"}`,
            path: workflow.path,
        })),
        remediation: "Use a protected environment and concurrency group for every deployment workflow.",
    };
};
export const automationRules = [
    workflowPresent,
    pullRequestValidation,
    jobTimeout,
    deploySafety,
];
//# sourceMappingURL=automation.js.map