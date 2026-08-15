# Plan 009: Validate repo-relative `ogImage` overrides like committed cards

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- scripts/validate-og-assets.mjs tests/og-assets.test.mjs`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `13ef792`

## Why this matters

The blog schema allows any string for `ogImage` (`content.config.ts:106`).
The OG-card gate (`scripts/validate-og-assets.mjs`) validates overrides that
start with `/`, skips external URLs, and — the bug — **skips repo-relative
overrides** like `ogImage: og/blog/custom.png` as "not a committed asset".
But the article page resolves that value with
`new URL(ogImage, site)` (`src/layouts/BaseLayout.astro:21`), which turns a
repo-relative path into `https://<site>/og/blog/custom.png` — a public path
that must exist and be 1200×630. So a relative override bypasses the gate and
can ship a missing or wrong-sized social card, violating the script's own
contract ("a missing card can never reach production silently"). Fix: treat
non-external `ogImage` values as committed repo cards and validate them.

## Current state

- `scripts/validate-og-assets.mjs:88-99` (inside `requiredCards()`):
  ```js
  // Match blog/[slug].astro exactly: `data.ogImage ?? /og/blog/{slug}.png`.
  // A leading-slash override is a committed repo card — validate it in
  // place of the default. An external/relative ogImage is referenced by
  // the page as-is and is not a committed asset — no card requirement.
  if (typeof data.ogImage === "string" && data.ogImage.startsWith("/")) {
    cards.push({ rel: data.ogImage.slice(1), why: `published article \`${slug}\`` });
  } else if (!data.ogImage) {
    cards.push({ rel: `og/blog/${slug}.png`, why: `published article \`${slug}\`` });
  }
  ```
- `src/content.config.ts:106` — `ogImage: z.string().optional()`.
- `src/pages/blog/[slug].astro:42` — `const ogImage = data.ogImage ?? \`/og/blog/${entry.id}.png\``, passed to BaseLayout, which does `new URL(ogImage, site).toString()`.
- `tests/og-assets.test.mjs` — spawns the validator (`runValidator()`),
  uses `withCardBytes`/`withCardHidden` fixtures that restore state in
  `finally`.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| OG tests   | `node --test tests/og-assets.test.mjs` | all pass |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

## Scope

**In scope**:
- `scripts/validate-og-assets.mjs`
- `tests/og-assets.test.mjs`

**Out of scope** (do NOT touch):
- `src/content.config.ts` (schema change is unnecessary — the validator is the gate)
- `src/pages/blog/[slug].astro`, `src/layouts/BaseLayout.astro`
- Any other file.

## Git workflow

- Commit once at the end:
  `fix(build): gate repo-relative ogImage overrides like committed cards`
- Do NOT push or open a PR.

## Steps

### Step 1: Classify overrides correctly

In `scripts/validate-og-assets.mjs`, replace the override branch with:

```js
// Match blog/[slug].astro exactly: `data.ogImage ?? /og/blog/{slug}.png`.
//   "/og/blog/x.png"          → committed repo card → validate it
//   "og/blog/x.png" (relative) → resolves against the site origin to the
//     same public path → validate it as a committed repo card
//   "https://cdn.example/.."  → external asset, not committed here → skip
if (typeof data.ogImage === "string" && data.ogImage !== "") {
  if (/^https?:\/\//i.test(data.ogImage)) {
    // external URL — nothing to validate in this repo
  } else {
    cards.push({
      rel: data.ogImage.replace(/^\/+/, ""),
      why: `published article \`${slug}\` ogImage override`,
    });
  }
} else if (!data.ogImage) {
  cards.push({ rel: `og/blog/${slug}.png`, why: `published article \`${slug}\`` });
}
```

Keep the existing "drafts never get a card" behavior above this branch.
Update the inline comment accordingly.

**Verify**: `node --test tests/og-assets.test.mjs` → all pass (existing
fixtures use `/og/...` values or no override — unchanged behavior).

### Step 2: Regression tests (temp fixtures, restored in finally)

In `tests/og-assets.test.mjs`, add tests following the existing
`withCardBytes`/`withCardHidden`/`runValidator` pattern. The validator reads
committed blog entries — do NOT edit real entries; instead create a
temporary entry file under `src/content/blog/` inside a `try/finally` that
deletes it (check the test file's existing helpers first — if it already has
a temp-entry helper, reuse it; otherwise write one that writes the file,
runs, and removes it in `finally`):

1. **Relative override requires the card**: temp entry `tmp-relative.md`
   with `ogImage: og/blog/tmp-relative.png` → `runValidator()` exits
   non-zero (card missing). Then `withCardBytes("og/blog/tmp-relative.png",
   <1x1 PNG bytes>, ...)` → validator exits 0. Then `withCardHidden` → fails again.
2. **External override needs no card**: temp entry `tmp-external.md` with
   `ogImage: https://example.com/card.png` → `runValidator()` exits 0
   (no requirement).

Use a real PNG byte sample from the existing fixtures (read
`public/og.png`'s first bytes as the "valid card" bytes — the validator
checks the PNG signature and dimensions; a 1×1 PNG will FAIL the 1200×630
size check. Instead, copy the bytes of an existing valid card file, e.g.
`fs.readFileSync(path.join(root, "public", "og", "blog.png"))`).

**Verify**: `node --test tests/og-assets.test.mjs` → all pass including the
two new tests; no leftover temp files (`git status --porcelain` clean for
`src/content/blog/` and `public/og/`).

## Test plan

- Two new tests per Step 2 in `tests/og-assets.test.mjs`.
- Pattern: existing `withCardBytes`/`withCardHidden` helpers + `runValidator()`.

## Done criteria

- [ ] The override branch handles `https?://` (skip) vs everything else (validate)
- [ ] `node --test tests/og-assets.test.mjs` passes with the 2 new tests
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified; no temp fixtures left behind

## STOP conditions

Stop and report back (do not improvise) if:

- The validator's card-validation function validates dimensions differently
  than described (read `validateCard` first and adapt the fixture bytes
  accordingly).
- A temp blog entry changes the sitemap or other gate outputs during the
  run (the validator is standalone, but `npm test` runs other suites that
  read `src/content/blog` — your temp file must be deleted before the suite
  finishes; run the full `npm test` to prove it).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `ogImage` values that are neither external URLs nor repo paths (e.g.
  `//cdn.example/x.png` protocol-relative) will now be treated as repo
  paths and fail the gate — that is the intended strictness; protocol-
  relative URLs are invalid in this context anyway.
- The content schema stays `z.string().optional()` — the validator remains
  the enforcement point (keeps the schema readable).
- Reviewer should scrutinize: the temp-fixture cleanup paths and that the
  relative-override test proves the pre-fix behavior would fail (defect
  sensitivity).
