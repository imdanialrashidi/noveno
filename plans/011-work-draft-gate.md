# Plan 011: Give the work collection the same draft gate the blog has

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- src/content.config.ts src/pages/work/index.astro "src/pages/work/[slug].astro" src/pages/index.astro scripts/generate-sitemap.mjs tests/content.test.mjs tests/sitemap-parser.test.mjs`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (direction item → build plan; small enough that no separate spike is warranted)
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none (safe before or after 001–008)
- **Category**: direction / dx (founder publishing workflow)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

Blog entries have a draft gate end-to-end (`draft: true` never builds, never reaches the sitemap,
never appears in listings). Work entries have nothing: a founder staging a real case study that
awaits client sign-off has only "delete the file" as a not-live state. The sitemap generator even
documents the gap in its own header comment ("the work collection has no draft gate"). The
mislabel footgun compounds it: an unregistered work id silently falls back to a concept mock in
previews (README §2 warning), so a half-staged entry can render wrong proof labeling.

This plan ports the blog's proven pattern to `work`: one frontmatter boolean, honored by every
consumer.

## Current state

### Schema — `src/content.config.ts`

`work` is a discriminated union of three branches (`case-study`, `project`, `concept`); each
branch repeats its fields and ends with `featured: z.boolean().default(false)`. Blog's schema
carries:

```ts
/** Draft gate — drafts never build, never appear in index/sitemap. */
draft: z.boolean().default(false),
```

### Consumers reading work entries

```ts
// src/pages/work/index.astro:14
const entries = (await getCollection("work")).sort(...);
// src/pages/work/[slug].astro:23 (getStaticPaths)
const entries = await getCollection("work");
// src/pages/index.astro:59
const proofEntries = (await getCollection("work"))...
```

None filters drafts (no field exists).

### Sitemap — `scripts/generate-sitemap.mjs`

Header lines 7–9:

```
 *  - every work entry (the work collection has no draft gate);
 *  - every PUBLISHED blog article (draft: true is skipped — the
 *    same gate the page build applies ...)
```

and the blog loop already does `.filter(({ data }) => !data.draft)` (line ~81).

### Reference implementation (blog)

`src/data/blog.ts`:

```ts
/** Published = not draft. The only gate between content and the public site. */
export function isPublished(entry: BlogEntry): boolean {
  return !entry.data.draft;
}
```

Used by index/blog pages and the sitemap generator imports/replicates the same predicate.

### Honesty-contract test suite

`tests/content.test.mjs` enforces the type/metric honesty rules; `tests/sitemap-parser.test.mjs`
pins sitemap contents. Both are your test homes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Schema check | `npm run check` | exit 0 (schema errors surface here) |
| Build | `npm run build` | exit 0; draft work pages absent from dist |
| Content tests | `node --test tests/content.test.mjs` | all pass |
| Sitemap tests | `node --test tests/sitemap-parser.test.mjs` | all pass |
| Full suite (after build) | `npm test` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `src/content.config.ts` — add `draft` to all three union branches
- `src/pages/work/index.astro`, `"src/pages/work/[slug].astro"`, `src/pages/index.astro` — filter
- `scripts/generate-sitemap.mjs` — filter + update header comment
- `tests/content.test.mjs`, `tests/sitemap-parser.test.mjs` — new cases + fixture drafts
- `README.md` §1–2 (Adding a work item) — document `draft: true` staging
- `CHANGELOG.md`
- `plans/README.md` — status row

**Out of scope**:
- Changing any honesty-contract rule (metrics/types/tags).
- Preview registration behavior for published entries.
- Blog gating logic (already correct).
- OG card pipeline beyond whatever it derives from published entries — IF `validate-og-assets.mjs`
  enumerates work entries from content, make it honor the gate too (grep first:
  `grep -n "getCollection\|content/work\|\.md" scripts/validate-og-assets.mjs`) and record that
  edit here; otherwise leave untouched.

## Git workflow

- Branch: `improve/011-work-draft-gate`
- Conventional commits:
  - `feat(content): draft gate for the work collection (parity with blog)`
  - `test: pin draft exclusion across pages and sitemap`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Schema

In `src/content.config.ts`, add to EACH of the three `work` union branches (identical wording to
the blog comment):

```ts
/** Draft gate — drafts never build, never appear on /work, /, or in the sitemap. */
draft: z.boolean().default(false),
```

Do NOT restructure the union into a shared base in this plan (keep the diff mechanical);
a `.base.extend()` refactor can come later if the duplication hurts.

**Verify**: `npm run check` → exit 0 (all existing entries lack `draft` → default applies).

### Step 2: Filter every consumer

Add the same tiny predicate locally per page (mirroring how blog pages do it inline) or import a
shared helper if one already exists for work — grep first. Apply:

```ts
const entries = (await getCollection("work")).filter(({ data }) => !data.draft)... // then existing sort
```

in all three consumers listed above. In `[slug].astro`'s `getStaticPaths` the filter prevents
route generation entirely (that IS the "never builds" guarantee).

Update `generate-sitemap.mjs`: apply `.filter(({ data }) => !data.draft)` in the work loop and
rewrite header line 7 to:

```
 *  - every PUBLISHED work entry (draft: true skipped — same gate as pages);
```

**Verify**: `npm run check && npm run build` → exit 0; `grep -rn "getCollection(\"work\")" src/` → each occurrence followed by a draft filter (or composed with one).

### Step 3: Fixtures + tests

1. Create a throwaway draft fixture during testing ONLY if the suite stages temp content — check
   how `tests/content.test.mjs` gets entries (it may parse `src/content/work/*.md` directly or
   construct data objects). Follow its existing fixture mechanism:
   - a draft `concept` entry must fail NO honesty rules but be excluded;
   - page-level: assert the work-index rendering path excludes the draft id (if the suite tests
     helpers rather than built HTML, pin the filter predicate itself).
2. `tests/sitemap-parser.test.mjs`: extend the fixture set so one work entry carries
   `draft: true`; assert the generated sitemap omits `/work/<draft-slug>` while keeping published
   ones. If the suite generates the sitemap via the real script against staged fixtures, reuse
   that flow exactly.

Red-first: add the sitemap assertion before Step 2's generator change → fails; apply → passes.

**Verify**: `node --test tests/content.test.mjs tests/sitemap-parser.test.mjs` → all pass.

### Step 4: Document + changelog

README §2 (Adding a work item): add a bullet after step 1 —

> To stage an entry without publishing it (e.g. awaiting client sign-off), set `draft: true` in
> the frontmatter; it stays out of `/work`, the homepage proof section, and the sitemap until you
> flip it to false.

CHANGELOG under Unreleased → Added.

**Verify**: `bash scripts/verify.sh` → exit 0.

## Test plan

Summarized in Step 3. Keep the honesty suite authoritative — the draft flag must be orthogonal
to proof-type rules (a draft concept still forbids metrics, etc.).

## Done criteria

ALL must hold:

- [ ] `grep -c "draft: z.boolean().default(false)" src/content.config.ts` ≥ 4 (blog + three work branches)
- [ ] Built site contains zero `/work/<draft-fixture>` routes when a draft fixture exists in the
      test flow; sitemap excludes it
- [ ] All content/sitemap tests green; full `npm test` + `bash scripts/verify.sh` green
- [ ] README §2 documents the flag; CHANGELOG updated
- [ ] No unrelated modifications; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `validate-og-assets.mjs` hard-requires an OG card for EVERY work file including drafts (the
  gate would break prebuild) and the correct integration isn't obvious from its structure.
- The honesty-test suite asserts an exact entry COUNT over `src/content/work/*.md`.
- Featured/draft interaction is ambiguous (a `featured: true` DRAFT entry would silently vanish
  from the homepage — decide: allow (harmless) but document; if existing code assumes featured ⇒
  present, report).

## Maintenance notes

- Founder workflow gains: stage freely with `draft: true`; publish = flip the flag + rebuild.
- If a third content type ever needs gating, extract the shared predicate then.
- Reviewers should confirm the filter exists in ALL THREE page consumers plus the sitemap — a
  missed consumer resurrects the exact leak this plan closes.
