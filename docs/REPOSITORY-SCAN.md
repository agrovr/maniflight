# Repository scan and GitHub Action

`maniflight scan` inspects a local repository without executing its code. It produces deterministic
architecture, automation, security-hygiene, and community-readiness evidence.

## Output

```bash
maniflight scan . --output maniflight-report
```

| File | Purpose |
| --- | --- |
| `report.json` | Versioned evidence contract for automation. |
| `report.html` | Self-contained accessible report. |
| `orbit.svg` | Standalone overview. |
| `comparison.json` | Optional baseline delta when a baseline is supplied. |

The HTML report supports keyboard navigation, light and dark themes, print styles, and reduced
motion. The score is a navigation aid; confidence shows how much weighted evidence was observable.

## Options

| Option | Purpose |
| --- | --- |
| `-o, --output <directory>` | Select the report directory. |
| `-r, --repository <owner/name>` | Request optional read-only GitHub metadata. |
| `-c, --config <path>` | Select a configuration file inside the repository. |
| `--offline` | Skip GitHub enrichment. |
| `--baseline-report <path>` | Compare with an explicit earlier report. |
| `--fail-under <score>` | Apply an owner-selected overall score gate. |
| `--fail-on-high` | Fail when an unwaived high-severity finding remains. |
| `--fail-on-regression` | Fail only when the supplied baseline regresses. |

Gates are opt-in. Unknown evidence is not converted into a failure solely to make a gate decisive.

## Baseline comparison

```bash
maniflight scan . \
  --baseline-report baseline/report.json \
  --fail-on-regression \
  --output maniflight-report
```

Checks are matched by stable rule ID. Pass-to-warning/failure and warning-to-failure changes are
regressions; the reverse is an improvement. Unknown, not-applicable, and rule-catalog changes remain
visible but do not trigger the regression gate.

The baseline must be a bounded, regular UTF-8 JSON file. Maniflight never downloads it, checks out
another ref, or broadens token permissions.

## GitHub Action

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
      - uses: agrovr/maniflight@v1.0.0
        with:
          path: .
          output-dir: maniflight-report
          github-token: ${{ github.token }}
          repository: ${{ github.repository }}
```

For security-sensitive workflows, pin Maniflight to a reviewed full commit SHA. [action.yml](../action.yml)
is the authoritative input/output contract. Upload the generated report with your own artifact step
if it must persist after the job.

## Configuration

Maniflight reads `.maniflight.yml` by default. Configuration can bound files and parsed bytes,
exclude generated paths, disable GitHub enrichment, select opt-in thresholds, and record explicit
waivers. A waiver remains visible and keeps its scoring effect; it only changes the selected gate.

See [RULES.md](RULES.md) for the evidence catalog and [SCORING.md](SCORING.md) for the score,
confidence, and waiver semantics.
