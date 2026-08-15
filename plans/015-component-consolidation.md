# Plan 015: Consolidate duplicated component logic (`isCurrent`, arrow links, `WorkPreview`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- src/components/ src/pages/index.astro`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `13ef792`

## Why this matters

Three small duplications in the components layer: (1) the `isCurrent`
nav-highlight helper is copy-pasted in `Header.astro` and `MobileMenu.astro`;
(2) the "read more" arrow-link pattern (مشاهده کار / جزئیات همکاری / خواندن
نوشته) is hand-rolled in `WorkCard.astro`, `OfferRow.astro`, and the blog
band of `index.astro` instead of using the existing `TextLink` primitive —
three copies of one link style drift independently (hover-arrow direction,
spacing); (3) `WorkCard.astro` re-declares a `WorkPreview` interface that
already exists in `src/data/work-previews.ts`. Consolidation is purely
behavior-preserving: the rendered markup and classes stay identical.

## Current state

- `src/components/layout/Header.astro:23` and
  `src/components/layout/MobileMenu.astro:18` — identical `isCurrent`
  helpers:
  ```ts
  const isCurrent = (href: string) => ... Astro.url.pathname comparisons ...
  ```
  (read both; they may differ slightly — unify to one behavior).
- `src/components/business/WorkCard.astro:84-96`, `src/components/business/OfferRow.astro:46-57`, and the blog band in `src/pages/index.astro` (~line 500) — the same link+arrow block (a `TextLink`-style anchor with an arrow glyph and hover styles).
- `src/components/business/WorkCard.astro:13` — `interface WorkPreview { ... }` re-declared; `src/data/work-previews.ts:15` already exports `WorkPreview` (read it to confirm the shape matches).
- `src/components/ui/TextLink.astro` — the existing link primitive (read it).

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Check      | `npm run check`             | exit 0 |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |
| Grep       | `grep -rn "interface WorkPreview" src/` | 1 match (work-previews.ts) |

## Scope

**In scope**:
- `src/components/layout/Header.astro`
- `src/components/layout/MobileMenu.astro`
- `src/components/business/WorkCard.astro`
- `src/components/business/OfferRow.astro`
- `src/pages/index.astro`
- `src/components/ui/ArrowLink.astro` (create)
- `src/components/layout/nav.ts` (create — shared `isCurrent` helper)

**Out of scope** (do NOT touch):
- `src/components/ui/TextLink.astro`, `src/components/ui/Button.astro` (existing primitives stay as-is)
- `src/data/work-previews.ts` (only the WorkCard import changes)
- Any other file, including visual/styling changes — the rendered classes must remain byte-identical to today.

## Git workflow

- Commit once at the end:
  `refactor(ui): consolidate isCurrent, arrow links, and WorkPreview type`
- Do NOT push or open a PR.

## Steps

### Step 1: Shared `isCurrent` helper

Create `src/components/layout/nav.ts`:

```ts
/** Active-nav check shared by Header and MobileMenu (single source of truth). */
export function isCurrent(href: string, pathname: string): boolean {
  // read both existing implementations first; unify to the exact same
  // comparison they both perform (likely exact match or prefix match for "/")
}
```

Update `Header.astro` and `MobileMenu.astro` to import and call it with
`Astro.url.pathname` (the two implementations may differ subtly — read
both; if they differ, keep the more specific one and note it). Delete the
local copies.

**Verify**: `npm run check` → exit 0; `grep -n "const isCurrent" src/components/` → no matches.

### Step 2: ArrowLink component

Create `src/components/ui/ArrowLink.astro` that renders exactly the markup
currently hand-rolled at the three sites. Read all three current blocks
first; the component should accept `href` and `label` (plus optional
`class`) props and render the SAME anchor + arrow markup with the SAME
classes (copy them verbatim from the current blocks; if the three copies
differ in classes, use the most common variant and note the difference).

Replace the three hand-rolled blocks with `<ArrowLink href="..." label="..." />`
(or equivalent props).

**Verify**: `npm run check` → exit 0. Then compare rendered output:
`npm run build` and grep `dist/` for the arrow-link class string — it must
appear in the same pages as before (`dist/work/index.html`,
`dist/services/index.html`, `dist/index.html`, `dist/blog/index.html`).
Also `grep -rn "مشاهده کار\|جزئیات همکاری\|خواندن نوشته" src/components/business/WorkCard.astro src/components/business/OfferRow.astro` → only as props to ArrowLink, not as hand-rolled markup.

### Step 3: `WorkPreview` type

In `WorkCard.astro`, delete the local `interface WorkPreview` and import
the type:

```astro
---
import type { WorkPreview } from "../../data/work-previews";
```

Check the import path from `src/components/business/` (it is
`../../data/work-previews`). Confirm the exported type's shape satisfies
the component's usage (`npm run check` proves it). Also fix the file's
doc-header if it still says "WorkRow".

**Verify**: `npm run check` → exit 0; `grep -rn "interface WorkPreview" src/` → 1 match in `src/data/work-previews.ts`.

### Step 4: Full gate

**Verify**: `npm test` → all pass (structural tests re-verify the built
pages). `npm run build` → exit 0.

## Test plan

- No new tests — this is behavior-preserving refactoring; the existing
  structural tests over built output (links, classes) are the regression
  net. If the structural suite does not assert the arrow-link class, add
  nothing — the grep checks in Steps 2-3 are the verification.

## Done criteria

- [ ] `grep -n "const isCurrent" src/components/` → no matches; `src/components/layout/nav.ts` exists and both headers import it
- [ ] `src/components/ui/ArrowLink.astro` exists; the three hand-rolled blocks are gone
- [ ] `grep -rn "interface WorkPreview" src/` → exactly 1 match (work-previews.ts)
- [ ] `npm run check`, `npm test`, `npm run build` all pass
- [ ] `git diff --stat` touches only the in-scope files
- [ ] Rendered output unchanged: `grep -c` of the arrow-link class in `dist/` matches pre-change counts (record both counts in your report)

## STOP conditions

Stop and report back (do not improvise) if:

- The three arrow-link blocks use materially different classes (report the
  differences; choose the dominant variant only after reporting).
- `WorkPreview` in work-previews.ts has a different shape than the local
  interface (report; do not widen the exported type).
- The two `isCurrent` implementations differ in behavior (report; keep both
  behaviors consistent by picking the one that matches `aria-current` usage
  in both components).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `ArrowLink` becomes the single place the "read more" pattern is styled —
  future link-style changes touch one file.
- If nav behavior grows (nested routes, active-section detection), extend
  `nav.ts` instead of the components.
- Reviewer should scrutinize: byte-identical classes (diff the built HTML
  before/after for the affected pages if in doubt) and that the shared
  `isCurrent` behavior matches both old implementations.
