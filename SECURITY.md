# Security policy

Maniflight inspects repository files and GitHub metadata, so reports can reveal
project structure even when they do not contain source code. Treat reports from
private repositories as private data.

## Supported versions

Security fixes are made against the latest 1.x release and the default branch.
Older major releases may not receive backports.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's **Security → Report a vulnerability** form to open a private security advisory. If the
form is unavailable, email [agrovr.apps@gmail.com](mailto:agrovr.apps@gmail.com) with the subject
`[Maniflight security] Short description`. Include:

- the affected version or commit;
- the operating system and Node.js version;
- a minimal reproduction or proof of concept;
- the impact you observed;
- any suggested mitigation; and
- whether and when you plan to disclose the issue.

Please allow up to five business days for an initial acknowledgement. Do not
send secrets, production tokens, personal data, or private repository contents
unless the maintainer specifically requests a safe transfer method.

## Useful vulnerability classes

Reports are especially helpful when they demonstrate:

- arbitrary code execution or command injection;
- path traversal or writes outside the requested report directory;
- exposure of repository secrets or credentials;
- unsafe handling of pull-request input in the GitHub Action;
- cross-site scripting in the generated HTML report;
- a rule that reads or transmits more data than documented; or
- a dependency vulnerability with a practical Maniflight attack path.

A scanner alert without an affected code path is usually best filed as a
regular dependency-maintenance issue.

## Disclosure and credit

The maintainer will coordinate a fix and disclosure in good faith. Reporter
credit is offered when requested and when doing so is safe. Maniflight does not
currently operate a paid bug-bounty program.
