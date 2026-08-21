# Plan 003: Fix user-visible display defects (blog prev/next swap, Turnstile visibility, Jalali year timezone)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- src/pages/blog/[slug].astro src/data/blog.ts src/data/site.ts src/scripts/audit/index.ts tests/blog.test.mjs tests/site-data.test.mjs tests/audit-retry.test.mjs`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (if plan 001 touched `src/scripts/audit/index.ts`, re-read its Step-3 area first)
- **Category**: bug (three independent small display corrections)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

Three independent, user-visible defects:

1. **Blog «ادامهٔ خواندن» links are reversed.** Every article page renders the chronologically
   *older* entry under the label «نوشتهٔ بعدی» (next) and the *newer* entry under «نوشتهٔ قبلی»
   (previous) — the exact opposite of what the helper's own comments document and of natural
   reading order. Confusing continuation navigation on every article with neighbours.
2. **The Turnstile widget never leaves the screen.** Once rendered on the final form step, nothing
   ever hides `#turnstile-container`; navigating back to earlier steps leaves the live Cloudflare
   challenge sitting inside the form flow, inviting users to solve it prematurely.
3. **The footer's Jalali year is computed in the build machine's timezone.** The site is a static
   build deployed from CI (UTC); around Nowruz (~20–21 March) the footer can show the previous
   year for days until the next build.

All three are small, independent, and cheaply testable.

## Current state

### A. Blog neighbours — `src/data/blog.ts` (~lines 63–74)

```ts
export function neighbours(all, current): { older: BlogEntry | null; newer: BlogEntry | null } {
  const sorted = sortByDate(all.filter((entry) => isPublished(entry)));
  const index = sorted.findIndex((entry) => entry.id === current.id);
  if (index === -1) return { older: null, newer: null };
  return {
    older: sorted[index + 1] ?? null, // published before → «نوشتهٔ قبلی»
    newer: sorted[index - 1] ?? null, // published after → «نوشتهٔ بعدی»
  };
}
```

`sortByDate` orders newest-first, so `older` = published-before, `newer` = published-after.

### Render — `src/pages/blog/[slug].astro` (~lines 150–172)

```astro
{older && (
  <a href={`/blog/${older.id}`} ...>
    <span class="text-meta text-text-faint">نوشتهٔ بعدی</span>
    <span ...>{older.data.title}</span>
```

```astro
{newer && (
  <a href={`/blog/${newer.id}`} ...>
    <span class="text-meta text-text-faint">نوشتهٔ قبلی</span>
    <span ...>{newer.data.title}</span>
```

The labels are swapped relative to both the documented intent and chronology. Fix the RENDER side
(older → «قبلی», newer → «بعدی»); the data helper is correct as written.

`tests/blog.test.mjs` covers the blog content helpers — read it and add the mapping assertion
there (it already imports `neighbours` or builds entries; follow its fixture pattern).

### B. Turnstile container — `src/scripts/audit/index.ts` renderStep (~line 212)

```ts
if (current === totalSteps && config.turnstileSiteKey && handles.turnstileContainer) {
  bridge ??= new TurnstileBridge(config.turnstileSiteKey, handles.turnstileContainer);
  void bridge.ensureRendered();
}
```

Nothing anywhere sets `handles.turnstileContainer.hidden`. The container sits OUTSIDE the
`[data-step-section]` elements (`src/pages/audit.astro:336`: `<div id="turnstile-container"
class="mt-6"></div>`), so hiding sections never hides it. `TurnstileBridge`
(`src/scripts/audit/turnstile.ts`) exposes `ensureRendered()`, `invalidate()`, `retry()`,
`syncTheme()` — no removal needed; hiding via the `hidden` attribute suffices because the widget
is only *consumed* at submit time on the final step.

Important detail: `renderStep()` is also called during init for the restored step, so an initial
`hidden = current !== totalSteps` correctly hides it from first paint.

### C. Jalali year — `src/data/site.ts` (~lines 248–251)

```ts
export function jalaliYear(date = new Date()): string {
  const latin = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric" }).format(date);
  return toFaDigits(latin);
}
```

No `timeZone` option → resolved in the host machine's zone (CI = UTC). Consumed by
`src/components/layout/Footer.astro` at build time. Brand rule (do not break): output uses Persian
digits via `toFaDigits` with `-u-nu-latn` formatting underneath.

### Repo conventions

- Tests: `node:test` + strict assert; `tests/site-data.test.mjs` pins `site.ts` helpers;
  `tests/blog.test.mjs` pins blog helpers.
- Structural suites need a fresh build first: run `npm run build` before `npm test`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |
| Blog tests | `node --test tests/blog.test.mjs` | all pass |
| Site-data tests | `node --test tests/site-data.test.mjs` | all pass |
| Journey tests | `node --test tests/audit-retry.test.mjs` | all pass |
| Full suite (after build) | `npm test` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `src/pages/blog/[slug].astro` — label swap
- `src/data/site.ts` — `jalaliYear` timezone
- `src/scripts/audit/index.ts` — container visibility line(s)
- `tests/blog.test.mjs`, `tests/site-data.test.mjs`, `tests/audit-retry.test.mjs` — new assertions
- `plans/README.md` — status row

**Out of scope**:
- `src/data/blog.ts` (helper is correct), blog styling, any copy beyond the two label strings.
- `TurnstileBridge` internals (token freshness is handled in plan 005).
- Footer markup/design.

## Git workflow

- Branch: `improve/003-display-defects`
- Conventional commits, e.g.:
  - `fix(blog): unswap prev/next labels on article pages`
  - `fix(audit): hide turnstile container off the final step`
  - `fix(site): resolve jalaliYear in Asia/Tehran`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Unswap the blog labels

In `src/pages/blog/[slug].astro`, exchange ONLY the two label strings so that:

- the card rendering `older` shows «نوشتهٔ قبلی»,
- the card rendering `newer` shows «نوشتهٔ بعدی».

Touch nothing else (hrefs, titles, dates stay bound as-is).

**Verify**: `grep -n "نوشتهٔ" "src/pages/blog/[slug].astro"` → «قبلی» appears in the `older`
block, «بعدی» in the `newer` block.

### Step 2: Pin the mapping with a test

In `tests/blog.test.mjs`, add a test using the file's existing entry fixtures:

```ts
// older (published before) must surface under «قبلی», newer under «بعدی».
// Pin the DATA contract the page depends on: sortByDate is newest-first,
// neighbours().older = published-before, .newer = published-after.
const [a, b] = [entry("2026-02-01", "older-post"), entry("2026-03-01", "newer-post")]; // adapt to real factory
const { older, newer } = neighbours([a, b], /* current */ b);
assert.equal(older?.id, "older-post");
assert.equal(newer, null);
```

Adapt to the actual fixture helpers in that file. This pins the data contract; the page-side
labels are additionally pinned by Step 1's grep in done criteria plus a structural assertion if
the suite already reads built HTML (check whether `tests/blog.test.mjs` or
`tests/structural.test.mjs` inspects `dist/blog/*.html`; if yes, extend that instead).

**Verify**: `node --test tests/blog.test.mjs` → all pass.

### Step 3: Hide the Turnstile container off the final step

In `renderStep()` (`src/scripts/audit/index.ts`), immediately after the existing
turnstile-render block, add:

```ts
if (handles.turnstileContainer) {
  // The widget lives outside the step sections: hide it whenever the user
  // is not on the contact step (rendered lazily on first arrival; token is
  // still consumed at submit time only).
  handles.turnstileContainer.hidden = current !== totalSteps;
}
```

Ensure ordering: when arriving AT the final step the attribute must be cleared BEFORE
`ensureRendered()` runs (Cloudflare measures the container). Reorder so the assignment happens
first inside the same function pass:

```ts
const onContactStep = current === totalSteps;
if (handles.turnstileContainer) handles.turnstileContainer.hidden = !onContactStep;
if (onContactStep && config.turnstileSiteKey && handles.turnstileContainer) {
  bridge ??= new TurnstileBridge(config.turnstileSiteKey, handles.turnstileContainer);
  void bridge.ensureRendered();
}
```

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass.

### Step 4: Test the visibility behavior

In `tests/audit-retry.test.mjs`, find how the harness registers form elements (element registry
used by `document.getElementById`) and ensure a `turnstile-container` element exists there that
records `hidden` assignments (many harness elements already do; mirror them).

Add assertions to an existing journey test that walks forward then back:

- after advancing to the final step: `container.hidden === false`;
- after pressing back («قبلی») to step 5: `container.hidden === true`;
- advancing again to step 6: `container.hidden === false` and the bridge mock's `renders` count
  did NOT increase again (widget persists; only visibility toggles).

If the harness has no walk-back test to extend, create one following the nearest navigation test.

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass.

### Step 5: Timezone-pinned Jalali year

In `src/data/site.ts`:

```ts
export function jalaliYear(date = new Date()): string {
  // Iran's calendar cutover (Nowruz) must not depend on the build machine's TZ.
  const latin = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).format(date);
  return toFaDigits(latin);
}
```

In `tests/site-data.test.mjs`, pin the behavior:

```ts
test("jalaliYear resolves the date in Asia/Tehran", () => {
  // 2026-03-20T22:30:00Z is 2026-03-21T02:00 in Tehran → Jalali year must be 1405.
  assert.equal(jalaliYear(new Date("2026-03-20T22:30:00Z")), "۱۴۰۵");
});
```

Verify the expected literal by running the formatter once locally before asserting
(`node -e 'console.log(new Intl.DateTimeFormat("fa-IR-u-nu-latn",{year:"numeric",timeZone:"Asia/Tehran"}).format(new Date("2026-03-20T22:30:00Z")))'`)
and use whatever it prints — do not guess the digit string.

**Verify**: `node --test tests/site-data.test.mjs` → all pass.

## Test plan

- Blog mapping: `tests/blog.test.mjs` (data contract; built-HTML label assertion if the harness
  supports it).
- Turnstile visibility: `tests/audit-retry.test.mjs` journey assertions (hidden transitions,
  single render).
- Jalali year: `tests/site-data.test.mjs` boundary instant around Nowruz.

Red-first: write the three new tests first, confirm each fails against current code, then apply
its fix.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0; `npm run build` exits 0
- [ ] In built HTML, a blog article with two neighbours renders «قبلی» on the newer-dated link and
      «بعدی» on the older-dated link (verify via the dist HTML of two fixture posts or the test)
- [ ] `grep -n 'timeZone' src/data/site.ts` → matches inside `jalaliYear`
- [ ] `node --test tests/blog.test.mjs tests/site-data.test.mjs tests/audit-retry.test.mjs` all pass
- [ ] `npm test` passes after fresh build; `bash scripts/verify.sh` exits 0
- [ ] No files outside the in-scope list modified; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Excerpts don't match live code.
- Hiding the container breaks widget rendering in a way the journey harness cannot express (e.g.
  tests start failing on token delivery) — do NOT switch to `remove()`/re-create semantics without
  a human decision (that changes retry/token state handling owned by plan 005).
- `Intl` without ICU timezone data throws in the Node used by CI (unlikely on Node ≥22 official
  binaries — full ICU default).
- The blog fixtures cannot express two dated posts (fixture factory missing) — report rather than
  building new infrastructure.

## Maintenance notes

- If a future redesign moves the Turnstile container inside the final step's section, the hidden
  toggle becomes redundant but harmless; remove it then.
- `jalaliYear` is baked into static HTML at build time; rebuild frequency around Nowruz still
  determines freshness — the timezone fix removes the *wrong-year* window, not staleness. If the
  founder wants guaranteed correctness across the cutover week, schedule a rebuild (ops concern,
  out of scope here).
