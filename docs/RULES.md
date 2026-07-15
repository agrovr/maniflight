# Rule catalog

Maniflight v0.1 evaluates deterministic repository evidence across four
domains. Rules inspect files and optional read-only GitHub metadata; they do not
execute the target project's code.

This catalog describes the evidence boundary and intended interpretation.
Implementation and fixtures remain the final authority for an exact edge case.
If observed behavior differs from this document, report it as a documentation
or rule bug.

## Rule result contract

Each result contains:

- a stable, domain-prefixed `ruleId`;
- domain, title, and description;
- `pass`, `warn`, `fail`, `unknown`, or `not_applicable` status;
- `info`, `low`, `medium`, or `high` severity;
- a positive score weight;
- one or more evidence records when evidence is available;
- remediation when the result is actionable; and
- optional documentation and waiver metadata.

Evidence is classified as present, missing, risk, or unknown and may include a
repository-relative path, line, or read-only GitHub URL.

See [SCORING.md](SCORING.md) for how status and weight affect score and
confidence.

## v0.1 rule metadata

Severity communicates review priority; weight controls numerical contribution.
They are intentionally separate. These values are part of the v0.1 scoring
contract.

| Rule ID | Severity | Weight |
| --- | --- | ---: |
| `architecture/manifest-present` | Medium | 3 |
| `architecture/source-boundary` | Low | 2 |
| `architecture/test-capability` | Medium | 3 |
| `architecture/typescript-strict` | Medium | 2 |
| `architecture/package-entrypoints` | Medium | 2 |
| `automation/workflow-present` | Medium | 3 |
| `automation/pr-validation` | High | 3 |
| `automation/job-timeout` | Low | 1 |
| `automation/deploy-safety` | High | 2 |
| `security/policy-present` | Medium | 2 |
| `security/lockfile-present` | High | 3 |
| `security/dependency-updates` | Medium | 2 |
| `security/workflow-permissions` | High | 3 |
| `security/action-reference-pinned` | High | 2 |
| `security/pull-request-target-checkout` | High | 4 |
| `security/untrusted-context-in-run` | High | 4 |
| `security/sensitive-filename` | High | 3 |
| `community/readme` | Medium | 3 |
| `community/license` | High | 3 |
| `community/contributing` | Low | 2 |
| `community/code-of-conduct` | Low | 1 |
| `community/issue-template` | Low | 1 |
| `community/pull-request-template` | Low | 1 |
| `community/support-channel` | Medium | 1 |
| `community/repository-metadata` | Low | 1 |

## Architecture

### `architecture/manifest-present`

Detects supported project manifests such as `package.json`, Python project or
requirements files, `go.mod`, `Cargo.toml`, Ruby, .NET, and Java manifests.
A manifest provides the basic project boundary and dependency vocabulary.

**Limit:** a manifest proves discoverability, not that the application builds.
Unsupported or malformed formats may produce incomplete or unknown evidence.

### `architecture/source-boundary`

Looks for a recognizable source boundary and source files rather than treating
the repository root as an undifferentiated artifact collection.

**Limit:** small scripts and intentionally flat repositories may be valid. The
rule reports structural evidence; it does not prescribe one framework layout.

### `architecture/test-capability`

Looks for test files, test configuration, or a recognized test command in a
supported manifest.

**Limit:** test capability does not prove that tests pass, cover important
behavior, or run in CI. Maniflight does not execute the test suite.

### `architecture/typescript-strict`

For repositories using TypeScript, inspects TypeScript configuration for strict
type checking.

**Limit:** this rule is not applicable when TypeScript is not detected. Strict
mode is a useful signal, not a proof of type safety.

### `architecture/package-entrypoints`

Checks whether declared package entry points resolve to repository files when
the manifest format exposes entry-point data.

**Limit:** generated build outputs may legitimately be absent before a build.
The rule does not run a build or import the package.

## Automation

### `automation/workflow-present`

Looks for parseable GitHub Actions workflows that make repository automation
visible and repeatable.

**Limit:** a workflow file does not prove successful execution. Other CI
providers are not fully represented by this GitHub-focused v0.1 rule.

### `automation/pr-validation`

Looks for pull-request-triggered automation with recognizable quality signals
such as build, test, lint, type-check, or validation steps.

**Limit:** command names and composite workflows vary. Unrecognized validation
may lower confidence or produce a conservative result.

### `automation/job-timeout`

Checks GitHub Actions jobs for explicit `timeout-minutes` boundaries.

**Limit:** an explicit timeout does not ensure cancellation inside every child
process, but it limits an accidentally unbounded hosted job.

### `automation/deploy-safety`

Looks for deployment-like jobs and checks that each one declares a GitHub
environment while its workflow declares concurrency control.

**Limit:** deploy detection is heuristic and cannot see protections configured
in GitHub environment settings. It does not validate trigger policy, required
reviewers, or the commands being deployed. Review the cited workflow evidence
before treating the result as a gate.

## Security

These are repository-hygiene checks, not a vulnerability scan.

### `security/policy-present`

Looks for a `SECURITY.md` policy where maintainers can publish vulnerability
reporting guidance.

**Limit:** the rule checks presence, not whether the file contains a private
channel, response capacity, or an enforced disclosure process.

### `security/lockfile-present`

Checks supported package ecosystems for a committed dependency lockfile when a
lockfile is meaningful for that ecosystem.

**Limit:** lockfiles improve reproducibility but do not prove dependencies are
safe or current.

### `security/dependency-updates`

Looks for visible automated dependency-update configuration such as Dependabot
or Renovate.

**Limit:** configuration does not prove alerts are reviewed or updates are
merged.

### `security/workflow-permissions`

Inspects GitHub Actions workflow and job permission declarations for explicit,
bounded token access.

**Limit:** effective permissions also depend on repository and organization
settings that may be unavailable. Reusable workflows can add context outside
the scanned file.

### `security/action-reference-pinned`

Checks third-party GitHub Action references for immutable full-commit pins.
Local actions and Docker references are classified separately.

**Limit:** pinning establishes immutability, not trustworthiness. Review the
action source and update pins deliberately.

### `security/pull-request-target-checkout`

Conservatively flags a `pull_request_target` workflow that also uses
`actions/checkout` for manual review.

**Limit:** this is a targeted static pattern check, not complete workflow data

### `security/untrusted-context-in-run`

Looks for direct interpolation of pull-request-controlled GitHub expressions
inside shell `run` blocks.

**Limit:** the rule can identify known direct patterns but cannot prove that
all shell input is safe. Prefer passing values through environment variables
and validating them before use.

### `security/sensitive-filename`

Flags checkout filenames commonly associated with secrets, private keys, or
environment credentials while recognizing example/template conventions.

**Limit:** filename inspection is not secret scanning. A risky filename may
contain no secret, and a secret may exist in an ordinary file.

## Community

### `community/readme`

Looks for a repository README that gives visitors a stable starting point.

### `community/license`

Looks for a recognizable license file.

**Limit:** Maniflight does not provide legal advice or determine license
compatibility.

### `community/contributing`

Looks for contribution guidance covering setup and review expectations.

### `community/code-of-conduct`

Looks for a published code of conduct.

**Limit:** a file is not evidence of equitable enforcement.

### `community/issue-template`

Looks for issue templates or issue forms that collect actionable context.

### `community/pull-request-template`

Looks for a pull request template that asks contributors to explain and verify
changes.

### `community/support-channel`

Looks for a documented route for usage questions that is distinct from private
security reporting.

### `community/repository-metadata`

Uses optional GitHub metadata to inspect discoverability signals such as a
description and topics.

**Limit:** without GitHub metadata this rule becomes unknown rather than a
failure. Metadata quality and project quality are not equivalent.

## Collection boundaries

Maniflight intentionally:

- reads regular repository files but does not follow symlinks;
- records skipped large files and collection warnings;
- avoids generated dependency directories and Git internals;
- parses supported manifests and GitHub Actions YAML without executing them;
- uses a token only for requested read-only repository metadata; and
- writes only to the selected report output directory.

A skipped, malformed, unsupported, or inaccessible input should surface as
unknown evidence or a collection warning—not a fabricated pass.

## Propose a rule

Use the rule-proposal issue form. A proposal must identify deterministic
evidence, define ambiguous and not-applicable behavior, analyze false positives
and false negatives, and include positive, negative, and ambiguous fixtures.

Rules are not accepted merely to increase the catalog size or improve one
repository's score.
