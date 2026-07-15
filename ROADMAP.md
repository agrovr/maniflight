# Roadmap

Maniflight's roadmap is organized around verifiable capabilities rather than
fixed dates. A capability is considered shipped only when its implementation,
tests, and user documentation are present in a release.

## v0.1 — Repository preflight

The initial release establishes the general-purpose, read-only workflow:

- a Node.js CLI that scans a local repository;
- a reusable GitHub Action for pull-request and branch checks;
- deterministic architecture, automation, security, and community rules;
- a confidence-aware score with source-linked findings;
- JSON output for automation; and
- a self-contained interactive orbital HTML report.

The v0.1 scanner reports evidence. It does not modify the target repository,
apply suggested fixes, rank contributors, or claim that a repository is
production-ready.

## v0.2 — Baseline-aware regression tracking

The second preview adds a repository-relative trajectory without a hosted
service:

- compare a current scan with an explicitly supplied earlier `report.json`;
- classify regressions, improvements, evidence changes, and rule-catalog
  changes by stable rule ID;
- write a separate, versioned `comparison.json` artifact;
- show the delta in the accessible interactive report; and
- optionally fail CI only for newly introduced regressions.

Maniflight does not download the baseline, check out Git refs, or request
broader token permissions. Score and confidence deltas remain informational.

## Near-term candidates

The next milestones will be selected from validated user needs:

- repository-specific policy through `.maniflight.yml`;
- documented baselines for intentionally accepted findings;
- clearer monorepo and multi-package boundaries;
- machine-readable output stability and schema versioning;
- improved source locations and remediation guidance;
- history and trend presentation built on explicit comparison artifacts; and
- accessibility and performance work on large reports.

## Readiness packs under exploration

These are future, opt-in rule packs—not v0.2 features:

- **AI service readiness:** evidence for evaluation coverage, bounded retries
  and timeouts, structured-output handling, human checkpoints, and observable
  model/tool calls.
- **Kubernetes readiness:** rendered-manifest validation, workload probes,
  resource policies, rollout safeguards, and deployment evidence.

The packs will favor deterministic repository evidence. Model-generated
explanations may assist users later, but they will not silently decide a gate.

## Explicit non-goals

Maniflight is not intended to:

- infer developer performance from repository activity;
- replace a SAST, dependency, secret, or container scanner;
- replace GitOps reconciliation or runtime observability;
- award a universal quality or compliance certification;
- write fixes without an explicit future workflow and user review; or
- add rules merely to increase the rule count.

## Influence the roadmap

Open a feature request with a concrete workflow, current workaround, and
example repository shape. Rule proposals should follow
[docs/RULES.md](docs/RULES.md) and include deterministic evidence, false-positive
analysis, and tests.
