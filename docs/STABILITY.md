# Stability and releases

Maniflight 1.x treats these interfaces as stable:

- the `scan` and `pr` command names;
- documented command arguments and exit behavior;
- the `pull-request-flight` JSON `schemaVersion: "1.0"` contract;
- repository report schemas until a documented major migration; and
- GitHub Action inputs and outputs.

Additive fields and options may be introduced in a minor release. Removing or changing documented
behavior requires a major release. GitHub can add API enum values at any time; Maniflight reports an
unknown value as `unknown` instead of treating it as success.

## Exit behavior

- `maniflight pr` exits `0` after producing a report, including when the pull request is blocked.
- `maniflight scan` exits `0` after producing its report unless an enabled score, severity, or
  regression gate is triggered.
- Either command exits `1` for invalid input, configuration, API, filesystem, or other execution
  errors. A triggered scan gate also exits `1` after writing the report.

## Supported runtime

- Node.js 22.12+ within the 22.x line, or Node.js 24
- Windows, macOS, and Linux
- GitHub.com REST and GraphQL APIs

CI verifies the supported operating systems. GitHub Enterprise Server is not part of the 1.0
support contract.

## Release process

Exact `vX.Y.Z` tags are annotated and never moved. The compatible `vX` Action tag advances only
after the matching release passes validation.

1. Update the changelog and version in `package.json` and `src/version.ts`.
2. Run `npm run check`, `npm test`, `npm run build`, `npm run demo`, and `npm pack --dry-run`.
3. Merge the reviewed release commit.
4. Create and push the matching signed or annotated `vX.Y.Z` tag.
5. The release workflow repeats validation, creates the package archive and checksums, publishes a
   non-prerelease GitHub release, and advances the compatible `vX` Action tag.
6. Install the archive in a clean directory and smoke-test both commands.

The npm registry is not a supported distribution channel until ownership and provenance are
verified. Do not remove `private: true` or advertise `npx maniflight` before that work is complete.
