# Plan 030: Work portfolio filter by industry (سپس‌سپار design spike + build)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- src/pages/work/ src/components/business/WorkCard.astro src/data/work-previews.ts src/content/work/ src/data/site.ts src/content.config.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S-M (spike 0.5 day + build 0.5 day)
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`/work` (`src/pages/work/index.astro`) is a flat chronological list of proof items (`case-study` / `project` / `concept`) with no way to focus on a relevant vertical. `industry` is already truthful data: `src/content.config.ts: work` schema has `industry: z.string()` per entry, and `src/content/work/*.md` frontmatter carries it (e.g., `restaurant_cafe`, `salon_beauty`). The adjacent possible is one interface away — a query-param or client-side filter (`?industry=restaurant_cafe`) that narrows the editorial rows without breaking their large-preview composition. This costs a tiny UI and makes the portfolio useful for an SMB owner who asks "do you have work in my industry?"

This is a *design spike + build* plan: spike the UX (filter placement, copy, empty state, URL shareability) against `docs/DESIGN.md` editorial rhythm, then build the thinnest correct slice.

## Current state

Relevant files:
- `src/pages/work/index.astro` — flat list, `getCollection("work")` → `sortByDate` (featured first, then date)
- `src/pages/work/[slug].astro` — detail page (not changed, but must stay linkable when filtered)
- `src/components/business/WorkCard.astro` — editorial work row (7/5 featured, 6/6 rest, large preview + `ProofTag`)
- `src/data/work-previews.ts` — `previewFor(id)` image preview registry
- `src/data/site.ts` — `CONTACT`, `NAV_LINKS`, `SYSTEM_STAGES` (no industry taxonomy yet)
- `src/content.config.ts: work` — `industry: z.string()` per type, no enum (free-form today)
- `src/content/work/*.md` — 6 entries (check `ls src/content/work/`): each has `industry` frontmatter

Excerpt — `src/pages/work/index.astro` (as of `3e33265`, simplified):

```astro
const all = await getCollection("work");
const published = sortByDate(all.filter(isPublished)); // isPublished = draft? no, work has no draft gate
// ... featured first, then rest — renders WorkCard per entry
```

Excerpt — `src/content.config.ts: work` industry line:

```ts
industry: z.string(),
```

Repo conventions:
- `docs/DESIGN.md: §8` composition — 12-col desktop, hairline `border-t` sections, `py-16 lg:py-28`, no wall of cards, large preview rows (7/5 featured). The filter must not become a card wall.
- `docs/DESIGN.md: §10` `ProofTag` — plain typographic tag, no pills.
- `src/components/ui/` has `Button`, `Select`, `MultiSelect`, `FormField` — reuse `Select` or a simple row of `ChannelLink`-style chips for the filter (not a heavy dropdown). Follow existing `MultiSelect` `aria-checked` + `data-chip` pattern if you use chips.
- Persian-first, RTL-first; filter copy is Persian.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass |
| Build | `npm run build` | 19 pages (no new pages) |
| Affected | `node scripts/verify-affected.mjs --file src/pages/work/index.astro` | routes to app/structural gate |
| Dev | `npm run dev` | render at /work?industry=restaurant_cafe |

## Scope

**In scope** (only files you should modify):
- `src/pages/work/index.astro` — add filter UI + query-param or client-side filtering (pick one, document)
- `src/components/business/WorkCard.astro` — no change except maybe `data-industry` attr for client filter (thin)
- `src/scripts/work-filter.ts` (create, if client-side) — small framework-free module like `src/scripts/menu.ts`
- `tests/work-filter.test.mjs` (create) or `tests/seo-contract.test.mjs` — pin filter behavior
- `docs/DESIGN.md` decision log §16 — one line: "work filter: …" if editorial rhythm touched

**Out of scope** (do NOT touch):
- Changing `src/content.config.ts` industry from `z.string()` to enum (too broad — do separately if you want an enum, not in this slice)
- Adding tag/category pages (thin taxonomy rule)
- Changing `src/data/site.ts` industry labels beyond the filter options (reuse existing `AUDIT_OPTIONS.industry` labels if you need display names)
- `/work/[slug].astro` detail pages (must keep working unfiltered)

## Git workflow

- Branch: `advisor/030-work-filter-by-industry`
- Commit per step; conventional commits
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Spike — decide server vs client filtering and write the decision

Create a 1-page decision in `docs/exec-plans/active/work-filter-spike.md` (or inline comment at top of `src/pages/work/index.astro` if you prefer), answering:

1. **Source of truth for industry options**: derive from `getCollection("work")` distinct `industry` values at build time (no hard-coded enum — free-form `z.string()` today, so the filter grows as content does).

2. **Filtering mode** (pick one, recommend Option A):
   - **Option A — Client-side, query-param hydrated**: render **all** entries static (SEO intact), add a small filter row (`<div data-work-filter>` with `data-chip` buttons per industry + "همه" / all). On load, read `location.search` `industry=` param, show/hide rows via `hidden`, update URL via `history.replaceState` without reload. Benefits: no new pages, no Astro SSR, shareable URL, progressive enhancement (no-JS shows all, with JS filters). Cost: ~40 lines JS (`src/scripts/work-filter.ts`).
   - **Option B — Server-time (Astro query param)**: `Astro.url.searchParams.get("industry")` at build? No — static output is one `index.html`, so this requires `output: hybrid` or `prerender = false` — rejected (violates static invariant `docs/ARCHITECTURE.md`).
   - **Option C — Per-industry static pages** (`/work/industry/[industry]`): more pages, more sitemap churn — overkill for 6 items.

3. **Placement & copy**: filter row directly under `SectionHeader` for `/work` (between hero and list), hairline row, chips `ارائه: همه · رستوران · آرایشگاه · …` (labels from `industry` values, or reuse `AUDIT_OPTIONS.industry` labels where keys overlap like `restaurant_cafe → رستوران و کافه`). Keep editorial typography — no pills.

4. **Empty state**: when a filter yields 0, show Persian empty: "هنوز نمونه‌ای در این حوزه منتشر نشده است" + `Button href="/contact"`.

Record the choice (recommend A) and a sketch of the DOM (`data-work-filter`, `data-industry` on rows).

**Verify**: `npm run check` → exit 0 (doc only)

### Step 2: Implement the filter (client-side, ~60 LOC)

In `src/pages/work/index.astro`:

1. Compute distinct industries at build time:
   ```astro
   const industries = [...new Set(all.map(e => e.data.industry))].sort();
   ```

2. Render a filter row above the list:
   ```astro
   <div data-work-filter role="group" aria-label="پالایش بر اساس حوزه">
     <button data-industry-filter="all" aria-pressed="true">همه</button>
     {industries.map(ind => <button data-industry-filter={ind} aria-pressed="false">{labelForIndustry(ind)}</button>)}
   </div>
   ```

3. Add `data-industry={entry.data.industry}` to each work row (`<li>` or `WorkCard` wrapper).

4. Create `src/scripts/work-filter.ts` (model after `src/scripts/menu.ts:30` — init function, no framework, `aria-pressed` + `hidden` toggling):

```ts
export function initWorkFilter(root: HTMLElement) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-industry-filter]")];
  const rows = [...document.querySelectorAll<HTMLElement>("[data-industry]")];
  const apply = (industry: string) => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.getAttribute("data-industry-filter")===industry));
    for (const r of rows) r.hidden = industry !== "all" && r.getAttribute("data-industry") !== industry;
    const url = new URL(location.href); if (industry==="all") url.searchParams.delete("industry"); else url.searchParams.set("industry", industry); history.replaceState(null,"",url);
  };
  const initial = new URLSearchParams(location.search).get("industry") ?? "all";
  if (initial !== "all" && ![...industries].includes(initial)) apply("all"); else apply(initial);
  for (const b of buttons) b.addEventListener("click", () => apply(b.getAttribute("data-industry-filter")!));
}
```

Wire via `<script> import { initWorkFilter } from "../scripts/work-filter"; initWorkFilter(document.querySelector("[data-work-filter]"));</script>` at the bottom of `work/index.astro` (Astro script hoisting) or via `data-work-filter` init in `src/layouts/PageLayout.astro` — follow existing `src/scripts/menu.ts` init pattern.

Keep total new JS <1 KB raw (negligible vs 15 KB budget — plan 026 measures it).

**Verify**: `npm run check` → exit 0; `npm run build` → 19 pages

### Step 3: Manual smoke + tests

1. `npm run dev` → visit `/work` (all shown), `/work?industry=restaurant_cafe` (filtered), click "همه" (URL param removed), click an industry (URL updated, rows hidden), no-JS (disable JS in devtools → all rows visible — progressive enhancement).

2. Add `tests/work-filter.test.mjs` (model after `tests/client-modules.test.mjs:150` FakeEl harness) — or extend `tests/structural.test.mjs`:

```ts
test("work industry filter hides non-matching rows and updates URL", () => {
  // fake DOM: 3 rows with data-industry, 2 buttons (all + restaurant_cafe)
  // initWorkFilter → click industry → rows with other industry hidden, button aria-pressed
  // URL searchParams reflects ?industry=...
});
```

Or pin via build-output test (simpler): assert `dist/work/index.html` contains `data-work-filter` and `data-industry` attrs, and that each `industry:` value from `src/content/work/*.md` appears as a `data-industry-filter`.

**Verify**: `npm test` → all pass

### Step 4: Docs

- `docs/DESIGN.md: §16 decision log` — add one line: `2026-08-21 — Work filter: client-side industry filter (query-param hydrated, progressive enhancement, ~60 LOC) — editorial rhythm preserved, URL shareable.`
- `README.md` or `docs/BLOG.md` — no change needed (work content guide already at `README.md: Adding a work item`).

**Verify**: `bash scripts/project-verify.sh` (if exists) → no failures

## Test plan

- `work industry filter …` — new test: `data-work-filter` exists, distinct `data-industry-filter` per industry, clicking filters rows via `hidden` and toggles `aria-pressed`, URL `industry` param reflects filter, invalid param falls back to "all".
- Build pin: `grep -c "data-industry" dist/work/index.html` matches number of work entries (currently 6), and `data-work-filter` present once.
- A11y: filter group has `role="group"` + `aria-label`, buttons are keyboard-focusable, no color-only meaning.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new test `work industry filter …` exists and passes
- [ ] `npm run build` emits `dist/work/index.html` with `data-work-filter` and `data-industry` attrs
- [ ] `grep -c "data-industry-filter" dist/work/index.html` ≥ distinct industry count (≥2)
- [ ] No new route `/work/industry/*` created (`ls dist/work/industry` must not exist)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- Static build cannot render all entries when filtered (you switched to SSR / `prerender = false` — wrong path)
- `industry` frontmatter values include non-ASCII or spaces that break URL/query param (encode with `encodeURIComponent`/`decodeURIComponent` — already handled by `URLSearchParams`)
- The filter row breaks editorial rhythm (designer review says chips look like `ProofTag` pills — change chip styling to a text-link row, not a pill wall)
- Any existing work detail build breaks (`/work/[slug]` missing) — filter must not touch detail routes

## Maintenance notes

- Reviewer should check that the filter is progressive enhancement: no-JS shows all rows, JS hydrates the `?industry=` param — View Source must contain all entries (SEO).
- When `industry` becomes an enum (`z.enum([...])` in `src/content.config.ts`), the distinct-industries list can be replaced by the enum — update `src/pages/work/index.astro` in that change.
- Keep new JS under `src/scripts/work-filter.ts` and wire only on `/work` — not global layout (budget, perf).
