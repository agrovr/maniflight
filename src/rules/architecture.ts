import type { CheckResult, RepositorySnapshot, Rule } from "../model.js";

function hasTestCommand(snapshot: RepositorySnapshot): boolean {
  return snapshot.manifests.some((manifest) =>
    manifest.scripts.some((script) => /^(test|test:|check$|verify$)/u.test(script)),
  );
}

export const manifestPresent: Rule = (snapshot) => {
  const applicable = snapshot.facts.sourceFileCount > 0 || snapshot.manifests.length > 0;
  const valid = snapshot.manifests.filter((manifest) => !manifest.parseError);
  return {
    ruleId: "architecture/manifest-present",
    domain: "architecture",
    title: "Project manifest",
    description:
      "A machine-readable project manifest makes the repository reproducible and navigable.",
    status: !applicable ? "not_applicable" : valid.length > 0 ? "pass" : "fail",
    severity: "medium",
    weight: 3,
    evidence:
      valid.length > 0
        ? valid.map((manifest) => ({
            kind: "present",
            message: `${manifest.kind} manifest`,
            path: manifest.path,
          }))
        : applicable
          ? [{ kind: "missing", message: "No readable project manifest was detected" }]
          : [],
    remediation: "Add the standard manifest for the repository's primary language or build system.",
  };
};

export const sourceBoundary: Rule = (snapshot) => {
  const applicable = snapshot.facts.sourceFileCount > 0;
  const boundaries = snapshot.facts.sourceDirectories;
  return {
    ruleId: "architecture/source-boundary",
    domain: "architecture",
    title: "Source boundary",
    description:
      "Production code is grouped under a recognizable application, package, or source directory.",
    status: !applicable ? "not_applicable" : boundaries.length > 0 ? "pass" : "warn",
    severity: "low",
    weight: 2,
    evidence:
      boundaries.length > 0
        ? boundaries.map((path) => ({
            kind: "present",
            message: "Recognized source boundary",
            path,
          }))
        : applicable
          ? [
              {
                kind: "missing",
                message: "Source files are present but no standard source boundary was found",
              },
            ]
          : [],
    remediation: "Group production code under src/, app/, packages/, cmd/, internal/, or lib/.",
  };
};

export const testCapability: Rule = (snapshot) => {
  const applicable = snapshot.facts.sourceFileCount > 0;
  const hasTests = snapshot.facts.testFileCount > 0;
  const hasRunner = hasTestCommand(snapshot) || snapshot.facts.testConfigurationPaths.length > 0;
  const status: CheckResult["status"] = !applicable
    ? "not_applicable"
    : hasTests && hasRunner
      ? "pass"
      : hasTests || hasRunner
        ? "warn"
        : "fail";
  return {
    ruleId: "architecture/test-capability",
    domain: "architecture",
    title: "Test capability",
    description: "The repository includes tests and a discoverable way to run them.",
    status,
    severity: "medium",
    weight: 3,
    evidence: applicable
      ? [
          {
            kind: hasTests ? "present" : "missing",
            message: hasTests
              ? `${snapshot.facts.testFileCount} test file(s) detected`
              : "No test files were detected",
          },
          {
            kind: hasRunner ? "present" : "missing",
            message: hasRunner
              ? "A test command or test configuration was detected"
              : "No test runner was detected",
          },
        ]
      : [],
    remediation: "Add focused tests and expose a standard test command in the project manifest.",
  };
};

export const typescriptStrict: Rule = (snapshot) => {
  const facts = snapshot.facts.typescript;
  const status: CheckResult["status"] = !facts.used
    ? "not_applicable"
    : !facts.configPath
      ? "fail"
      : facts.strict === undefined
        ? "unknown"
        : facts.strict
          ? "pass"
          : "warn";
  return {
    ruleId: "architecture/typescript-strict",
    domain: "architecture",
    title: "TypeScript strictness",
    description: "TypeScript repositories explicitly enable strict type checking.",
    status,
    severity: "medium",
    weight: 2,
    evidence: !facts.used
      ? []
      : facts.configPath
        ? [
            {
              kind: facts.strict === undefined ? "unknown" : facts.strict ? "present" : "missing",
              message:
                facts.strict === undefined
                  ? "The strict setting could not be determined safely"
                  : facts.strict
                    ? "strict mode is enabled"
                    : "strict mode is not explicitly enabled",
              path: facts.configPath,
            },
          ]
        : [{ kind: "missing", message: "TypeScript files exist without a root tsconfig.json" }],
    remediation: "Add a tsconfig.json and enable compilerOptions.strict.",
    documentationUrl: "https://www.typescriptlang.org/tsconfig/#strict",
  };
};

export const packageEntrypoints: Rule = (snapshot) => {
  const entrypoints = snapshot.manifests
    .filter((manifest) => manifest.kind === "npm")
    .flatMap((manifest) =>
      manifest.entrypoints.map((entrypoint) => ({ ...entrypoint, manifest: manifest.path })),
    );
  const existing = entrypoints.filter((entrypoint) => entrypoint.exists);
  const status: CheckResult["status"] =
    entrypoints.length === 0
      ? "not_applicable"
      : existing.length === entrypoints.length
        ? "pass"
        : existing.length > 0
          ? "warn"
          : "fail";
  return {
    ruleId: "architecture/package-entrypoints",
    domain: "architecture",
    title: "Package entrypoints",
    description: "Declared npm entrypoints resolve to files in the inspected checkout.",
    status,
    severity: "medium",
    weight: 2,
    evidence: entrypoints.map((entrypoint) => ({
      kind: entrypoint.exists ? "present" : "missing",
      message: `${entrypoint.name} points to ${entrypoint.target}`,
      path: entrypoint.manifest,
    })),
    remediation:
      "Correct stale entrypoint paths or ensure required build outputs exist before publishing.",
  };
};

export const architectureRules: Rule[] = [
  manifestPresent,
  sourceBoundary,
  testCapability,
  typescriptStrict,
  packageEntrypoints,
];
