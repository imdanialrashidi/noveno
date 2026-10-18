# Security Policy

## Reporting a vulnerability

Do not open a public issue containing an exploitable vulnerability, secret, private log, or user data. Use the repository's private **Security → Report a vulnerability** flow when available. If private reporting is unavailable, contact the repository owner through a private channel and share only the minimum reproduction needed.

Include the affected version/commit, impact, prerequisites, a minimal reproduction, and any known mitigation. Remove credentials and personal data from evidence.

## Execution boundary

`omp` runs with the operating-system permissions of the account that starts it. Approval tiers, project trust, and prompt allowlists are defense in depth; they are not a sandbox and cannot reliably parse every shell/interpreter behavior or redirect. Real isolation must come from the operating system, container, or VM.

For a trusted working copy, routine implementation runs in the working tree by default (solo, no commit or PR). Only an explicit team-delivery request permits the reviewed `scripts/omp-pr.mjs` helper for a scoped commit/push/PR on the persistent `ai-changes` lane. Main writes, PR merge, and other external actions still need exact owner authorization. Read-only inspection remains available. Never weaken, skip, or delete a valid control or test to obtain green status.

For an untrusted repository, unreviewed third-party instructions, or work exposed to meaningful credentials/private data:

1. Prefer an OS/container/VM boundary with only the required workspace and credentials.
2. Use a simple local Docker boundary for exploration, following the official `omp` container guidance when available.
3. Pass only the provider keys required for the task. Do not mount host credentials, SSH keys, cloud credentials, or the Docker socket into an untrusted boundary.
4. Review the repository, `.omp/skills`, `.omp/commands`, and `scripts/` before trusting them.
5. Review diffs and outputs before copying or deploying them to a trusted/production environment.

The Docker build context, when one is used for exploration, should be reduced to the minimum (never the whole credential-bearing host). At runtime a container filesystem should be read-only where practical, drop Linux capabilities, disable privilege escalation, and apply process/resource limits. Model/API traffic still requires network access; use a policy-controlled sandbox when network/credential egress must be restricted.

Autonomous browsing may navigate public HTTP(S) pages. File upload and arbitrary code execution stay restricted; use isolation when browsing untrusted applications or when egress matters.

## Third-party packages

`omp` itself is one binary; no workflow packages or extensions execute with project privileges. Product dependencies in `package.json` are pinned in `package-lock.json`, but a pin is not a source review. Before updating:

- review the upstream repository, ownership, release diff, install scripts, dependencies, and published integrity;
- test the new pin in a disposable copy/container;
- rerun `bash scripts/verify.sh`.

## Supported versions

Security fixes are applied to the current `main` branch. The repository does not currently publish versioned releases; once releases begin, list supported release lines here.
