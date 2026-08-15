# Plan 008: Derive `AUDIT_STATIONS` from `AUDIT_STEPS` (single source of truth)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- src/data/ src/pages/audit.astro tests/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/007-jalali-year-and-dead-exports.md (already applied; also edits `src/data/site.ts`)
- **Category**: tech-debt
- **Planned at**: commit `13ef792`

## Why this matters

The audit journey's station list exists twice: `AUDIT_STATIONS` in
`src/data/site.ts` (feeds the desktop progress rail via `StepperLine`) and
`AUDIT_STEPS` in `src/data/audit.ts` (drives the form and the client state
machine) — same six ids, hand-maintained in parallel with no assertion that
they match. Renaming or reordering a station requires coordinated edits in
two files plus the required-fields map; a missed edit silently desyncs the
progress rail from the actual form on the primary conversion page. This plan
derives the stations from the steps, so drift becomes impossible.

## Current state

- `src/data/site.ts:234-243`:
  ```ts
  export const AUDIT_STATIONS = [
    { id: "business", label: "کسب‌وکار" },
    { id: "channels", label: "کانال‌ها" },
    { id: "problem", label: "مشکل اصلی" },
    { id: "value", label: "ارزش مشتری" },
    { id: "need", label: "نیاز" },
    { id: "contact", label: "تماس" },
  ] as const;
  ```
- `src/data/audit.ts:99-101` — `AUDIT_STEPS: readonly AuditStep[]` where
  each step has `id` and `label` (plus question/description/fields).
- `src/pages/audit.astro:24-25`:
  ```ts
  import { AUDIT_STEPS } from "../data/audit";
  import { AUDIT_STATIONS, CONTACT } from "../data/site";
  ```
  and line 59: `<StepperLine steps={AUDIT_STATIONS} current={1} />`.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Data tests | `node --test tests/site-data.test.mjs` | all pass (exists after plan 007) |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |
| Grep       | `grep -rn "AUDIT_STATIONS" src/ tests/` | only intended sites |

## Scope

**In scope**:
- `src/data/audit.ts`
- `src/data/site.ts`
- `src/pages/audit.astro`
- `tests/site-data.test.mjs`

**Out of scope** (do NOT touch):
- `src/components/business/StepperLine.astro` (its props stay `steps`/`current`)
- `src/scripts/audit.ts`, `src/data/site.ts` exports other than the stations
- Any other file.

## Git workflow

- Commit once at the end:
  `refactor(audit): derive AUDIT_STATIONS from AUDIT_STEPS (one source of truth)`
- Do NOT push or open a PR.

## Steps

### Step 1: Move the station list into the steps module

In `src/data/audit.ts`, after the `AUDIT_STEPS` definition, add:

```ts
/**
 * Audit progress stations — DERIVED from AUDIT_STEPS so the desktop
 * progress rail can never drift from the form (previously duplicated
 * in src/data/site.ts).
 */
export const AUDIT_STATIONS: readonly { id: string; label: string }[] = AUDIT_STEPS.map(
  ({ id, label }) => ({ id, label }),
);
```

In `src/data/site.ts`, delete the `AUDIT_STATIONS` block (and its
"Audit stations" section comment).

**Verify**: `grep -n "AUDIT_STATIONS" src/data/site.ts` → no matches.

### Step 2: Fix the import site

In `src/pages/audit.astro:25`, change to import `AUDIT_STATIONS` from
`../data/audit` (merge into the existing audit import line if cleaner):

```ts
import { AUDIT_STEPS, AUDIT_STATIONS } from "../data/audit";
import { CONTACT } from "../data/site";
```

**Verify**: `npm run check` → exit 0.

### Step 3: Guard test

In `tests/site-data.test.mjs`, add:

```ts
test("audit stations are derived from audit steps (ids + labels)", () => {
  assert.equal(AUDIT_STATIONS.length, AUDIT_STEPS.length);
  for (const step of AUDIT_STEPS) {
    const station = AUDIT_STATIONS.find((s) => s.id === step.id);
    assert.ok(station, `missing station for step ${step.id}`);
    assert.equal(station.label, step.label);
  }
  assert.equal(new Set(AUDIT_STATIONS.map((s) => s.id)).size, AUDIT_STATIONS.length, "station ids must be unique");
});
```

Import `AUDIT_STATIONS` and `AUDIT_STEPS` in that test file. (This test is
tautological today — its value is guarding against someone reintroducing a
parallel hand-maintained list with a *different* derivation.)

**Verify**: `node --test tests/site-data.test.mjs` → all pass.

## Test plan

- Step 3's guard test in `tests/site-data.test.mjs`.

## Done criteria

- [ ] `grep -n "AUDIT_STATIONS" src/data/site.ts` → no matches
- [ ] `grep -n "AUDIT_STATIONS" src/data/audit.ts` → the derived export
- [ ] `npm run check`, `npm test`, `npm run build` all pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- `AUDIT_STATIONS` has consumers other than `audit.astro` (grep first —
  report instead of guessing).
- A station id differs from its step id in the current code (then the lists
  are already drifted — report the difference; do not "fix" the data).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future station renames touch only `AUDIT_STEPS`; the rail follows.
- `StepperLine` still receives `steps`/`current` props — unchanged.
- Reviewer should scrutinize: the derived type keeps `{id, label}` loose
  (string) on purpose so `StepperLine`'s props accept it without changes.
