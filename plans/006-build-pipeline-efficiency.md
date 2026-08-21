# Plan 006: Build pipeline efficiency (CI cache, single-registry lockfile, no double-shipped images)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- .github/workflows/quality.yml package-lock.json scripts/build-image-manifest.mjs scripts/optimize-work-previews.py tests/image-manifest.test.mjs`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (Part C is the bulk)
- **Risk**: LOW for A/B, MED for C (touches the image pipeline contract)
- **Depends on**: none. **Must land before plan 008** (formatting adds devDependencies — the
  registry should be clean first).
- **Category**: dx / perf / deps
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

1. **CI pays a cold full gate every push** inside a tight 10-minute ceiling: plain `npm ci` of the
   Astro 7 + Tailwind 4 tree (~250 packages), then build + doctor + typecheck, with no npm cache.
   A slow mirror day takes the lane to timeout.
2. **The lockfile has regressed to mixed registries.** 9 `resolved` URLs point at
   `registry.npmmirror.com` while 488 point at `registry.npmjs.org` (a prior cycle fixed this once
   already). The local machine's global npm config also points at the mirror — which does not
   implement `/-/npm/v1/security/*`, so `npm audit` FAILS outright in that environment,
   leaving dependency posture unverifiable. Integrity hashes still pin content, but auditability
   and reproducibility suffer, and any future install run on a mirror-configured machine re-pollutes.
3. **Every image deploys twice.** `scripts/build-image-manifest.mjs` materializes the hashed copy
   _next to_ the logical source inside `public/images/`, and Cloudflare Pages copies `public/`
   wholesale into the deployment. Only hashed URLs are ever referenced; the logical copies ship as
   dead, immutable-cached weight in every deploy.

## Current state

### CI workflow — `.github/workflows/quality.yml`

Steps: checkout → `actions/setup-node` (node 22.23.2, **no `cache:` input**) →
`bash scripts/ci-install.sh` (plain `npm ci`) → `bash scripts/verify.sh` →
`node scripts/verify-package-integrity.mjs --online`. Job-level `timeout-minutes: 10`.

### Lockfile state (verified at planning time)

```
$ grep -c "registry.npmmirror.com" package-lock.json   → 9
$ grep -c "registry.npmjs.org" package-lock.json       → 488
$ npm config get registry                              → https://registry.npmmirror.com/
```

No project `.npmrc` exists. Ranged dependencies present: `typescript ^5.9.0`, `yaml ^2.9.0`,
`wrangler ^4.120.1`, `@astrojs/rss ^4.0.19` (exact pins: astro 7.2.0, check 0.9.10, tailwind
4.3.3, fontsource 5.3.0).

### Image manifest — `scripts/build-image-manifest.mjs`

Header comment: "materializing a hashed copy next to the logical file:
`public/images/photography/hero-1600.avif` → `public/images/photography/hero-1600.<sha256-8>.avif`".
Key constants:

```js
const ROOT = new URL("..", import.meta.url).pathname;
const IMAGES_DIR = join(ROOT, "public", "images");
const OUT = join(ROOT, "src", "generated", "image-manifest.ts");
const HASHED_RE = /\.[0-9a-f]{8}\.(avif|webp|png|jpe?g)$/;
```

It walks `IMAGES_DIR`, treats non-hashed files as logical sources, copies each to its hashed twin,
and writes the manifest module. Pruning only removes hashed files whose base name matches a
logical file in the same directory (founder-named lookalikes are never pruned).

Downstream consumers of the logical paths:

- `scripts/optimize-work-previews.py` — writes WebP pairs INTO `public/images/work/`.
- `scripts/refresh-portfolio-previews.sh` — refreshes live-site captures (read it before Part C).
- `docs/IMAGERY.md`, README §4–5 — document the pipeline ("capture … optimize … reference via
  imageUrl()").
- `tests/image-manifest.test.mjs` — pins manifest behavior incl. prune rules.

### Repo conventions

- Workflow changes must keep `.pi/verification.json` lanes truthful and update CHANGELOG
  (`CONTRIBUTING.md`).
- `verify-package-integrity.mjs --online` validates pins against the official registry — your
  lockfile regeneration MUST leave it green.

## Commands you will need

| Purpose                  | Command                                              | Expected on success          |
| ------------------------ | ---------------------------------------------------- | ---------------------------- |
| Manifest script          | `node scripts/build-image-manifest.mjs`              | exit 0, regenerates manifest |
| Image tests              | `node --test tests/image-manifest.test.mjs`          | all pass                     |
| Build                    | `npm run build`                                      | exit 0                       |
| Full suite (after build) | `npm test`                                           | all pass                     |
| Package integrity        | `node scripts/verify-package-integrity.mjs --online` | exit 0                       |
| Audit (after Part B)     | `npm audit`                                          | exit 0 or actionable report  |
| Full gate                | `bash scripts/verify.sh`                             | exit 0                       |

## Scope

**In scope**:

- `.github/workflows/quality.yml`
- `.npmrc` (NEW), `package-lock.json`
- `scripts/build-image-manifest.mjs`, `scripts/optimize-work-previews.py`,
  `scripts/refresh-portfolio-previews.sh`
- `assets/images/**` (NEW location for logical sources), `public/images/**` (hashed outputs only after migration)
- `src/generated/image-manifest.ts` (regenerated artifact)
- `tests/image-manifest.test.mjs`, fixtures under `tests/` if they stage images
- `README.md` §4–5 image bullets, `docs/IMAGERY.md` path references
- `CHANGELOG.md`
- `plans/README.md` — status row

**Out of scope**:

- Any change to `imageUrl()` semantics, hashing scheme, or `_headers` caching policy.
- Replacing Python OG rendering (plan 012 owns that decision).
- Adding/removing runtime dependencies.
- Splitting verify.sh or changing gate order (`tests/gate-order.test.mjs` pins it).

## Git workflow

- Branch: `improve/006-build-pipeline`
- Conventional commits per part:
  - `ci: cache npm deps and raise the ceiling`
  - `chore(deps): pin official registry via .npmrc; relock without mirror URLs`
  - `build(images): serve only content-hashed copies; move sources out of public/`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Part A — CI cache + headroom

In `.github/workflows/quality.yml`:

```yaml
- name: Set up Node
  uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
  with:
    node-version: 22.23.2
    cache: npm
```

and raise `timeout-minutes: 10` → `15` with a comment: "headroom so a cold-cache day fails loudly
on real errors, not the ceiling".

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('.github/workflows/quality.yml','utf8'))"` — wait, YAML ≠ JSON; instead validate by inspection plus `bash -n` on referenced shell scripts is unrelated. Acceptable verification: run `act` if available; otherwise confirm the action input name against setup-node docs (`cache: npm`) and rely on the next CI run. Record "verified on next CI run" honestly in the PR description.

### Part B — Single registry

1. Create `.npmrc` at repo root:

```
# Pin installs to the official registry: mirror configs (global ~/.npmrc)
# break `npm audit` (/-/npm/v1/security/*) and pollute resolved URLs.
registry=https://registry.npmjs.org/
```

2. Regenerate the lockfile cleanly (ranged deps may bump within their range — acceptable;
   integrity pins are re-verified by the online checker):

```bash
rm -rf node_modules package-lock.json
npm install          # .npmrc now forces the official registry
```

3. Confirm cleanliness and record audit results:

```bash
grep -c "registry.npmmirror.com" package-lock.json   # expect 0
npm audit                                            # record result in commit message
```

4. Fix ONLY critical/high advisories affecting reachable runtime/build code; report others.

**Verify**: `node scripts/verify-package-integrity.mjs --online` → exit 0. `npm run check && npm run build && npm test` → green.

### Part C — Images: sources out of `public/`, only hashed copies deployed

Order matters; the tree stays buildable between steps.

1. **Move logical sources**: `git mv public/images assets/images`. (All current subdirs — `work/`,
   `photography/`, etc. — move together.)
2. **Retarget the script**: in `build-image-manifest.mjs` add
   `const SOURCES_DIR = join(ROOT, "assets", "images");` and change `walk(SOURCES_DIR)`. For each
   logical file compute the hash, then write the hashed copy to the SAME relative path under
   `IMAGES_DIR` (create dirs as needed). Delete the old "copy next to the logical file" behavior —
   the logical file never enters `public/` again. Keep `HASHED_RE` and the manifest module output
   (`imageUrl("work/x.webp")` keys are relative to the images root and unchanged).
   Update pruning: operate over `IMAGES_DIR`; prune a hashed file when its basename matches a
   logical basename in the corresponding `SOURCES_DIR` subtree whose hash differs (preserve the
   founder-file safety rule: no matching logical source → never prune). Update header comments to
   describe the two-directory flow.
3. **Regenerate**: `rm -rf public/images && node scripts/build-image-manifest.mjs` → `public/images/`
   now contains ONLY `<name>.<hash>.ext` files; `src/generated/image-manifest.ts` rewritten
   (content identical if sources unchanged).
4. **Update writers**: `optimize-work-previews.py` default output dir → write into
   `assets/images/work/` (read the script's CLI/output constants); `refresh-portfolio-previews.sh`
   likewise. Grep for other writers: `grep -rn "public/images" scripts/ docs/ README.md`.
5. **Update docs**: README §4/§5 bullets and `docs/IMAGERY.md` references from `public/images` →
   `assets/images` for SOURCES, keeping the rule text ("never hard-code /images/... paths") intact.
6. **Tests**: update `tests/image-manifest.test.mjs` fixtures/staging to the two-directory model;
   add one regression assertion: after running the script on a fixture tree, `public/images`
   contains zero non-hashed files. Check `tests/structural.test.mjs` — its "every /images/
   reference is content-hashed and exists" assertion should pass unchanged (it reads built HTML +
   disk).

**Verify (each its own command)**:

```bash
node scripts/build-image-manifest.mjs                      # exit 0
find public/images -type f ! -name '*.[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f].*' | wc -l   # expect 0
node --test tests/image-manifest.test.mjs                  # all pass
npm run build                                              # exit 0
npm test                                                   # all pass
bash scripts/verify.sh                                     # exit 0
```

Also spot-check `dist/`: `du -sh dist/images` should roughly halve versus the pre-change build.

### Part D — Bookkeeping

Add CHANGELOG entries under Unreleased (Added/Changed/Fixed as appropriate) for all three parts.

## Test plan

- `tests/image-manifest.test.mjs`: migrated fixtures + the new "no unhashed files in
  public/images" regression test.
- Existing structural/SEO suites double-check built output references — they are the real net.
- Red-first for Part C's regression test: before retargeting the script, staging a fixture tree
  the OLD way leaves an unhashed file and the new assertion fails.

## Done criteria

ALL must hold:

- [ ] quality.yml sets `cache: npm` and `timeout-minutes: 15`
- [ ] `.npmrc` exists pinning the official registry; `grep -c npmmirror package-lock.json` → 0
- [ ] `npm audit` runs to completion locally (record outcome in the commit message)
- [ ] `find public/images -type f` lists ONLY hashed filenames
- [ ] `node --test tests/image-manifest.test.mjs` passes; full `npm test` + `bash scripts/verify.sh` green
- [ ] README/IMAGERY references updated; CHANGELOG entry present
- [ ] No unrelated modifications; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Lockfile regeneration produces version bumps that fail `verify-package-integrity.mjs --online`
  or break the build (report exact versions; do NOT hand-edit resolved URLs).
- Any consumer of logical image paths exists BEYOND the listed writers/tests/docs (grep finds a
  surprise importer) — relocation needs that consumer mapped first.
- `npm audit` reports a critical/high in astro/tailwind/wrangler reachable code paths — STOP and
  report rather than attempting an upgrade inside this plan.
- The prune-rule rewrite cannot preserve the documented founder-file safety guarantee cleanly.

## Maintenance notes

- Future image tooling must write SOURCES to `assets/images/` and let prebuild materialize hashed
  copies; add a line about this next to any new capture script.
- The `.npmrc` overrides developer-global mirrors deliberately; document it in CONTRIBUTING if
  contributors on mirror-only networks report install failures (they can override per-invocation
  with `npm install --registry=...` but CI stays pinned).
- Reviewers should scrutinize the prune-rule diff hardest — it deletes files; the safety rule
  (no logical match → keep) must survive verbatim in spirit.
