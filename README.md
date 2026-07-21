# Maniflight

Maniflight is a stable, read-only CLI and GitHub Action that explains why a pull request is blocked,
who can act next, and what repository readiness evidence is actually present.

It never mutates GitHub or executes inspected repository code. It writes only the report files you
request—no comments, approvals, reruns, merges, log downloads, or artifact downloads.

## Install

Maniflight 1.x supports Node.js 22.12+ within the 22.x line, or Node.js 24, on Windows, macOS, and
Linux. GitHub releases are the supported distribution channel.

```bash
npm install --global https://github.com/agrovr/maniflight/releases/download/v1.0.0/maniflight-1.0.0.tgz
```

## Quick start

Inspect a live pull request:

```bash
maniflight pr rtk-ai/rtk#3114
```

Abridged illustrative output (live evidence can change):

```text
Maniflight PR Flight Director
rtk-ai/rtk#3114

STATUS       BLOCKED
NEXT ACTORS  reviewer, maintainer

BLOCKED      1 approving review is required [merge blocker]
ACTION       CI requires manual action
```

Inspect a repository without executing its code:

```bash
maniflight scan . --output maniflight-report
```

[Explore Maniflight's live self-scan](https://agrovr.github.io/maniflight/).

## What it checks

- Pull-request state, mergeability, reviews, review threads, checks, statuses, Actions runs, and
  active base-branch rules.
- Hidden `action_required` workflow runs that can be absent from the ordinary check summary.
- Repository architecture, automation, security hygiene, and community readiness.
- Explicit baseline regressions when a trusted earlier report is supplied.
- Evidence coverage: missing or inaccessible data remains `unknown`, never a silent pass.

## More commands

```bash
# Machine-readable PR report
maniflight pr owner/repository#123 --json

# Compare with an explicit earlier report
maniflight scan . --baseline-report baseline/report.json --fail-on-regression
```

For authenticated PR evidence, set `GH_TOKEN` or `GITHUB_TOKEN`; tokens are never accepted as
arguments. Run `maniflight <command> --help` for the complete option list.

## Trust model

- Conditions link to their observable GitHub evidence.
- Remote names and URLs are sanitized and bounded before output.
- A successful CLA/DCO status means only that the named provider reported success.
- A repository score is a navigation aid, not a security or compliance certification.
- Every live report records its observation time and exact head SHA.

## Documentation and support

Read the [PR Flight Director](docs/PR-FLIGHT.md) or
[repository scan and GitHub Action](docs/REPOSITORY-SCAN.md) guide, then see the
[rules](docs/RULES.md), [scoring model](docs/SCORING.md), [stability policy](docs/STABILITY.md), or
[roadmap](ROADMAP.md) when needed.

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md). Use [SUPPORT.md](SUPPORT.md) for help and
[SECURITY.md](SECURITY.md) for private vulnerability reports. Licensed under [MIT](LICENSE).
