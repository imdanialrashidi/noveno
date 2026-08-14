# Plan 015: Add npm advisory monitoring (dependabot + CI audit)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- .github/dependabot.yml .github/workflows/quality.yml`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/010-registry-decision-and-integrity.md
  (recommended: the CI audit step needs the npmjs registry flag that plan
  010 documents; it works without it, but the `--registry` flag and the
  `.npmrc` note are the discovered facts this plan relies on)
- **Category**: deps
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

Dependency advisories are unmonitored: `.github/dependabot.yml` covers only
GitHub Actions (no npm ecosystem entry), and CI runs no `npm audit`.
Runtime deps include `@supabase/supabase-js` (runs inside the Pages
Function on the trust boundary) and `astro` — a critical advisory on either
would go unnoticed until someone manually audits. All current deps are
recently-pinned (astro 7.2.0, tailwind 4.3.3, wrangler ^4.120.1, typescript
^5.9), so there is no known-lag problem today — this plan closes the
ongoing-monitoring gap.

**Known constraint (verified)**: `npm audit` fails against the configured
registry (`registry.npmmirror.com` returns `[NOT_IMPLEMENTED]` for the
audit endpoint). Every audit invocation must pass
`--registry=https://registry.npmjs.org` explicitly.

## Current state

- `.github/dependabot.yml` (full file):
  ```yaml
  version: 2
  updates:
    - package-ecosystem: github-actions
      directory: /
      schedule:
        interval: monthly
      open-pull-requests-limit: 5
  ```
- `.github/workflows/quality.yml` — `app` job: `Install app dependencies`
  (`bash scripts/ci-install.sh` → `npm ci`), then `Typecheck (astro check)`,
  `Build`, `Structural + content tests`.
- `package.json` — runtime deps: `@fontsource-variable/estedad`,
  `@fontsource-variable/vazirmatn`, `@supabase/supabase-js`,
  `astro`. Dev deps: `@astrojs/check`, `@cloudflare/workers-types`,
  `@tailwindcss/vite`, `tailwindcss`, `typescript`, `wrangler`.

## Repo conventions to match

- Action pinning: SHA + `# vX.Y.Z` comment (see existing workflow lines).
- Dependabot config: match the existing entry's style (monthly, limit 5).
- CI steps run read-only checks; the audit step must NOT fail the build on
  low-severity noise — but it SHOULD fail on high-severity runtime
  advisories. Decide: run `npm audit --omit=dev` (runtime deps only) as a
  blocking step; dev-only advisories (wrangler, tailwind tooling) are
  surfaced by dependabot PRs instead.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Manual audit (runtime deps) | `npm audit --omit=dev --registry=https://registry.npmjs.org` | exit 0, or advisory output to triage (see STOP conditions) |
| YAML sanity | `python3 -c "import yaml,sys; yaml.safe_load(open('.github/dependabot.yml')); yaml.safe_load(open('.github/workflows/quality.yml')); print('ok')"` | prints `ok` (or use the plan 009 alternative) |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `.github/dependabot.yml`
- `.github/workflows/quality.yml`

**Out of scope** (do NOT touch):
- `package.json` / `package-lock.json` — no dependency changes; if the
  manual audit surfaces a fixable advisory, report it (it may warrant its
  own change) — do not upgrade deps inside this plan.
- The registry decision itself — that is plan 010.
- `.pi/verification.json` — no route change for workflow files.

## Git workflow

- Branch: `improve/015-npm-advisory-monitoring`
- Commit message style (match the repo): `ci: monitor npm runtime advisories (dependabot + audit step)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the npm ecosystem to dependabot

In `.github/dependabot.yml`, append under `updates:`:

```yaml
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 5
```

**Verify**: the YAML sanity command prints `ok`.

### Step 2: Add the audit step to CI

In `.github/workflows/quality.yml`, in the `app` job, after
`Install app dependencies` (before or after `Typecheck` — pick after
install), add:

```yaml
      - name: Audit runtime dependencies
        # npmmirror (committed .npmrc) does not implement the npm audit
        # endpoint — audit explicitly against npmjs. Runtime deps only;
        # dev-tool advisories arrive via dependabot PRs.
        run: npm audit --omit=dev --registry=https://registry.npmjs.org
```

**Verify**: YAML sanity prints `ok`; `git diff .github/workflows/quality.yml` shows only the new step.

### Step 3: Manual audit + full gate

**Verify**: run the manual audit command → exit 0, OR advisory output
(see STOP conditions for how to handle findings); `bash scripts/verify.sh`
→ exit 0.

## Test plan

- No repository tests apply (workflow/dependabot YAML). Verification is the
  YAML sanity check, the manual audit run, and (operator-side) CI green
  after push.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.github/dependabot.yml` contains a `package-ecosystem: npm` entry
- [ ] `.github/workflows/quality.yml` contains the audit step with the npmjs `--registry` flag
- [ ] YAML sanity exits 0
- [ ] `npm audit --omit=dev --registry=https://registry.npmjs.org` runs to completion (exit 0 or findings reported to the operator)
- [ ] `bash scripts/verify.sh` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The manual audit reports a HIGH or CRITICAL advisory affecting a runtime
  dependency (`astro`, `@supabase/supabase-js`, the fontsource packages):
  STOP and report the advisory (name, severity, affected range — no other
  detail needed) so the operator decides on an upgrade; do not upgrade in
  this plan.
- The YAML files at the cited locations differ from the excerpts (drift) —
  reconcile; large drift → STOP.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Dependabot npm PRs must be reviewed with the registry reality in mind:
  the PR bumps `package-lock.json` resolved URLs — if npmjs and npmmirror
  URLs mix, plan 010's lockfile-consistency check will fail red; that is
  the intended signal.
- If the founder's network situation changes (npmjs reachable), plan 010's
  migration path (`.npmrc` + regenerate lockfile) makes the audit step's
  `--registry` flag redundant — remove it in that same change.
- The audit step is deliberately runtime-deps-only; revisit if a dev dep
  (e.g. wrangler) ever carries a HIGH advisory affecting deploys.
