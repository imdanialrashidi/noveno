# Plan 007: Fix the Jalali-year March boundary; delete dead site.ts exports

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- src/data/site.ts src/pages/index.astro tests/`
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

`jalaliYear()` in `src/data/site.ts` computes the Persian year with
`date.getMonth() + 1 >= 3` — treating the whole month of March as the new
year. The Nowruz cutover is 21 March: from March 1-20 the correct Jalali
year is the previous one. Its own docstring says "1405 for 2026-03-21
onward", so for ~3 weeks every year the footer's copyright year is wrong
(builds between March 1-20). The homepage independently formats the same
dates with `Intl.DateTimeFormat("fa-IR", ...)` — two divergent algorithms
for the same calendar. Fix: make `jalaliYear` Intl-based (correct by
construction), and remove three dead exports from the same file.

## Current state

- `src/data/site.ts:269-273`:
  ```ts
  /** Persian (jalali) year at build time: 1405 for 2026-03-21 onward. */
  export function jalaliYear(date = new Date()): string {
    const year =
      date.getMonth() + 1 >= 3 ? date.getFullYear() - 621 : date.getFullYear() - 622;
    return toFaDigits(year);
  }
  ```
- `src/components/layout/Footer.astro:13` — uses `jalaliYear()` for the
  copyright year.
- `src/pages/index.astro:69-71`:
  ```ts
  const jalali = (date: Date) => {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long" }).format(date);
  };
  ```
- Dead exports in `src/data/site.ts` (grep-verified zero import sites):
  `SITE_NAME_FA` (~line 55), `MEASURED_ACTIONS` (~line 220),
  `CONCEPT_UI_LABEL` (~line 256). `CONCEPT_DISCLAIMER` is used — keep it.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Data tests | `node --test tests/site-data.test.mjs` | all pass (new file) |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |
| Dead-export grep | `grep -rn "SITE_NAME_FA\|MEASURED_ACTIONS\|CONCEPT_UI_LABEL" src/ tests/` | no matches after deletion |

## Scope

**In scope**:
- `src/data/site.ts`
- `tests/site-data.test.mjs` (create)

**Out of scope** (do NOT touch):
- `src/pages/index.astro` — its local `jalali` formatter stays (it formats
  year+month for article dates); the fix makes both algorithms correct.
- `src/components/layout/Footer.astro` — keeps calling `jalaliYear()`.
- Any other file.

## Git workflow

- Commit once at the end:
  `fix(build): correct Jalali year at the Nowruz boundary; drop dead site.ts exports`
- Do NOT push or open a PR.

## Steps

### Step 1: Make `jalaliYear` Intl-based

In `src/data/site.ts`, replace the implementation with:

```ts
/**
 * Persian (jalali) year at build time — Intl-computed so the Nowruz
 * cutover (21 March) is handled by the CLDR data, not a hand-rolled
 * month approximation (the old `getMonth() + 1 >= 3` was wrong for
 * March 1-20). `-u-nu-latn` keeps Latin digits; callers wrap with
 * toFaDigits when Persian digits are wanted.
 */
export function jalaliYear(date = new Date()): string {
  return new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric" }).format(date);
}
```

Check the callers: if `Footer.astro` passes the result through `toFaDigits`
or renders it directly, keep behavior consistent (the function now returns
Latin digits — same as before, since the old code also returned Latin digits
and callers converted). Read `Footer.astro` to confirm; do not change it.

**Verify**: `node -e "import('./src/data/site.ts').then(m => { console.log(m.jalaliYear(new Date('2026-03-15'))); console.log(m.jalaliYear(new Date('2026-03-21'))); console.log(m.jalaliYear(new Date('2026-01-01'))); })"` — but `src/data/site.ts` is TypeScript; use the test in Step 3 instead, or `npx tsx` if available. If no TS runner is available, rely on Step 3's tests.

### Step 2: Delete the dead exports

Remove `SITE_NAME_FA`, `MEASURED_ACTIONS`, and `CONCEPT_UI_LABEL` from
`src/data/site.ts`.

**Verify**: `grep -rn "SITE_NAME_FA\|MEASURED_ACTIONS\|CONCEPT_UI_LABEL" src/ tests/ scripts/` → no matches. Then `npm run check` → exit 0 (this catches any import I missed).

### Step 3: Regression tests

Create `tests/site-data.test.mjs` (pattern: plain `node:test` + `assert`,
importing from `../src/data/site.ts` — check how `tests/audit-retry.test.mjs`
imports TS source and mirror it):

```js
test("jalaliYear: Nowruz boundary (2026-03-21 onward is 1405)", () => {
  assert.equal(jalaliYear(new Date("2026-03-21T12:00:00Z")), "1405");
  assert.equal(jalaliYear(new Date("2026-03-31T12:00:00Z")), "1405");
});
test("jalaliYear: March 1-20 is still the previous year (1404)", () => {
  assert.equal(jalaliYear(new Date("2026-03-01T12:00:00Z")), "1404");
  assert.equal(jalaliYear(new Date("2026-03-20T23:59:59Z")), "1404");
});
test("jalaliYear: early year and year end", () => {
  assert.equal(jalaliYear(new Date("2026-01-01T12:00:00Z")), "1404");
  assert.equal(jalaliYear(new Date("2026-12-31T12:00:00Z")), "1405");
  assert.equal(jalaliYear(new Date("2027-03-20T12:00:00Z")), "1405");
});
```

Defect sensitivity: the first two tests fail on the old implementation
(March 1-20 would return "1405"). Note: these tests use UTC dates — if the
machine's timezone shifts the date, use local-time constructors
(`new Date(2026, 2, 21)` etc.) instead; pick whichever is stable on the
machine and note it in the file.

**Verify**: `node --test tests/site-data.test.mjs` → all pass.

## Test plan

- New `tests/site-data.test.mjs` per Step 3.

## Done criteria

- [ ] `grep -n "getMonth() + 1 >= 3" src/` → no matches
- [ ] `grep -rn "SITE_NAME_FA\|MEASURED_ACTIONS\|CONCEPT_UI_LABEL" src/ tests/ scripts/` → no matches
- [ ] `node --test tests/site-data.test.mjs` passes (≥4 assertions incl. the March boundary)
- [ ] `npm run check`, `npm test`, `npm run build` all pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the three "dead" exports actually has an import site (grep first —
  if found, report; do not delete).
- `Intl.DateTimeFormat("fa-IR-u-nu-latn", ...)` returns Persian digits on
  this Node build (it should return Latin digits; if not, wrap the result
  through `toFaDigits` only when digits are already Latin — verify with the
  tests and report the behavior).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `index.astro`'s `jalali` formatter and `jalaliYear` now both delegate to
  Intl — they cannot disagree on the year again.
- The footer renders the build-time year; a rebuild near 21 March now
  flips on the correct day.
- Reviewer should scrutinize: timezone handling in the tests (local vs UTC)
  and that no caller depended on the removed exports.
