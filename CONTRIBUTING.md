# Contributing to Maniflight

Thank you for helping make repository preflight checks more useful,
explainable, and trustworthy.

By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md). For security concerns, use the private
process in [SECURITY.md](SECURITY.md).

## Before starting

Search existing issues and pull requests before proposing work. For a
substantial feature, scoring change, or new rule, open an issue first so its
scope and evidence model can be discussed before implementation.

Useful contributions include:

- focused bug fixes with a reproduction;
- deterministic rules with clear remediation;
- representative repository fixtures;
- report accessibility and usability improvements;
- documentation corrections and examples; and
- performance improvements supported by measurements.

Please do not split one logical change into many trivial pull requests or add
generated content that has not been reviewed. Contributions should improve the
project, not manufacture activity.

## Development setup

Requirements:

- Node.js 22 or newer;
- npm; and
- Git.

```bash
git clone https://github.com/YOUR-USER/maniflight.git
cd maniflight
npm ci
npm run build
npm test
```

Run a local preflight against the repository:

```bash
npm run scan -- . --output maniflight-report
```

The current package is developed from source and is not advertised as an npm
registry installation.

## Make a focused change

1. Fork the repository and create a short-lived branch.
2. Add or update tests for behavior changes.
3. Update user documentation when commands, configuration, rules, scoring, or
   report fields change.
4. Run the relevant build and test commands.
5. Inspect the generated report when changing rendering or rule presentation.
6. Open one pull request that explains the problem, approach, and verification.

Conventional-style commit subjects such as `fix:`, `feat:`, `docs:`, and
`test:` are welcome, but a clear, accurate history matters more than strict
formatting.

## Rule contributions

A rule is acceptable when it is deterministic, useful across realistic
repositories, and honest about its limits. A rule contribution should include:

- a stable domain-prefixed rule ID;
- the exact repository evidence it reads;
- pass, warn, fail, unknown, and not-applicable behavior as relevant;
- severity and remediation rationale;
- positive, negative, and ambiguous fixtures;
- false-positive and false-negative analysis; and
- matching updates to [docs/RULES.md](docs/RULES.md).

Rules must not execute repository code merely to inspect it, transmit source
content, infer contributor performance, or present a heuristic as a security or
compliance guarantee.

## Scoring changes

Scoring is a public contract. Changes must include tests, examples, a migration
note when output changes, and an update to
[docs/SCORING.md](docs/SCORING.md). Avoid changing weights solely to make a
particular repository score better.

## Pull request expectations

A reviewable pull request:

- links the issue or explains why no issue is needed;
- stays within one coherent scope;
- describes user-visible behavior and compatibility impact;
- lists the commands used to verify the change;
- includes screenshots only when visual behavior changed;
- calls out known limitations or follow-up work; and
- does not include secrets, private repository data, or unrelated formatting.

Maintainers may ask to reduce scope, add fixtures, or separate a refactor from a
behavior change.

## AI-assisted contributions

AI tools may assist development, but the human contributor remains responsible
for every line, claim, dependency, and test. Review generated changes locally,
remove irrelevant output, and disclose material AI assistance in the pull
request when it helps reviewers assess provenance or risk. Do not submit
unverified model output, fabricated test results, or bulk-generated issues and
pull requests.

## Licensing

By submitting a contribution, you agree that it may be distributed under the
project's [MIT License](LICENSE). No contributor license agreement is currently
required.
