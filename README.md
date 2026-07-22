# Maniflight

Read-only GitHub pull-request diagnostics that explain what blocks a merge and who can act next.

[Maniflight 1.x is stable](docs/STABILITY.md) on Node.js 22.12+ and Node.js 24 across Windows,
macOS, and Linux. It never changes GitHub or executes code from the repository it inspects.

## Quickstart

Install the release package from GitHub:

```bash
npm install --global https://github.com/agrovr/maniflight/releases/download/v1.0.0/maniflight-1.0.0.tgz
```

Inspect a pull request:

```bash
maniflight pr rtk-ai/rtk#3114
```

Abridged example; live evidence changes over time:

```text
Maniflight PR Flight Director
rtk-ai/rtk#3114

STATUS       BLOCKED
NEXT ACTORS  reviewer, maintainer

BLOCKED      1 approving review is required [merge blocker]
ACTION       CI requires manual action
```

Add `--json` for machine-readable output. Set `GH_TOKEN` or `GITHUB_TOKEN` for authenticated
evidence; tokens are never accepted as command arguments.

## What Flight Director explains

- Whether the pull request is mergeable, blocked, waiting, or incomplete.
- Required approvals, requested changes, and unresolved review threads.
- Checks, commit statuses, required contexts, and hidden `action_required` workflow runs.
- The next actor and links to the evidence behind each conclusion.
- Missing or inaccessible evidence as `unknown`—never as a guessed pass.

See the [PR Flight Director guide](docs/PR-FLIGHT.md) for supported evidence and limitations.

## Repository scan

Maniflight can also inspect repository readiness without executing project code:

```bash
maniflight scan . --output maniflight-report
```

The scan produces JSON and an accessible standalone HTML report. The
[repository scan guide](docs/REPOSITORY-SCAN.md) covers the GitHub Action, configuration, baselines,
and optional gates. [View Maniflight's self-scan](https://agrovr.github.io/maniflight/).

## Trust

- GitHub access is read-only; Maniflight does not comment, approve, rerun, merge, or download logs.
- Reports link to observable evidence and record the observation time and exact head SHA.
- Remote text and URLs are sanitized and bounded before output.
- A result is diagnostic evidence, not a security or compliance certification.

Read the [stability policy](docs/STABILITY.md), [changelog](CHANGELOG.md), [support guide](SUPPORT.md),
or [security policy](SECURITY.md). Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md).

MIT licensed.
