# Maniflight

Maniflight is a read-only GitHub diagnostics CLI and Action. The CLI's PR Flight Director explains
why a pull request is blocked and who can act next; the scan command and Action inspect repository
readiness.

It never mutates GitHub or executes inspected repository code. It writes only the report files you
request—no comments, approvals, reruns, merges, log downloads, or artifact downloads.

## Install

Maniflight 1.x supports Node.js 22.12+ within the 22.x line, or Node.js 24, on Windows, macOS, and
Linux. GitHub releases are the supported distribution channel.

```bash
npm install --global https://github.com/agrovr/maniflight/releases/download/v1.0.0/maniflight-1.0.0.tgz
```

## PR Flight Director

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

For machine-readable output, add `--json`. For authenticated evidence, set `GH_TOKEN` or
`GITHUB_TOKEN`; tokens are never accepted as arguments.

## Repository scan

Inspect a checkout without executing its code:

```bash
maniflight scan . --output maniflight-report
```

Use `--baseline-report` with `--fail-on-regression` to gate only on new regressions.
[Explore Maniflight's live self-scan](https://agrovr.github.io/maniflight/).

## GitHub Action

The Action runs the repository scan. PR Flight Director remains a CLI command in 1.x.

```yaml
name: Repository diagnostics

on:
  pull_request:

permissions:
  contents: read

jobs:
  maniflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - uses: agrovr/maniflight@v1
        with:
          github-token: ${{ github.token }}
          repository: ${{ github.repository }}
```

Pin Maniflight to a reviewed full commit SHA in security-sensitive workflows. The
[repository scan guide](docs/REPOSITORY-SCAN.md) covers configuration, outputs, and artifact upload.

## What it checks

- Pull-request state, mergeability, reviews, review threads, checks, statuses, Actions runs, and
  active base-branch rules.
- Hidden `action_required` workflow runs that can be absent from the ordinary check summary.
- Repository architecture, automation, security hygiene, and community readiness.
- Explicit baseline regressions when a trusted earlier report is supplied.
- Evidence coverage: missing or inaccessible data remains `unknown`, never a silent pass.

## Trust and limits

- Conditions link to their observable GitHub evidence.
- Remote names and URLs are sanitized and bounded before output.
- A successful CLA/DCO status means only that the named provider reported success.
- A repository score is a navigation aid, not a security or compliance certification.
- Every live report records its observation time and exact head SHA.

## Documentation and support

Read the [PR Flight Director guide](docs/PR-FLIGHT.md), [rules](docs/RULES.md),
[scoring model](docs/SCORING.md), [stability policy](docs/STABILITY.md), or
[roadmap](ROADMAP.md) when needed.

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md). Use [SUPPORT.md](SUPPORT.md) for help and
[SECURITY.md](SECURITY.md) for private vulnerability reports. Licensed under [MIT](LICENSE).
