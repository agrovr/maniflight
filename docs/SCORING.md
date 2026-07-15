# Scoring and confidence

Maniflight separates two questions:

1. **Score:** how did the repository perform on rules that could be evaluated?
2. **Confidence:** how much of the applicable observation surface had usable
   evidence?

This prevents inaccessible context from becoming a silent pass and prevents a
small number of passing checks from looking as complete as a well-observed
repository.

## Rule outcomes

| Status | Meaning | Earned credit | Evaluated? | Confidence denominator? |
| --- | --- | ---: | :---: | :---: |
| `pass` | The expected evidence is present. | 100% of rule weight | Yes | Yes |
| `warn` | Evidence is partial or presents a non-blocking risk. | 50% of rule weight | Yes | Yes |
| `fail` | Expected evidence is absent or a defined risk is present. | 0% | Yes | Yes |
| `unknown` | Maniflight cannot obtain enough evidence for an honest outcome. | 0% | No | Yes |
| `not_applicable` | The rule does not apply to this repository shape. | 0% | No | No |

Unknown is intentionally different from fail. It lowers confidence without
lowering the score. Not-applicable changes neither.

## Domain score

Each rule has a positive weight. Within one domain:

```text
earned weight =
    sum(pass weights)
  + 0.5 × sum(warn weights)

evaluated weight =
  sum(weights for pass, warn, and fail)

possible weight =
  sum(weights for pass, warn, fail, and unknown)

domain score =
  100 × earned weight / evaluated weight

domain confidence =
  100 × evaluated weight / possible weight
```

When no rule is evaluated, the domain score is `null`. A domain with no
possible applicable weight has zero confidence rather than an invented complete
result.

### Worked example

Suppose a domain contains:

- a weight-2 passing rule;
- a weight-1 warning;
- a weight-1 unknown; and
- a weight-1 not-applicable rule.

Then:

```text
earned    = 2 + (0.5 × 1) = 2.5
evaluated = 2 + 1         = 3
possible  = 2 + 1 + 1     = 4

score      = 2.5 / 3 = 83.33
confidence = 3 / 4   = 75
```

The not-applicable rule is excluded. The unknown rule lowers confidence but
does not turn into a failure.

## Overall score

The four domains have explicit overall weights:

| Domain | Overall weight |
| --- | ---: |
| Architecture | 25% |
| Automation | 25% |
| Security | 30% |
| Community | 20% |

The overall score is the weighted mean of domain scores. Domains with a
`null` score are excluded and the remaining domain weights are renormalized;
otherwise missing evidence would act like a hidden zero.

```text
overall score =
  sum(domain score × domain weight)
  / sum(weights for domains with a score)
```

Overall confidence uses the same domain weights to retain visibility into
missing evidence. Scores and confidence are bounded to 0–100; presentation
layers may round values for readability.

## Readiness labels

| Label | Condition |
| --- | --- |
| `insufficient-data` | Overall score is unavailable, or overall confidence is below 25. |
| `ready` | Confidence is at least 25 and score is at least 85. |
| `stable` | Confidence is at least 25 and score is at least 70. |
| `developing` | Confidence is at least 25 and score is below 70. |

These labels summarize repository evidence. They are not a security,
compliance, reliability, or production-readiness certification.

## Severity and score are separate

Every finding also has an `info`, `low`, `medium`, or `high` severity.
Severity communicates the potential impact and review priority. The rule's
weight controls its numerical contribution.

Keeping them separate prevents a severity label from secretly changing the
published formula. A repository can have a high score and still contain a
high-severity finding that deserves immediate review.

## GitHub Action gates

Gating is opt-in:

- `fail-under` lets a repository owner select an overall-score threshold.
- `fail-on-high` lets a repository owner fail the step when a high-severity
  finding is reported.

Choose gates only after reviewing the rule catalog and a baseline report.
Consider score and confidence together. A threshold on a low-confidence scan
can create false assurance or noisy failures.

## Responsible use

- Compare a repository with its own earlier reports before comparing unrelated
  projects.
- Read evidence and remediation rather than optimizing only for the number.
- Treat unknown outcomes as an invitation to improve observability or provide
  context.
- Do not use Maniflight to rank contributors or make employment decisions.
- Do not describe a label as certification.
- Record intentional exceptions with a clear reason when waiver support is
  used.

The JSON report's `schemaVersion` identifies its machine-readable contract.
Scoring changes require tests, release notes, and corresponding documentation.
