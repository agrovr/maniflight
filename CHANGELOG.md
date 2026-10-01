# Changelog

Notable user-facing changes are recorded here.

## Unreleased

- Print a **Next steps** section in `maniflight pr` terminal output, one row per actor with its evidence link.
- List `unknown` signals under a separate **Evidence gaps** heading after observed conditions.
- Add color for interactive terminals; `--no-color`, `NO_COLOR`, and `FORCE_COLOR` are honored.
  Color is applied only to Maniflight's own labels, never to remote text.
- Replace next actions that repeated the observation with instructions for failed checks, manual
  checks, fork workflow approval, provider sign-offs, and pending automation.
- Stop the GitHub client from printing raw request errors to stderr before Maniflight's own message.
- Publish a landing page for PR Flight Director on GitHub Pages; the live self-scan moves to `/scan/`.

## 1.0.0 — 2026-07-21

- Add the read-only PR Flight Director with terminal and JSON output.
- Combine PR metadata, reviews, checks, commit statuses, Actions runs, and active branch rules.
- Identify evidence-backed next actors and preserve incomplete evidence as unknown.
- Keep repository scans, baseline comparison, and the GitHub Action compatible.
- Declare the documented CLI, report schemas, and Action contract stable; npm registry publication
  remains a separate verified step.

## 0.2.0 — 2026-07-15

- Add explicit baseline comparison and opt-in regression gating.

## 0.1.0 — 2026-07-14

- Add repository evidence collection, deterministic rules, and JSON/HTML/SVG reports.
