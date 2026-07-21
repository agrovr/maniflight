# PR Flight Director

`maniflight pr owner/repository#number` explains the current observable blockers on a GitHub pull
request and identifies who can take the next useful action.

## Why several GitHub sources are required

No single GitHub response describes every blocker. Maniflight combines:

| Source | Evidence |
| --- | --- |
| Pull request | State, draft status, head/base refs, and mergeability. |
| GraphQL pull request | Aggregate review decision, merge state, and review threads. |
| Reviews | Visible review history used as supporting evidence. |
| Check runs | GitHub App and Actions job results on the PR head. |
| Commit statuses | Legacy providers, including some CLA/DCO services. |
| Actions runs | Runs with no jobs or check entry, including `action_required`. |
| Active branch rules | Required approvals, conversations, updates, and status contexts. |

Every optional source is marked `available`, `partial`, `unavailable`, or `not_attempted` in JSON.
Missing evidence never becomes a silent pass.

## Output

Human-readable output carries meaning without color. `--json` writes exactly one JSON document:

```bash
maniflight pr owner/repository#123 --json > flight.json
```

The top-level contract is:

```text
kind           pull-request-flight
schemaVersion  1.0
pullRequest    normalized target and head/base snapshot
outcome        status, next actors, and summary
signals        deterministic conditions with evidence links
nextActions    fixed, evidence-backed suggestions
collection     source coverage and safe warnings
```

A blocked PR is a diagnostic result and exits successfully. Invalid input or failure to fetch the
primary PR is an execution error and exits unsuccessfully.

## Authentication

Maniflight reads `GH_TOKEN`, then `GITHUB_TOKEN`. Tokens are environment-only and should have the
smallest read permissions needed for the target repository. GitHub GraphQL requires authentication,
so an anonymous public inspection reports review-decision and review-thread coverage as unavailable.

Never put a token in the target, shell history, configuration, or redirected report.

## Classification

Conditions use these statuses:

| Status | Meaning |
| --- | --- |
| `pass` | The observed condition completed successfully. |
| `blocked` | Evidence identifies a current merge blocker. |
| `action_required` | A person must act before progress can continue. |
| `waiting` | Automation or another pending condition is not complete. |
| `unknown` | Available evidence cannot support a stronger conclusion. |
| `info` | Relevant evidence that is not known to block the merge. |

Next actors are `contributor`, `reviewer`, `maintainer`, `automation`, `external`, `wait`, or
`unknown`. Actors are inferred only when the evidence supports it. For example, a zero-job
`action_required` workflow on a public fork is attributed to a maintainer as an inference, not as a
claim about the maintainer's intent.

## Safety and privacy

- GitHub GET requests and GraphQL queries only; no mutations.
- No comments, approvals, reruns, labels, merges, or workflow dispatches.
- No repository checkout, code execution, logs, or artifact downloads.
- Remote titles, names, and URLs are sanitized and bounded before output.
- URL query strings and fragments are removed before evidence is written.
- Tokens and raw API error bodies are never serialized.

## Freshness, limits, and rate limits

The report records `observedAt` and the exact head SHA. It is a point-in-time observation, not a
promise that GitHub will still show the same state later.

Each collection request is capped at 100 records. A next-page link, larger total count, malformed
response, or ancillary API failure marks that source partial or unavailable. Maniflight does not
wait indefinitely for GitHub to compute mergeability and does not retry rate-limited requests for
minutes. Run the command again after the reported condition changes.

GitHub may hide organization rules or private-repository evidence from the supplied token. A `404`
from a classic protection endpoint is not proof that no policy exists; Flight Director uses the
active branch-rules endpoint and keeps ambiguity explicit.

## Known limits

- The command observes GitHub.com only in 1.0.
- Required status matching is based on the active context names GitHub exposes.
- A successful CLA/DCO status means only that the named provider reported success.
- Maniflight does not predict merge likelihood, code correctness, or maintainer response time.
- Live evidence can change between API calls; the head SHA remains visible for verification.
