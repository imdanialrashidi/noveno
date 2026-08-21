# Plan 007: Repo hygiene (purge committed backup copies, add .editorconfig, single canonical origin)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- .noveno-backups astro.config.mjs scripts/generate-sitemap.mjs src/pages/rss.xml.ts scripts/lib`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (008 reuses the `.editorconfig` from here)
- **Category**: tech-debt / dx
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

1. `.noveno-backups/portfolio-20260814-213740/` is TRACKED in git: stale copies of
   `src/data/work-previews.ts`, `src/pages/work/[slug].astro`, and an old `public/sitemap.xml`.
   It is not gitignored, confuses audits and discovery agents, and risks old URLs/content being
   resurrected by a careless copy or glob. The backup instinct was right; committing it wasn't.
2. No `.editorconfig`: editors fall back to personal defaults on a 16k-line TS repo.
3. The canonical site origin is hardcoded as the fallback string `"https://noveno.ir"` in three
   independent places (`astro.config.mjs`, sitemap generator, RSS endpoint). A domain change
   requires a three-file lockstep edit and silent divergence is possible.

## Current state

### Tracked backups (verified)

```
$ git ls-files .noveno-backups
.noveno-backups/portfolio-20260814-213740/public/sitemap.xml
.noveno-backups/portfolio-20260814-213740/src/data/work-previews.ts
.noveno-backups/portfolio-20260814-213740/src/pages/work/[slug].astro
```

`.gitignore` has no entry for `.noveno-backups`. Before deleting, run
`git log --oneline -- .noveno-backups` to record when/why it landed (context for the commit
message only).

### Origin hardcodes (verified)

```js
// astro.config.mjs:10
site: process.env.PUBLIC_APP_URL ?? "https://noveno.ir",
// scripts/generate-sitemap.mjs:29
const SITE = process.env.PUBLIC_APP_URL ?? "https://noveno.ir";
// src/pages/rss.xml.ts:10
site: context.site ?? new URL("https://noveno.ir"),
```

`scripts/lib/` already exists as the home for shared Node-side modules
(`scripts/lib/workflow-evals.mjs`). Plain `.mjs` modules there are importable from
`astro.config.mjs` (Node ESM), from other build scripts, AND from bundled TS like
`rss.xml.ts` (Vite handles `.mjs` imports natively).

### Repo conventions

- Shared Node modules live under `scripts/lib/*.mjs`; named exports.
- `.gitignore` groups entries with section comments ("Secrets", "Build, test…").
- CHANGELOG records notable workflow changes.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Sitemap tests | `node --test tests/sitemap-parser.test.mjs tests/seo-contract.test.mjs` | all pass |
| RSS check | `grep -n "noveno.ir" dist/rss.xml` after build | https origin present |
| Full suite (after build) | `npm test` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

Run `npm run build` before test suites that read `dist/`.

## Scope

**In scope**:
- `git rm -r .noveno-backups` + one `.gitignore` line
- `.editorconfig` (NEW)
- `scripts/lib/site-origin.mjs` (NEW)
- `astro.config.mjs`, `scripts/generate-sitemap.mjs`, `src/pages/rss.xml.ts`
- `CHANGELOG.md`
- `plans/README.md` — status row

**Out of scope**:
- Any other `.env`/secret handling; `docs/private/**` policy.
- Changing how `PUBLIC_APP_URL` is consumed at runtime (BaseLayout metadata etc.).
- `_redirects`, `_headers`.

## Git workflow

- Branch: `improve/007-repo-hygiene`
- Conventional commits:
  - `chore: drop committed .noveno-backups copies and ignore the path`
  - `chore(dx): add .editorconfig`
  - `refactor(config): single-source the canonical origin fallback`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Purge the committed backups

```bash
git log --oneline -- .noveno-backups        # note provenance for the message
git rm -r .noveno-backups
printf '\n# Local backup snapshots\n.noveno-backups/\n' >> .gitignore
```

Place the ignore entry under the existing "Build, test, browser, and framework output" or a new
adjacent comment block — match file style.

**Verify**: `git ls-files .noveno-backups | wc -l` → 0; `bash -n .gitignore` isn't a thing — instead `git check-ignore .noveno-backups/x` → exits 0.

### Step 2: Add `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.py]
indent_size = 4
```

(Persian text files are UTF-8 already; markdown trailing whitespace can be significant for
line-breaks.)

**Verify**: file exists at repo root; no tooling change required.

### Step 3: Single-source the origin fallback

Create `scripts/lib/site-origin.mjs`:

```js
/** Canonical public origin fallback when PUBLIC_APP_URL is unset.
 *  Consumed by astro.config.mjs (Astro `site`), generate-sitemap.mjs, and rss.xml.ts.
 *  A domain change edits exactly this line. */
export const FALLBACK_SITE_ORIGIN = "https://noveno.ir";
```

Then in each consumer replace the literal:

- `astro.config.mjs`: `import { FALLBACK_SITE_ORIGIN } from "./scripts/lib/site-origin.mjs";`
  → `site: process.env.PUBLIC_APP_URL ?? FALLBACK_SITE_ORIGIN,`
- `scripts/generate-sitemap.mjs`: same import style (relative `./lib/site-origin.mjs`) →
  `const SITE = process.env.PUBLIC_APP_URL ?? FALLBACK_SITE_ORIGIN;`
- `src/pages/rss.xml.ts`: `import { FALLBACK_SITE_ORIGIN } from "../../scripts/lib/site-origin.mjs";`
  → `site: context.site ?? new URL(FALLBACK_SITE_ORIGIN),`

**Verify**: `npm run check && npm run build` → exit 0;
`grep -rn '"https://noveno.ir"' astro.config.mjs scripts/generate-sitemap.mjs src/pages/rss.xml.ts` → only the lib file matches repo-wide:
`grep -rln '"https://noveno.ir"' --include='*.ts' --include='*.mjs' . | grep -v node_modules | grep -v dist` → exactly `scripts/lib/site-origin.mjs`.

### Step 4: Prove built output unchanged

```bash
npm run build
grep -n "<loc>" dist/sitemap.xml | head -3      # origins render as configured
head -5 dist/rss.xml                            # origin intact
node --test tests/sitemap-parser.test.mjs tests/seo-contract.test.mjs tests/blog.test.mjs
```

All pass; URLs identical to pre-change output (spot-check `/blog/<slug>` entries).

## Test plan

No new test files warranted (the grep-based done criteria plus the sitemap/SEO suites cover the
contract; adding a test importing a config constant would pin trivia). If `tests/site-data.test.mjs`
already asserts origin strings anywhere, keep it green.

## Done criteria

ALL must hold:

- [ ] `git ls-files .noveno-backups | wc -l` → 0 and the path is ignored
- [ ] `.editorconfig` present with the content above
- [ ] Origin literal exists only in `scripts/lib/site-origin.mjs` (repo-wide grep excluding node_modules/dist)
- [ ] Fresh build passes; sitemap/RSS suites pass; `bash scripts/verify.sh` exits 0
- [ ] CHANGELOG entry added
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Anything under `.noveno-backups/` differs materially from its tracked state (uncommitted local
  edits) — surface before deleting.
- `astro.config.mjs` cannot import the lib module in the pinned Node version (ESM resolution
  failure) — report rather than inlining a second constant.
- Sitemap/RSS output changes byte-wise beyond what env differences explain.

## Maintenance notes

- Domain migration becomes: edit one line + set `PUBLIC_APP_URL` in Pages. Mention this file in
  any future DNS/domain runbook.
- Reviewers should confirm the deletion commit contains ONLY `.noveno-backups` paths.
