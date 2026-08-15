# Plan 018: Single-lane verification gate (one build, one suite per push)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- scripts/verify.sh scripts/pi-doctor.sh .github/workflows/quality.yml tests/gate-order.test.mjs package.json`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none — but run LAST among code plans (it changes the gate every other plan verifies against)
- **Category**: dx
- **Planned at**: commit `13ef792`

## Why this matters

The canonical gate does the same work twice (or thrice): `scripts/verify.sh`
builds the project, then `pi-doctor.sh --ci` runs the full test suite, then
`verify.sh` runs `npm run ci` — which is `check + build + test` again.
GitHub CI runs that whole `verify.sh` (job `workflow-doctor`) AND a parallel
`app` job that does `check + build + test` again. Every push pays for ~3
builds and 2-3 full suite runs, and the two lanes can disagree about what
"green" means. This plan makes `verify.sh` the single lane (build →
pi-doctor suite → `npm run check` → project-verify) and removes the parallel
`app` job, while preserving the build-before-test ordering contract pinned
by `tests/gate-order.test.mjs`.

## Current state

- `scripts/verify.sh:17-31` — builds the project (npm run build), then
  `bash scripts/pi-doctor.sh --ci` (runs `node --test tests/*.test.mjs`),
  then `scripts/project-verify.sh` (exec'd), then falls through to:
  ```bash
  if [[ -f package.json ]]; then
    if node -e "..." ; then
      ran=1
      ... npm run ci        # ← check + build + test AGAIN
  ```
- `package.json` — `"ci": "npm run check && npm run build && npm run test"`.
- `.github/workflows/quality.yml` — two jobs: `workflow-doctor` (runs
  `bash scripts/verify.sh`) and `app` (runs `npm run check`, `npm run
  build`, `npm test`) in parallel; `concurrency` group per ref; no caching.
- `tests/gate-order.test.mjs` — pins: (1) `ci` script builds before it
  tests; (2) `verify.sh` builds before it calls pi-doctor.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Syntax     | `bash -n scripts/verify.sh` | exit 0 |
| Gate tests | `node --test tests/gate-order.test.mjs` | all pass (updated) |
| Full gate  | `bash scripts/verify.sh`    | exit 0, one build + one suite |
| Full suite | `npm test`                  | all pass |
| Check      | `npm run check`             | exit 0 |

## Scope

**In scope**:
- `scripts/verify.sh`
- `.github/workflows/quality.yml`
- `tests/gate-order.test.mjs`

**Out of scope** (do NOT touch):
- `scripts/pi-doctor.sh`, `scripts/project-verify.sh` (keep as-is)
- `package.json` (`ci` script stays — local developers still use it; only
  verify.sh stops re-running it)
- Any other file.

## Git workflow

- Commit once at the end:
  `dx: make verify.sh the single verification lane (one build, one suite)`
- Do NOT push or open a PR.

## Steps

### Step 1: verify.sh — drop the redundant `npm run ci` fallback

Read `scripts/verify.sh` fully. Keep the explicit build and the
`pi-doctor.sh --ci` call (the build-before-doctor relationship is pinned).
Replace the `npm run ci` fallback block with a single `npm run check`:

```bash
# The workflow suite already ran inside pi-doctor --ci; the build already
# happened above. Only the typecheck remains — re-running `npm run ci`
# (check + build + test) here would triple the gate's work.
run_node_script "check"
```

Keep the surrounding structure (the `ran=1` bookkeeping and the fallback
chain for projects without a `ci` script — read the actual script and make
the minimal edit: change `run_node_script "ci"` to `run_node_script
"check"` inside that branch, or restructure the branch to run "check" when
it exists and otherwise keep the old fallback chain; whichever is
cleanest, do not remove the build-before-doctor lines).

**Verify**: `bash -n scripts/verify.sh` → exit 0. Read the edited script
end-to-end and confirm: build → pi-doctor → project-verify → check, with no
second `npm run build` and no `npm run ci`.

### Step 2: gate-order.test.mjs — pin the new shape

In `tests/gate-order.test.mjs`, keep the two existing tests and add a third:

```js
test("verify.sh must not re-run the full ci script after pi-doctor", () => {
  const verify = fs.readFileSync(path.join(root, "scripts", "verify.sh"), "utf8");
  assert.ok(
    !/npm run ci/.test(verify),
    "verify.sh must not re-run `npm run ci` (check+build+test) — pi-doctor already ran the suite and the build happened above",
  );
  const lines = verify.split("\n");
  const doctorLine = lines.findIndex((l) => l.includes("pi-doctor.sh"));
  const checkLine = lines.findIndex((l) => l.includes("run_node_script \"check\"") || l.includes("npm run check"));
  assert.notEqual(checkLine, -1, "verify.sh must run npm run check");
  assert.ok(doctorLine < checkLine, "the check must come after the doctor suite");
});
```

**Verify**: `node --test tests/gate-order.test.mjs` → all pass.

### Step 3: quality.yml — single lane

In `.github/workflows/quality.yml`, remove the `app` job entirely;
`workflow-doctor` (which runs `bash scripts/verify.sh`) becomes the only
job. Keep the `concurrency` group and `permissions`. Optionally add
`actions/cache` for the npm cache in the doctor job — only if it is simple
to do correctly; otherwise leave caching out (scope discipline) and note it.

**Verify**: the workflow file parses — if `yaml` is available
(`node -e "require('yaml')"` succeeds, added by plan 016), run:
`node -e "const y=require('yaml'),fs=require('fs'); const w=y.parse(fs.readFileSync('.github/workflows/quality.yml','utf8')); if (!w.jobs['app'] && w.jobs['workflow-doctor']) console.log('ok'); else { console.error('bad'); process.exit(1); }"` → prints ok.

### Step 4: Prove the single-lane gate end-to-end

**Verify**: `bash scripts/verify.sh` → exit 0. Confirm from its output that
`npm run build` and the test suite each ran exactly once (count occurrences
of "build" and the test summary in the output; report the counts). Then
`npm test` → all pass.

## Test plan

- Step 2's new gate-order test (defect-sensitive: fails if anyone
  re-adds `npm run ci` to verify.sh).

## Done criteria

- [ ] `bash scripts/verify.sh` exits 0 with one build and one suite run
- [ ] `grep -n "npm run ci" scripts/verify.sh` → no matches
- [ ] `grep -n "app:" .github/workflows/quality.yml` → no matches (the job is gone)
- [ ] `node --test tests/gate-order.test.mjs` passes with the new test
- [ ] `npm test` and `npm run check` pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- `verify.sh`'s structure differs materially from the description (read it
  first; adapt minimally and note it).
- Removing the `app` job would lose a check that `workflow-doctor` does not
  perform (compare the two jobs' steps before removing — they overlap
  fully today: check, build, test).
- `bash scripts/verify.sh` fails — report the failure; do not bypass it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The `ci` npm script remains the local one-liner (check+build+test) —
  verify.sh just stops duplicating it. If CI needs a faster local loop
  later, add caching rather than a second lane.
- The exec-plan gate evidence (120/120) referenced `npm run ci` ordering —
  `gate-order.test.mjs` remains the contract; docs updates are covered by
  plan 019.
- Reviewer should scrutinize: the build-before-pi-doctor lines are
  untouched, and the workflow diff removes ONLY the `app` job.
