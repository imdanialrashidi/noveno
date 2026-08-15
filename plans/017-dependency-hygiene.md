# Plan 017: Dependency hygiene — fontsource → devDependencies, drop vestigial workers-types

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- package.json src/ tsconfig.json`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/016-sitemap-content-layer.md (already applied — `yaml` was added to dependencies; this plan's package.json edits must preserve it)
- **Category**: dependencies
- **Planned at**: commit `13ef792`

## Why this matters

`package.json` lists `@fontsource-variable/estedad` and
`@fontsource-variable/vazirmatn` under `dependencies`, but nothing imports
them — the shipped fonts are committed woff2 files under `public/fonts/`
with hand-written `@font-face` rules in `src/styles/global.css`, and nothing
documents how the committed files stay in sync with the packages. They are
a manual asset *source* (licenses), not a runtime dependency. Separately,
`@cloudflare/workers-types` is a direct devDependency that nothing
references (`tsconfig.json` has no `types` entry for it; `functions/`
declares its own `AuditEnv`); wrangler already pulls it transitively. This
plan: move the font packages to devDependencies (they remain available for
future re-extraction, zero runtime impact), drop the vestigial
workers-types direct dep, and document the font-sync contract in the README.

## Current state

- `package.json:22-24`:
  ```json
  "dependencies": {
    "@fontsource-variable/estedad": "5.3.0",
    "@fontsource-variable/vazirmatn": "5.3.0",
    "@supabase/supabase-js": "^2.112.3",
    "astro": "7.2.0",
    "yaml": "<version added by plan 016>"
  }
  ```
  (order may differ; `yaml` is present after plan 016).
- `package.json:29-30` — devDependencies include
  `"@cloudflare/workers-types": "^5.20260811.1"`.
- `src/styles/global.css:20-59` — hand-written `@font-face` for the
  committed woff2 files; `public/fonts/` holds the actual files.
- `tsconfig.json` — no `types` field referencing workers-types; check
  `astro check` output before/after.
- README.md — has a "Tech stack" section; no font-sync note.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Grep imports | `grep -rn "fontsource" src/ scripts/ tests/` | no matches |
| Grep types | `grep -rn "workers-types\|PagesFunction" src/ functions/ tsconfig.json` | no matches in src/functions/tsconfig |
| Check      | `npm run check`             | exit 0 |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

If `npm ci` fails with a package.json/lockfile mismatch after the edits,
use `npm install` (plan 006 regenerates the lockfile afterward) — do not
hand-edit the lockfile.

## Scope

**In scope**:
- `package.json`
- `README.md` (one short note)

**Out of scope** (do NOT touch):
- `package-lock.json` (plan 006 regenerates it last)
- `public/fonts/**`, `src/styles/global.css` — the committed fonts and
  @font-face rules stay exactly as they are
- `src/`, `functions/`, `tsconfig.json`
- Any other file.

## Git workflow

- Commit once at the end:
  `chore(deps): fontsource → devDependencies, drop vestigial workers-types direct dep`
- Do NOT push or open a PR.

## Steps

### Step 1: Verify nothing imports them

**Verify**: `grep -rn "fontsource" src/ scripts/ tests/` → no matches;
`grep -rn "workers-types\|PagesFunction" src/ functions/ tsconfig.json` → no matches (the `AuditEnv` type in `functions/lib/contract.ts` is the local one — that does not match `PagesFunction`).

### Step 2: Edit package.json

1. Move both `@fontsource-variable/*` entries from `dependencies` to
   `devDependencies` (keep exact versions `5.3.0`).
2. Remove `@cloudflare/workers-types` from `devDependencies`.

Do not change anything else. Keep `yaml` where plan 016 put it.

**Verify**: `node -e "const p=require('./package.json'); console.log(p.dependencies, p.devDependencies)"` → font packages under devDependencies, no workers-types, yaml still under dependencies.

### Step 3: Prove green

**Verify**: `npm run check` → exit 0 (no type breakage from dropping
workers-types). `npm run build` → exit 0. `npm test` → all pass.

### Step 4: Document the font-sync contract

In `README.md`, in or near the "Tech stack" section, add one short
paragraph (Persian/English mix consistent with the file's style):

> **Fonts:** the shipped woff2 files under `public/fonts/` are the source of
> truth (declared via hand-written `@font-face` in `src/styles/global.css`,
> DESIGN §5.4). The `@fontsource-variable/*` devDependencies exist only as
> the licensed extraction source for replacing those files — a font change
> is a deliberate file replacement (rename to bump the immutable cache),
> not a dependency bump.

**Verify**: `grep -n "public/fonts" README.md` → the new note present.

## Test plan

- No new tests — `npm run check`/`build`/`test` are the gates; the grep
  checks in Step 1 pin the "nothing imports these" fact.

## Done criteria

- [ ] `grep -rn "fontsource" src/ scripts/ tests/` → no matches
- [ ] `node -e "..."` shows fontsource under devDependencies and no workers-types
- [ ] `npm run check`, `npm test`, `npm run build` all pass
- [ ] README contains the font-sync note
- [ ] `git status --porcelain` shows only package.json + README.md modified (plus untracked plans/ which is expected)

## STOP conditions

Stop and report back (do not improvise) if:

- Any import of `fontsource` or `workers-types`/`PagesFunction` exists
  (Step 1 finds matches) — report; do not remove the packages.
- `npm run check` breaks after dropping workers-types — report the errors;
  if a `types` entry is genuinely needed, restore the dep and report instead
  of improvising a tsconfig change.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- A future font replacement: re-extract from the devDependency packages,
  commit new woff2 files under a NEW filename, update `@font-face` — the
  dependency version itself never needs to change for a runtime effect.
- Plan 006 (lockfile regeneration) must run after this plan so the
  lockfile reflects the package.json changes.
- Reviewer should scrutinize: nothing else in package.json changed, and the
  README note matches the file's existing voice.
