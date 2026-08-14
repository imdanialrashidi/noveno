# Plan 010: Commit the registry decision and guard the lockfile against mixed-registry drift

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- package-lock.json .npmrc scripts/verify-package-integrity.mjs README.md`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (touches the dependency workflow; reversible)
- **Depends on**: none
- **Category**: deps
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

Every `resolved` URL in `package-lock.json` points at
`registry.npmmirror.com` (497 entries; zero `registry.npmjs.org` entries;
verified by grep) and there is no `.npmrc` documenting why. Consequences:
(a) the choice is invisible — a future `npm install <new-pkg>` silently
resolves through the mirror and could mix registries in the lockfile;
(b) `npm audit` is IMPOSSIBLE through the configured registry — it returns
`[NOT_IMPLEMENTED] /-/npm/v1/security/*` (verified 2026-08-13) — so anyone
running the default audit gets a hard error with no guidance;
(c) `scripts/verify-package-integrity.mjs` cross-checks only the 8 pinned pi
packages (`.pi/package-integrity.json`), never the app dependency tree.

The mirror is almost certainly deliberate (the founder operates from Iran
where npmjs is slow/flaky; installs work fine). The fix is to make the
decision explicit and machine-checked — NOT to churn the lockfile to npmjs
and break the founder's network reality.

## Current state

- `package-lock.json` — all `resolved` URLs are
  `https://registry.npmmirror.com/...` (verified: 497 vs 0).
- No `.npmrc` in the repo root (verified).
- `scripts/verify-package-integrity.mjs` — verifies the 8 pinned pi
  packages against npm (the `--online` flag) using `.pi/package-integrity.json`;
  it runs in CI (`quality.yml` workflow-doctor job:
  `node scripts/verify-package-integrity.mjs --online`).
- `README.md` — "Canonical commands" section lists the verify commands.
- `.gitignore` — covers `.env*`/`.dev.vars`; `.npmrc` is not ignored (safe to commit).

## Repo conventions to match

- Scripts are plain Node `.mjs` with a module header comment explaining
  purpose (see `scripts/verify-package-integrity.mjs` and
  `scripts/check-project-contract.mjs` — the latter is the model for a
  no-dependency checker: pure `node:fs`/`node:path`, explicit exit codes).
- No new dependencies for tooling (repo convention: "Do not add
  dependencies without a concrete benefit").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Integrity script (offline checks) | `node scripts/verify-package-integrity.mjs` | exit 0 |
| Integrity script (online) | `node scripts/verify-package-integrity.mjs --online` | exit 0 (needs network; skip-gated like existing usage) |
| Typecheck | `npm run check` | exit 0 |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `.npmrc` (create)
- `scripts/verify-package-integrity.mjs`
- `README.md` (one short note in the Canonical commands section)

**Out of scope** (do NOT touch):
- `package-lock.json` — regenerating against npmjs is explicitly rejected
  (founder network reality); the lockfile is healthy as-is.
- `.github/workflows/quality.yml` — CI already invokes the integrity script;
  no workflow change here.
- Adding `npm audit` to CI — that is plan 015 (which depends on this plan's
  registry documentation for its `--registry` flag).

## Git workflow

- Branch: `improve/010-registry-decision`
- Commit message style (match the repo): `chore(deps): commit the npmmirror registry decision and guard lockfile consistency`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Commit `.npmrc` documenting the registry

Create `.npmrc` in the repo root:

```
# Package registry pinned for this repository.
# The lockfile resolves every package through npmmirror — a deliberate
# choice for the founder's network (Iran): npmjs is slow/unreliable there,
# the mirror is fast. Do not silently add a second registry.
# NOTE: npmmirror does not implement the npm audit endpoint — run advisory
# checks explicitly against npmjs:
#   npm audit --omit=dev --registry=https://registry.npmjs.org
registry=https://registry.npmmirror.com
```

**Verify**: `git status` shows `.npmrc` as an untracked new file; `npm run check` exits 0 (unaffected).

### Step 2: Add the lockfile-consistency check to the integrity script

In `scripts/verify-package-integrity.mjs`, add a check that runs WITHOUT
`--online` (pure local):

1. Read `.npmrc` from the repo root and extract its `registry=` value
   (fallback: if absent, default to `https://registry.npmjs.org` and note it).
2. Read `package-lock.json`; collect the distinct URL origins of every
   `resolved` field (walk `packages.*`).
3. Fail (exit 1 with a clear message) if any resolved origin differs from
   the `.npmrc` registry origin — except `https://registry.npmjs.org`, which
   is allowed only when `.npmrc` declares it. Message style matches the
   script's existing output (e.g. `FAIL  lockfile: resolved URL
   https://other.example/... does not match registry in .npmrc`).
4. Print a one-line `ok` summary when consistent.

Keep the existing pi-package online verification untouched.

**Verify**: `node scripts/verify-package-integrity.mjs` → exit 0 with the
new lockfile line printed. Negative check: temporarily edit the check to
expect `https://registry.npmjs.org` (or run against a scratch copy) → it
must fail with the new message; then restore. (Do this with a scratch copy
in /tmp, not by editing the lockfile.)

### Step 3: Document the registry and the audit workaround in README

In `README.md`, under "Canonical commands", add a short note:

```markdown
Dependency registry: `registry.npmmirror.com` via committed `.npmrc`
(deliberate Iran-network choice; lockfile consistency is CI-checked by
`node scripts/verify-package-integrity.mjs`). `npm audit` is unavailable on
the mirror — run `npm audit --omit=dev --registry=https://registry.npmjs.org`.
```

**Verify**: `node scripts/check-project-contract.mjs` → exit 0 (README
markers `Noveno` preserved); `node --test tests/project-contract.test.mjs` → pass.

### Step 4: Full verification

**Verify**: `bash scripts/verify.sh` → exit 0.

## Test plan

- No new test file: the consistency check lives in the script that CI
  already runs (`quality.yml` workflow-doctor). Extend nothing else.
- If the script has an existing unit test (check `tests/` for imports of
  `verify-package-integrity` — if one exists, add a case for the new check
  following its pattern; if not, the script-level verification above is the
  guard).
- Manual negative-path evidence: the scratch-copy check from Step 2
  (record the failing output in the commit message/report).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.npmrc` committed with the registry line and the audit note
- [ ] `node scripts/verify-package-integrity.mjs` exits 0 and prints the lockfile-consistency result
- [ ] `node scripts/check-project-contract.mjs` exits 0
- [ ] `bash scripts/verify.sh` exits 0
- [ ] `grep -n "npmmirror" README.md` → the note is present
- [ ] `git status` shows no modified files beyond the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The lockfile contains a MIXED set of registries already (check first:
  `grep -o 'https://[^/]*' package-lock.json | sort | uniq -c`) — if npmjs
  URLs are already present, the plan's "all npmmirror" premise is false;
  report the actual distribution and do not pick a winner unilaterally.
- The integrity script's existing structure makes the new check awkward
  (e.g. it exits early in offline mode) — report the conflict rather than
  restructuring the whole script.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Plan 015 (npm advisory monitoring) builds on this: its CI audit step must
  pass `--registry=https://registry.npmjs.org` (documented in `.npmrc`).
- If the founder ever migrates to npmjs (better connectivity), the change is
  deliberate and two-part: update `.npmrc` AND regenerate the lockfile —
  the consistency check then passes for the new registry and fails for the
  old one, which is exactly the drift protection intended.
- New contributors on other networks will download from npmmirror (China
  mirror) — usually fast globally; if latency is ever an issue, `npm ci
  --registry=https://registry.npmjs.org` overrides per-invocation.
