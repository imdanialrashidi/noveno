# Plan 019: Remove the unreferenced `@cloudflare/workers-types` devDependency

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- package.json package-lock.json tsconfig.json`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: deps
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

`@cloudflare/workers-types` is declared in `package.json` but never
imported anywhere (verified: mentions only in `package.json` and
`package-lock.json`) and `tsconfig.json` has no `"types"` field wiring it
in. `functions/*.ts` type against the DOM lib plus locally-defined
`AuditEnv`/context interfaces, and wrangler is used only for local `wrangler
pages dev` (documented in `docs/ops/setup-checklist.md` §5). The dead
devDependency adds install weight and a drift surface — and worse, it
creates the false impression that Pages Function globals ARE type-checked
when they are not (if workers types were ever needed, the missing wiring
means they aren't guarding anything). Remove it; wiring it in properly is
the rejected alternative (the project's local interfaces are deliberate —
see `functions/lib/contract.ts` `AuditEnv`).

## Current state

- `package.json:27` (devDependencies):
  ```json
  "@cloudflare/workers-types": "^5.20260811.1",
  ```
- `tsconfig.json` — `extends: "astro/tsconfigs/strict"`, no `types` field.
- `package-lock.json` — the package's lockfile entry (and its transitive
  deps).
- Registry reality (plan 010): the lockfile resolves through
  `registry.npmmirror.com`; `npm uninstall` must not fight that (it won't —
  it edits the lockfile in place using existing resolution data).

## Repo conventions to match

- No dependency changes without a concrete benefit (CONTRIBUTING); removal
  of a dead dep is such a change — keep the diff to exactly this.
- Lockfile changes go through `npm` (never hand-edit `package-lock.json`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Remove dep | `npm uninstall --save-dev @cloudflare/workers-types` | exit 0 |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |
| Integrity | `node scripts/verify-package-integrity.mjs` | exit 0 (plan 010's lockfile check, if landed, passes with the same registry) |
| Affected route | `node scripts/verify-affected.mjs --file package.json` | routes (app lane) |

## Scope

**In scope** (the only files you should modify):
- `package.json`
- `package-lock.json`

**Out of scope** (do NOT touch):
- `tsconfig.json` — adding `"types": ["@cloudflare/workers-types"]` is the
  rejected alternative (the project deliberately defines its own env
  interfaces); if a future contributor wants real Workers types, that is a
  separate decision with its own review.
- `functions/**` — no code changes; `npm run check` proves nothing needed
  the types.
- Any other dependency.

## Git workflow

- Branch: `improve/019-remove-workers-types`
- Commit message style (match the repo): `chore(deps): remove unreferenced @cloudflare/workers-types`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Uninstall

Run `npm uninstall --save-dev @cloudflare/workers-types` (uses the
configured registry for metadata only; the lockfile is edited in place).

**Verify**: `grep -n "workers-types" package.json package-lock.json` → no matches; `git diff --stat` shows only the two manifest files.

### Step 2: Verify nothing depended on the types

**Verify**: `npm run check` → exit 0 (astro check + tsc over
`functions/**` — if the functions compiled without the package before,
they compile now; any type error here means the excerpt premise was wrong
→ STOP); `npm run test` → all pass; `npm run build` → exit 0.

### Step 3: Integrity + full gate

**Verify**: `node scripts/verify-package-integrity.mjs` → exit 0;
`bash scripts/verify.sh` → exit 0 (canonical full gate).

## Test plan

- No new tests — this is a manifest change proven by the compile/test
  gates above (the app lane in `.pi/verification.json` runs check + build +
  structural/seo/content/retry tests for `package.json` changes).
- Grep guard: `grep -rn "workers-types" . --include="*.ts" --include="*.mjs" --include="*.astro" --include="*.json" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.pi` → no matches.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm uninstall` completed; `grep -n "workers-types" package.json package-lock.json` → no matches
- [ ] `npm run check` exits 0; `npm run test` exits 0; `npm run build` exits 0
- [ ] `bash scripts/verify.sh` exits 0
- [ ] `git status` shows only `package.json` + `package-lock.json` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run check` fails after the removal (the premise "never imported"
  was wrong — restore the package with `npm install --save-dev
  @cloudflare/workers-types` and report; do not add a `types` wiring as a
  workaround).
- `npm uninstall` reports registry/network errors twice — report rather
  than hand-editing the lockfile.
- The manifest files at the cited locations differ from the excerpts
  (drift) — reconcile.

## Maintenance notes

- If Pages Function typing is ever wanted for real, the decision is:
  define a `functions/tsconfig.json` with `"types":
  ["@cloudflare/workers-types"]` (or keep local interfaces) — either way
  the `AuditEnv` interface in `functions/lib/contract.ts` remains the
  runtime contract the tests pin; keep the two in agreement.
- This removal is independent of plan 010's registry work; if 010 landed
  first, the integrity script's lockfile check simply sees one fewer
  package — no interaction.
