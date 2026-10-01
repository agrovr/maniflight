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
6. The same workflow publishes that exact archive to the npm registry through
   [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no long-lived npm token is
   stored and every version carries a provenance attestation linking it to this repository and
   workflow run.
7. Install the published package in a clean directory and smoke-test both commands.

## Distribution

Maniflight is published to the npm registry as [`maniflight`](https://www.npmjs.com/package/maniflight).
Each GitHub release also attaches the identical `.tgz` archive with a `SHA256SUMS` file for
installs that should not depend on the registry. Verify a registry install's provenance with
`npm audit signatures`.
