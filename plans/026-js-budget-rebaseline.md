# Plan 026: Re-baseline the interactive JS budget after email-only delivery was added

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- package.json tests/structural.test.mjs scripts/lab-benchmark.sh scripts/lab-server.mjs docs/DESIGN.md docs/QUALITY.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 023 (god-module split — budget must be measured after the split, not before; if 023 is deferred, measure the current bundle as-is and note it)
- **Category**: perf
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`docs/DESIGN.md:277` and `docs/QUALITY.md` pin interactive JS at `≤15 KB gzip`. The email-only cutover (`3e33265`) added Web3Forms delivery, `safeText`, receipt echo, and summary logic to `src/scripts/audit.ts` (+~2-3 KB raw). `dist/_astro/audit.astro_*.js` is now ~24K raw (measured 2026-08-21 build) — gzip likely still under budget, but no one has re-baselined it, and the next feature could silently push past the gate. This plan measures the real gzip budget post-cutover, proves the structural test still guards it, and records the new baseline so drift is mechanical, not vibes.

## Current state

Relevant files:
- `docs/DESIGN.md:277` — `interactive JS ≤15KB gzip`
- `docs/QUALITY.md` — CWV lab budget section
- `tests/structural.test.mjs` — `interactive JS ≤15 KB gzip and no client framework runtime` (lines ~170-190)
- `dist/_astro/*.js` artifacts + inline `<script type="module">` counting (same test)
- `package.json:scripts` — `build`, `check`, `test`

Excerpt — `tests/structural.test.mjs` budget test (as of `3e33265`):

```ts
test("interactive JS ≤ 15 KB gzip and no client framework runtime", () => {
  const jsFiles = walk(path.join(dist, "_astro")).filter((f) => f.endsWith(".js"));
  const inlineModules = [];
  for (const file of walk(dist).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
      inlineModules.push(m[1]);
    }
  }
  const total =
    jsFiles.reduce((sum, f) => sum + gzipSync(fs.readFileSync(f)).length, 0) +
    gzipSync(inlineModules.join("\n")).length;
  assert.ok(total <= 15 * 1024, `interactive JS ${total} bytes gzip exceeds 15 KB`);
});
```

Measurement 2026-08-21 (post-cutover, pre-this-plan):
```
dist/_astro/audit.astro_astro_type_script_index_0_lang.Bl-ILTHH.js  24K raw
dist/_astro/analytics.4isesrA9.js                                    4.0K raw
dist/_astro/theme.CJUdJewv.js                                        4.0K raw
dist/_astro/BaseLayout.astro_*.js                                    4.0K raw
dist/_astro/Header.astro_*.js                                        4.0K raw
```
Manual: `node -e "console.log(require('zlib').gzipSync(require('fs').readFileSync('dist/_astro/audit.astro_astro_type_script_index_0_lang.Bl-ILTHH.js')).length)"` is needed to know the real gzip figure — the test above already sums all JS + inline modules. No lab benchmark run (`scripts/lab-benchmark.sh`) was recorded post-cutover.

Repo conventions:
- Astro inlines small page-scoped modules — the test sums both `dist/_astro/*.js` and inline `<script type="module">` (keep it).
- Font budget `≤200KB` is already gated alongside JS — don't change that gate.
- Lab benchmark: `bash scripts/lab-benchmark.sh <outdir>` runs 3× median sweep across 5 routes (mobile+desktop) via `scripts/lab-server.mjs` (Brotli/gzip as Cloudflare).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `npm run build` | 19 pages |
| Budget check | `node --test tests/structural.test.mjs --test-name-pattern="interactive JS"` | single budget test passes |
| Full tests | `npm test` | all pass |
| Manual gzip | `node -e "const z=require('zlib'),fs=require('fs'),p=require('path');const f=p.join('dist','_astro');const files=fs.readdirSync(f).filter(x=>x.endsWith('.js'));let s=0;for(const n of files)s+=z.gzipSync(fs.readFileSync(p.join(f,n))).length;console.log(s+' bytes gzip (_astro/*.js)');"` | prints total |
| Lab (optional) | `bash scripts/lab-benchmark.sh /tmp/lab-026` | writes report under /tmp/lab-026 |

## Scope

**In scope** (only files you should modify):
- `tests/structural.test.mjs` — add per-module breakdown log + optional budget comment update (do NOT loosen the `15*1024` gate)
- `docs/DESIGN.md` or `docs/QUALITY.md` — record the new measured baseline (one line: "measured X KB gzip at 3e33265+026")
- `scripts/lab-benchmark.sh` / `scripts/lab-report.py` — only if you find the benchmark is not wired to CI (no new infra)

**Out of scope** (do NOT touch):
- Changing the `≤15 KB` budget (only re-baseline the measurement, not the target)
- Adding a new client framework or heavy dependency
- `src/scripts/audit.ts` splitting (plan 023) — this plan is measurement only

## Git workflow

- Branch: `advisor/026-js-budget-rebaseline`
- Commit per step; conventional commits (e.g., `chore(perf): ...`)
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Measure the real post-cutover gzip budget

1. `npm run build`
2. Run:
   ```bash
   node -e "
   const {gzipSync}=require('zlib'),fs=require('fs'),path=require('path');
   const dist=path.join('dist','_astro');
   const files=fs.readdirSync(dist).filter(f=>f.endsWith('.js'));
   for(const f of files) console.log(f, fs.readFileSync(path.join(dist,f)).length+' raw', gzipSync(fs.readFileSync(path.join(dist,f))).length+' gzip');
   const total=files.reduce((s,f)=>s+gzipSync(fs.readFileSync(path.join(dist,f))).length,0);
   console.log('TOTAL _astro/*.js gzip:', total, 'bytes');
   "
   ```
3. Also sum inline `<script type="module">` as the test does (or just rely on test failure message which prints `interactive JS ${total} bytes gzip exceeds 15 KB`).
4. Record the numbers in a comment at the top of `tests/structural.test.mjs` budget test (e.g., `// Baselines 2026-08-21: audit 24K raw → X gzip, total Y gzip (budget 15K)`). Do NOT change the assertion.

**Verify**: budget test still passes — if it fails, the budget is already exceeded and you must report (STOP)

### Step 2: Add a per-module breakdown log to the budget test (diagnostic, never breaking)

In `tests/structural.test.mjs`, after the `assert.ok(total <= 15*1024, …)` line, add a non-asserting diagnostic (only when verbose):

```ts
// Diagnostic: per-file gzip breakdown (useful when the next feature adds JS)
if (process.env.VERBOSE || process.env.CI) {
  for (const f of jsFiles) {
    console.log(`  ${path.basename(f)}: ${gzipSync(fs.readFileSync(f)).length} gzip`);
  }
  console.log(`  inline modules: ${gzipSync(inlineModules.join("\n")).length} gzip`);
  console.log(`  total: ${total} gzip (budget ${15*1024})`);
}
```

This makes `npm test` in CI emit the breakdown without changing pass/fail.

**Verify**: `npm test -- --test-name-pattern="interactive JS"` → passes and, with `VERBOSE=1 npm test …`, prints per-file lines

### Step 3: Run the lab benchmark once and record the CWV signal (optional but recommended)

If `scripts/lab-benchmark.sh` is quick (<2 min):

```bash
bash scripts/lab-benchmark.sh /tmp/lab-026
cat /tmp/lab-026/report.md 2>/dev/null || cat /tmp/lab-026/*.json 2>/dev/null | head -80
```

Record the headline (LCP/CLS/INP) in `docs/QUALITY.md` or `docs/DESIGN.md:277` as a one-line measured baseline (e.g., `// Lab 2026-08-21: LCP … CLS … INP … via scripts/lab-benchmark.sh`). No new thresholds.

If the lab run is slow/flaky, skip and note "lab benchmark deferred — requires local Chromium" — still mark plan DONE (budget re-baseline is the primary deliverable).

**Verify**: `npm test` → still green

### Step 4: Build and document

Update `docs/DESIGN.md:277` or `docs/QUALITY.md` perf section with one line: `Measured 2026-08-21 post-email-only: Y KB gzip interactive JS (budget 15 KB), fonts 165 KB (budget 200 KB)` — pin the date and the measurement tool (`tests/structural.test.mjs` bootstrap above).

**Verify**: `npm run check` → exit 0; `bash scripts/project-verify.sh` (if exists) → no failures

## Test plan

- No new behavioral test required — the existing `interactive JS ≤15 KB gzip` test is the pin. It must keep passing.
- New diagnostic log is verified by: `VERBOSE=1 npm test -- --test-name-pattern="interactive JS"` → per-file gzip lines appear, total = prior VERBOSE=0 total.
- Optional lab: `bash scripts/lab-benchmark.sh` → report artifact exists under `/tmp/lab-026` (not committed).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; budget test `interactive JS ≤15 KB gzip` passes
- [ ] `VERBOSE=1 npm test -- --test-name-pattern="interactive JS"` emits per-file gzip breakdown lines
- [ ] `docs/DESIGN.md` or `docs/QUALITY.md` contains the 2026-08-21 measured gzip line
- [ ] `grep -rn "VERBOSE" tests/structural.test.mjs` returns a hit (diagnostic)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- The budget test already fails before your change (`interactive JS ... exceeds 15 KB`) — the budget is blown; report the per-file breakdown and propose a split/thinning, don't silently loosen the gate
- `dist/_astro/*.js` files are not produced by `npm run build` (Astro config drift)
- `scripts/lab-benchmark.sh` requires a non-default Chrome/Chromium that isn't available — skip lab, keep measurement, mark plan DONE with "lab deferred"

## Maintenance notes

- Reviewer should check that the `15*1024` assertion was not loosened — the budget is the product requirement (`docs/DESIGN.md:277`).
- Future JS additions (new audit steps, analytics) must be thinned or code-split if the total approaches 15 KB. The per-file log will show which module pushed it.
- When `D-01` (server-side email) lands, the client-side Web3Forms payload code will shrink — the next re-baseline should then expect a lower total.
