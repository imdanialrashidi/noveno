# Plan 010: Docs reconcile (README contract claims, directory map, spec route history, PRODUCT open decisions, CHANGELOG backfill)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- README.md docs/Noveno_Website_Master_Spec.md docs/PRODUCT.md CHANGELOG.md tests/structural.test.mjs src/data/site.ts`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> Execute AFTER the code plans (001–008) so the corrected docs describe the
> final state. Plan 013 then pins these facts mechanically.

## Status

- **Priority**: P2 (cheap, high-leverage for an agent-heavy repo whose memory is its docs)
- **Effort**: S–M
- **Risk**: LOW (docs only)
- **Depends on**: ideally after 001–008; hard requirement only for the structural-test bullet (its wording must match whatever `tests/structural.test.mjs` asserts when you execute)
- **Category**: docs
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

Four documented facts are wrong or stale, each with a concrete cost:

1. README states the structural tests pin "the homepage LCP media wiring (hashed AVIF preload +
   eager hero) must exist" — the shipped tests assert the exact OPPOSITE (`no hero image preload`,
   `no eager images`, headline text is LCP). The first-read doc describes an inverted contract
   for the most recent platform decision.
2. The README directory map omits `components/brand/`, `ui/ArrowLink`+`TextLink`,
   `scripts/motion.ts`, `scripts/work-filter.ts`, the `scripts/audit/` module split, and
   `data/blog.ts` — discovery via map fails for exactly the newest code.
3. The Master Spec (primary source of truth per AGENTS.md ordering) still routes the article
   section as `/insights` in three places; shipped reality is `/blog` with permanent `/insights`
   → `/blog` 301s (DESIGN §16 decision log).
4. PRODUCT.md's "Open product decisions" lists settled items as open: hero headline is pinned to
   approved candidate A in `site.ts`; Persian fonts ship under `public/fonts/`; the hero visual
   was decided by the 2026‑10 brand pass.

Plus: CHANGELOG has no entries for several shipped features (RSS feed, work filter, HMAC receipt,
attribution query tooling), understating velocity for handoff.

## Current state

### 1. README structural claim — line ~290

```
Structural tests (run inside the gate) also pin the design contract: the flowchart grammar
classes are banned from built output, the homepage LCP media wiring (hashed AVIF preload + eager
hero) must exist, every /images/ reference must be content-hashed and exist on disk, fonts ≤ 200 KB,
interactive JS ≤ 15 KB gzip, every page fa + dir="rtl", theme anchors present, no dead links,
no env names leaked.
```

Actual assertions (`tests/structural.test.mjs:140–147`):

```ts
assert.ok(!/<link[^>]*rel="preload"[^>]*as="image"/.test(home), "homepage must not preload any hero image");
...
assert.ok(eagerImages.length === 0, "no image may be eager — LCP is the headline text");
```

**Before editing, re-read the current test file** and transcribe ITS assertion list verbatim into
README (the plan you're reading may be executing after other plans changed the suite).

### 2. Directory map — README (~lines 100–125)

Current map shows `components/{business,layout,ui}`, `data/{site,audit,work-previews}.ts`,
`scripts/ theme.ts, menu.ts, audit.ts ...`. Missing: `components/brand/` (HeroArtwork, Logo);
`ui/ArrowLink.astro`, `ui/TextLink.astro`; `data/blog.ts`; `src/generated/image-manifest.ts`;
`scripts/motion.ts`, `scripts/work-filter.ts`, `scripts/audit/{index,draft,delivery,turnstile}.ts`.
Regenerate by walking `src/` (`find src -type f | sort`) — do not hand-guess.

### 3. Spec route history

`grep -n "/insights" docs/Noveno_Website_Master_Spec.md` → lines 461–462 (sitemap tree),
1733 ("Launch /insights …"). Shipped: `public/_redirects` maps `/insights/*` → `/blog/*`
(permanent); DESIGN §16 records the decision. Amend each site with a bracketed editorial note:

> `[2026‑10: renamed وبلاگ at /blog with permanent /insights redirects — see DESIGN §16.]`

Keep original spec text intact (it is a versioned historical spec); annotate, don't rewrite.

### 4. PRODUCT open decisions — end section

Currently lists as open: prices display (§39), audit free-vs-paid (§15) — KEEP both; plus:
"Hero headline selection between the two approved candidates (Spec §11.2)" — SETTLED
(`src/data/site.ts`: `HERO_HEADLINE = ... // approved candidate A (Spec §11.2)`); "Persian font
choice, hero visual … deferred to /design" — SETTLED (fonts shipped; hero = signal-field brand
artwork per the 2026‑10 brand pass). Replace settled bullets with a pointer sentence.

### 5. CHANGELOG gaps

Present in tree but absent from CHANGELOG Unreleased: `src/pages/rss.xml.ts` (+ autodiscovery if
present in BaseLayout — check), `src/scripts/work-filter.ts` (/work industry filter),
HMAC validation receipt (Mitigation 021), `scripts/query-events.mjs` + attribution spike reader,
`scripts/slice2-test-server.mjs` modes. Add grouped entries; do not fabricate dates — group under
Unreleased.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Contract gate | `bash scripts/project-verify.sh` | exit 0 |
| Contract tests | `node --test tests/project-contract.test.mjs` | all pass |
| Map accuracy check | `find src -type f \| sort` | source for the map |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `README.md` (structural summary + directory map)
- `docs/Noveno_Website_Master_Spec.md` (three annotations)
- `docs/PRODUCT.md` (open-decisions list)
- `CHANGELOG.md` (backfill)
- `plans/README.md` — status row

**Out of scope**:
- Rewriting spec content beyond the three annotations.
- docs/BLOG.md, ARCHITECTURE.md, DESIGN.md (already accurate).
- Adding new doc files; translating anything.
- Any source/test file (if you find a doc-code mismatch NOT listed above, record it in the PR
  body instead of fixing silently).

## Git workflow

- Branch: `improve/010-docs-reconcile`
- Conventional commits: `docs: reconcile README contract/map, spec route history, PRODUCT decisions; backfill changelog`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

1. Re-read `tests/structural.test.mjs`; rewrite README's structural-test sentence to enumerate
   what is ACTUALLY asserted (headline-LCP rules included). Verify each listed claim against the
   test file by eye.
2. Regenerate the README directory map from a fresh `find src -type f | sort`, keeping the
   existing annotation style (one-line role comments). Include `src/generated/` with its
   "regenerated by prebuild" note.
3. Annotate the three `/insights` sites in the Master Spec (exact note text above).
4. Edit PRODUCT.md open decisions: keep prices + free-vs-paid; replace settled items with one
   line pointing at `src/data/site.ts` (headline) and DESIGN §16 / README repository-state
   (fonts, hero artwork).
5. Backfill CHANGELOG grouped entries (Added: RSS feed, work industry filter, attribution query
   tooling, slice2 test server modes; Security: HMAC validation receipt echo).
6. Run the contract gate and full suite.

## Test plan

No new tests here — but plan 013 immediately follows and converts today's four corrections into
mechanically enforced invariants. Until then, correctness is review-enforced: the PR should quote
each old→new fact pair.

## Done criteria

ALL must hold:

- [ ] README contains no "AVIF preload + eager hero" phrasing; its structural list matches the
      live test assertions item-for-item
- [ ] Every entry in the README directory map exists on disk; every file under `src/` appears in
      it (or in an explicitly summarized group)
- [ ] `grep -n "/insights" docs/Noveno_Website_Master_Spec.md` shows only annotated occurrences
      (each within a line also containing "renamed" or the note marker)
- [ ] PRODUCT open decisions contain only genuinely undecided items
- [ ] CHANGELOG includes entries for RSS, work filter, receipt, query-events tooling
- [ ] `bash scripts/project-verify.sh` exits 0; `bash scripts/verify.sh` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- A structural assertion contradicts README even AFTER your rewrite (test bug, not doc bug — report).
- The spec annotations would contradict a NEWER decision doc (check DESIGN §16 first).
- You discover additional settled-but-listed-open decisions beyond the two named — fix them too,
  but list them in the PR body.

## Maintenance notes

- Plan 013 turns the README-map/spec/PRODUCT facts into gate-checked invariants; until it lands,
  doc edits can silently regress again.
- Reviewers should verify each README claim against code, not against the old README.
