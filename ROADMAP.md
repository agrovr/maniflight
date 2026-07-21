# Roadmap

Maniflight ships capabilities only when implementation, tests, and user documentation agree.

## Shipped

### Repository diagnostics

- bounded, read-only filesystem and GitHub evidence collection;
- deterministic architecture, automation, security, and community rules;
- JSON, accessible HTML, and standalone SVG reports;
- explicit score confidence and unknown evidence; and
- opt-in baseline comparison and regression gates.

### PR Flight Director

- live PR, review, check, status, workflow, and branch-rule evidence;
- detection of Actions runs that require manual action but are absent from check summaries;
- evidence-backed next actors without predicting maintainer intent;
- deterministic terminal output and schema-versioned JSON; and
- authenticated and public read-only operation with explicit coverage gaps.

## Next

- publish a provenance-backed npm package after registry ownership is verified;
- improve multi-package repository boundaries;
- add documented baselines for intentionally accepted findings;
- extend source locations and remediation guidance; and
- evaluate opt-in AI-service and Kubernetes evidence packs.

## Non-goals

Maniflight will not rank contributors, predict merge likelihood, replace dedicated security
scanners, claim universal compliance, execute untrusted code, or write to a repository without a
separate explicit workflow.

Open a feature request with a concrete workflow, current workaround, and reproducible example.
