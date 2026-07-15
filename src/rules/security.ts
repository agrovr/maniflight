import type {
  CheckResult,
  PermissionLevel,
  RepositorySnapshot,
  Rule,
  WorkflowPermissions,
} from "../model.js";

const SECURE_USE = "https://docs.github.com/en/actions/reference/security/secure-use";

function documentation(snapshot: RepositorySnapshot, name: string): string | undefined {
  return snapshot.facts.documentationPaths.find((path) => path.toLowerCase().endsWith(name));
}

function permissionRisk(
  permissions: WorkflowPermissions | undefined,
): "explicit" | "missing" | "write-all" {
  if (permissions === undefined) return "missing";
  if (permissions === "write-all") return "write-all";
  return "explicit";
}

function hasWriteAllObject(permissions: WorkflowPermissions | undefined): boolean {
  if (!permissions || typeof permissions === "string") return false;
  const values = Object.values(permissions) as PermissionLevel[];
  return values.length > 5 && values.every((value) => value === "write");
}

export const securityPolicy: Rule = (snapshot) => {
  const path = documentation(snapshot, "security.md");
  return {
    ruleId: "security/policy-present",
    domain: "security",
    title: "Security policy",
    description: "The repository publishes a responsible vulnerability reporting route.",
    status: path ? "pass" : "fail",
    severity: "medium",
    weight: 2,
    evidence: path
      ? [{ kind: "present", message: "Security policy detected", path }]
      : [{ kind: "missing", message: "SECURITY.md was not detected" }],
    remediation: "Add SECURITY.md with supported versions and a private reporting channel.",
  };
};

export const lockfilePresent: Rule = (snapshot) => {
  const applicable = snapshot.manifests.length > 0;
  const dependencies = snapshot.manifests.reduce(
    (total, manifest) => total + manifest.dependencyCount + manifest.developmentDependencyCount,
    0,
  );
  return {
    ruleId: "security/lockfile-present",
    domain: "security",
    title: "Dependency lockfile",
    description: "Dependency-bearing projects commit a recognized lockfile.",
    status: !applicable
      ? "not_applicable"
      : snapshot.facts.lockfilePaths.length > 0
        ? "pass"
        : dependencies > 0
          ? "fail"
          : "warn",
    severity: "high",
    weight: 3,
    evidence:
      snapshot.facts.lockfilePaths.length > 0
        ? snapshot.facts.lockfilePaths.map((path) => ({
            kind: "present",
            message: "Lockfile detected",
            path,
          }))
        : applicable
          ? [{ kind: "missing", message: "No recognized lockfile was detected" }]
          : [],
    remediation: "Generate and commit the ecosystem's lockfile.",
  };
};

export const dependencyUpdates: Rule = (snapshot) => ({
  ruleId: "security/dependency-updates",
  domain: "security",
  title: "Dependency update automation",
  description: "A dependency update service is configured for repositories with manifests.",
  status:
    snapshot.manifests.length === 0
      ? "not_applicable"
      : snapshot.facts.dependencyUpdatePaths.length > 0
        ? "pass"
        : "warn",
  severity: "medium",
  weight: 2,
  evidence:
    snapshot.facts.dependencyUpdatePaths.length > 0
      ? snapshot.facts.dependencyUpdatePaths.map((path) => ({
          kind: "present",
          message: "Update automation",
          path,
        }))
      : snapshot.manifests.length > 0
        ? [{ kind: "missing", message: "Dependabot or Renovate configuration was not detected" }]
        : [],
  remediation: "Configure Dependabot or Renovate for the detected package ecosystems.",
});

export const workflowPermissions: Rule = (snapshot) => {
  if (snapshot.workflows.length === 0) {
    return {
      ruleId: "security/workflow-permissions",
      domain: "security",
      title: "Workflow token permissions",
      description: "Workflows explicitly scope the GITHUB_TOKEN.",
      status: "not_applicable",
      severity: "high",
      weight: 3,
      evidence: [],
      remediation: "Declare least-privilege permissions at workflow or job scope.",
      documentationUrl: SECURE_USE,
    };
  }

  let missing = 0;
  let broad = 0;
  for (const workflow of snapshot.workflows) {
    const workflowRisk = permissionRisk(workflow.permissions);
    if (
      workflowRisk === "missing" &&
      (workflow.jobs.length === 0 || workflow.jobs.some((job) => job.permissions === undefined))
    ) {
      missing += 1;
    }
    if (workflowRisk === "write-all" || hasWriteAllObject(workflow.permissions)) broad += 1;
    for (const job of workflow.jobs) {
      if (job.permissions === undefined) continue;
      if (permissionRisk(job.permissions) === "write-all" || hasWriteAllObject(job.permissions))
        broad += 1;
    }
  }
  const status: CheckResult["status"] = broad > 0 ? "fail" : missing > 0 ? "warn" : "pass";
  return {
    ruleId: "security/workflow-permissions",
    domain: "security",
    title: "Workflow token permissions",
    description: "Workflows explicitly scope the GITHUB_TOKEN and avoid write-all access.",
    status,
    severity: "high",
    weight: 3,
    evidence: [
      {
        kind: broad > 0 ? "risk" : missing > 0 ? "missing" : "present",
        message:
          broad > 0
            ? `${broad} broad write permission declaration(s)`
            : `${missing} workflow(s) rely on defaults`,
      },
    ],
    remediation: "Declare only the permissions each workflow or job requires.",
    documentationUrl: SECURE_USE,
  };
};

export const actionReferencePinned: Rule = (snapshot) => {
  const references = snapshot.workflows.flatMap((workflow) =>
    workflow.jobs.flatMap((job) =>
      job.actionReferences.map((reference) => ({ reference, path: workflow.path })),
    ),
  );
  const external = references.filter(({ reference }) => !reference.local);
  const unpinned = external.filter(({ reference }) => !reference.pinnedToCommit);
  return {
    ruleId: "security/action-reference-pinned",
    domain: "security",
    title: "Immutable Action references",
    description:
      "External Actions and containers are pinned to immutable commit or digest references.",
    status: external.length === 0 ? "not_applicable" : unpinned.length === 0 ? "pass" : "fail",
    severity: "high",
    weight: 2,
    evidence: (unpinned.length > 0 ? unpinned : external).map(({ reference, path }) => ({
      kind: reference.pinnedToCommit ? "present" : "risk",
      message: reference.pinnedToCommit
        ? "Immutable reference"
        : `Mutable reference: ${reference.value}`,
      path,
    })),
    remediation:
      "Pin third-party Actions to a full 40-character commit SHA and containers to a digest.",
    documentationUrl: SECURE_USE,
  };
};

export const pullRequestTargetCheckout: Rule = (snapshot) => {
  const risky = snapshot.workflows.filter(
    (workflow) =>
      workflow.triggers.includes("pull_request_target") &&
      workflow.jobs.some((job) =>
        job.actionReferences.some((reference) =>
          reference.repository?.toLowerCase().startsWith("actions/checkout"),
        ),
      ),
  );
  return {
    ruleId: "security/pull-request-target-checkout",
    domain: "security",
    title: "Privileged pull request checkout",
    description:
      "pull_request_target workflows do not combine privileged context with a source checkout.",
    status: snapshot.workflows.length === 0 ? "not_applicable" : risky.length > 0 ? "fail" : "pass",
    severity: "high",
    weight: 4,
    evidence:
      risky.length > 0
        ? risky.map((workflow) => ({
            kind: "risk",
            message: "Manual review required",
            path: workflow.path,
          }))
        : snapshot.workflows.length > 0
          ? [{ kind: "present", message: "No pull_request_target checkout combination detected" }]
          : [],
    remediation:
      "Use pull_request for untrusted code, or avoid checking out pull request code in privileged jobs.",
    documentationUrl: SECURE_USE,
  };
};

export const untrustedContextInRun: Rule = (snapshot) => {
  const expressions = snapshot.workflows.flatMap((workflow) =>
    workflow.jobs.flatMap((job) => job.untrustedExpressions),
  );
  return {
    ruleId: "security/untrusted-context-in-run",
    domain: "security",
    title: "Untrusted context in shell",
    description:
      "Inline shell scripts do not interpolate attacker-controlled GitHub context directly.",
    status:
      snapshot.workflows.length === 0 ? "not_applicable" : expressions.length > 0 ? "fail" : "pass",
    severity: "high",
    weight: 4,
    evidence:
      expressions.length > 0
        ? expressions.map((expression) => ({
            kind: "risk",
            message: `Direct expression in ${expression.job} step ${expression.step}: ${expression.expression}`,
            path: expression.path,
          }))
        : snapshot.workflows.length > 0
          ? [{ kind: "present", message: "No direct untrusted shell interpolation detected" }]
          : [],
    remediation:
      "Pass untrusted values through an environment variable and quote them in the shell.",
    documentationUrl: "https://docs.github.com/en/actions/concepts/security/script-injections",
  };
};

export const sensitiveFilename: Rule = (snapshot) => ({
  ruleId: "security/sensitive-filename",
  domain: "security",
  title: "Sensitive filenames",
  description:
    "The checkout does not contain common private-key, credential, secret, or environment filenames.",
  status: snapshot.facts.sensitiveFilePaths.length > 0 ? "fail" : "pass",
  severity: "high",
  weight: 3,
  evidence:
    snapshot.facts.sensitiveFilePaths.length > 0
      ? snapshot.facts.sensitiveFilePaths.map((path) => ({
          kind: "risk",
          message: "Sensitive filename",
          path,
        }))
      : [{ kind: "present", message: "No common sensitive filenames were detected" }],
  remediation:
    "Remove sensitive files from version control, rotate exposed credentials, and add safe ignore rules.",
});

export const securityRules: Rule[] = [
  securityPolicy,
  lockfilePresent,
  dependencyUpdates,
  workflowPermissions,
  actionReferencePinned,
  pullRequestTargetCheckout,
  untrustedContextInRun,
  sensitiveFilename,
];
