# Plan 008: Formatting baseline (Prettier with the Astro plugin, enforced in CI)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- package.json .prettierrc* .prettierignore .github/workflows/quality.yml README.md`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (mostly the one-time normalize diff)
- **Risk**: MED on the normalize commit (large but mechanical); LOW afterwards
- **Depends on**: plans/006-build-pipeline-efficiency.md (clean official-registry lockfile BEFORE adding devDeps); benefits from 007's `.editorconfig`
- **Category**: dx
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

A ~16k-line TypeScript/Astro repository has **no formatter, no linter, and no style
enforcement** — `package.json` scripts are only dev/prebuild/build/check/test/ci, and no eslint/
biome/prettier/editorconfig/husky config exists anywhere (verified). Every gate is blind to style
drift across 20 test suites, 60+ components, and two serverless endpoints; reviewers and agents
absorb formatting noise in every diff. This plan adds a single, low-churn formatting lane and
enforces it where CI can fail loudly — without touching the existing `astro check`/test lanes or
the pinned gate order.

**Tool choice rationale**: Prettier + `prettier-plugin-astro` is the Astro project's documented
standard and formats `.astro`, `.ts`, `.mjs`, `.css`, `.md` with one tool. Biome was considered
and rejected: no stable `.astro` support at decision time. ESLint was considered and rejected for
now: higher config burden, overlapping with `astro check`; revisit only if bug-class lint rules
(react-hooks equivalents etc.) become relevant — they don't for framework-free TS.

## Current state

- `package.json` devDependencies: `@astrojs/check 0.9.10`, tailwind 4.3.3, typescript ^5.9,
  wrangler ^4.120.1, fontsource packages. No prettier direct dep (it appears only transitively via
  `@astrojs/check`).
- Repo line width skews wide (several >100-char lines in TS sources), so the baseline below sets
  `printWidth: 110` rather than the default 80 to keep the normalize diff honest.
- CI (`.github/workflows/quality.yml`) runs ci-install → verify.sh → verify-package-integrity.
  `scripts/verify.sh` runs its `format:check` fallback ONLY when a `check` script is absent —
  this repo HAS `check`, so verify.sh would never run format checks; enforcement must live in the
  workflow itself.
- CONTRIBUTING requires workflow changes to update doctor assertions/integrity records when
  material — adding an independent workflow step does not alter verify.sh's pinned contract
  (`tests/gate-order.test.mjs` keeps passing untouched).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Format write (once) | `npx prettier --write .` | exit 0 |
| Format check | `npm run format:check` | exit 0 |
| Typecheck | `npm run check` | exit 0 (unchanged) |
| Full suite (after build) | `npm test` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `package.json` / `package-lock.json` — devDeps (`prettier`, `prettier-plugin-astro`), scripts
  `format`, `format:check`
- `.prettierrc.json` (NEW), `.prettierignore` (NEW)
- `.github/workflows/quality.yml` — one new step
- `README.md` verification-lanes section — document the new lane
- `CHANGELOG.md`
- ALL files reformatted by the one-time `--write` pass (mechanical)
- `plans/README.md` — status row

**Out of scope**:
- Any semantic edit hidden inside the formatting commit (zero behavioral changes allowed).
- Adding ESLint/biome/husky/pre-commit hooks (explicitly deferred).
- Reformatting generated files (`src/generated/image-manifest.ts`) — ignored.
- Changing `scripts/verify.sh` (its fallback branch stays as-is).

## Git workflow

- Branch: `improve/008-formatting-baseline`
- Commits, strictly separated:
  1. `chore(dx): add prettier + astro plugin, config, ignore, scripts`
  2. `style: normalize tree with prettier (no semantic changes)` ← the big one
  3. `ci: enforce format:check` (+ docs/changelog)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the toolchain and config

```bash
npm install --save-dev prettier prettier-plugin-astro
```

`.prettierrc.json`:

```json
{
  "printWidth": 110,
  "plugins": ["prettier-plugin-astro"]
}
```

(Defaults otherwise: semicolons on — matching current TS sources — double quotes per existing
style, trailing commas es5 default.)

`.prettierignore`:

```
package-lock.json
dist/
node_modules/
.artifacts/
.noveno-backups/
src/generated/image-manifest.ts
public/
CHANGELOG.md
```

(`public/` contains only static assets; CHANGELOG's authored list formatting stays hand-curated.)

`package.json` scripts:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

**Verify**: `npm run format:check` → exits non-zero (dirty tree) — expected pre-normalization.

### Step 2: One-time normalization

```bash
npx prettier --write .
npm run check && npm run build && npm test
```

Inspect `git diff --stat`: expect broad but shallow changes. Then PROVE zero semantic drift:

- `git diff -w --stat` shows the same files (whitespace-only differences collapse);
- spot-read 3–5 of the largest diffs (e.g. `tests/audit-retry.test.mjs`,
  `src/scripts/audit/index.ts`) confirming only formatting;
- full gates green (commands above).

**Verify**: all three commands exit 0; `git status` clean post-commit.

### Step 3: Enforce in CI

In `.github/workflows/quality.yml`, insert after `ci-install.sh` and before `verify.sh`:

```yaml
      - name: Check formatting
        run: npm run format:check
```

**Verify**: YAML parses (next CI run is the real proof — note that honestly); locally
`npm run format:check` exits 0 on the normalized tree.

### Step 4: Document

- README "Verification lanes" section: add one bullet — `npm run format:check` (also enforced in
  CI) with the one-line policy "formatting is mechanical; never hand-fix format-only feedback".
- CHANGELOG entry under Unreleased → Added.

## Test plan

No new tests (the check command IS the test). The critical regression risk — semantic drift in
the normalize commit — is covered by the `-w` diff inspection plus the full gate in Step 2.

## Done criteria

ALL must hold:

- [ ] `npm run format:check` exits 0 on a clean checkout
- [ ] quality.yml contains the formatting step between install and verify
- [ ] `git log` shows the tooling commit and the normalize commit SEPARATELY
- [ ] `git diff <pre-plan-sha>..HEAD -w --stat` vs `git diff <pre-plan-sha>..HEAD --stat` differ
      only by whitespace-collapsed lines (sanity check recorded in the PR description)
- [ ] `npm run check`, `npm run build`, `npm test`, `bash scripts/verify.sh` all exit 0
- [ ] README + CHANGELOG updated; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The normalize pass produces a diff in any file under `functions/api/` or
  `src/scripts/audit/` that is NOT explainable by whitespace/quoting/wrapping (read carefully —
  these are the trust boundary).
- `prettier-plugin-astro` cannot parse any `.astro` file (syntax edge case) — exclude that file
  in `.prettierignore` with a comment and report it.
- Formatting changes any built output byte-wise beyond minification-invariant reordering
  (`astro check`/build/tests catch most; compare `dist/` HTML hashes pre/post if in doubt).
- Adding devDeps fails the online package-integrity checker (registry/pin interaction from 006).

## Maintenance notes

- Future dependency additions must not bypass `.npmrc`/integrity checks (see plan 006).
- If the team later wants lint rules, layer them separately; do NOT grow this config into a
  linter.
- Reviewers should reject any PR mixing semantic edits into `style:` commits — that discipline is
  the whole point of the separate commits.
