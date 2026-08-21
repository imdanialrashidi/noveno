# Plan 009: Measure and resolve font-preload contention on image-LCP work routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- src/layouts/BaseLayout.astro src/layouts/PageLayout.astro "src/pages/work/[slug].astro" tests/structural.test.mjs scripts/lab-benchmark.sh scripts/lab-server.mjs`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S–M (measurement is most of it)
- **Risk**: LOW–MED (revert path built into the plan; homepage must not regress)
- **Depends on**: none hard; run AFTER 006/008 so measurements land on the final tree
- **Category**: perf (measure-first spike with an adopt-or-revert decision)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

`BaseLayout` emits a `fetchpriority="high"` font preload for Estedad on **every** page — correct
for text-LCP pages (the homepage headline IS the LCP; the structural tests pin that). But the six
`/work/[slug]` routes independently preload their hero screenshot at high priority because there
the image IS the LCP ("measured LCP regression" per its own comment). Two high-priority preloads
contend for the first network window on exactly the slow-Iranian-mobile audience this product
targets. The team already fixed this exact contention class once (Vazirmatn preload removed after
a measured regression — recorded in BaseLayout's comment). This plan applies the same measured
discipline to the remaining overlap instead of guessing.

**This is a measurement-first plan**: if the lab shows no meaningful win, the correct outcome is
REVERT and record "no action needed" — that is success, not failure.

## Current state

### Font preload — `src/layouts/BaseLayout.astro` (~lines 120–128)

```html
<!-- LCP text is the hero headline → preload its face only (§5.3).
     Vazirmatn stays CSS-discovered (font-display: swap with the
     metric-matched fallback): preloading it competed with the LCP
     image on throttled mobile and regressed LCP (measured). -->
<link rel="preload" href="/fonts/estedad-arabic-wght-normal.woff2" as="font"
      type="font/woff2" crossorigin fetchpriority="high" />
```

Unconditional on all routes.

### Image LCP preload — `src/pages/work/[slug].astro` (~lines 62–77)

```astro
{preview.type === "image" && preview.src && (
  <link slot="head" rel="preload" as="image" href={preview.src}
        imagesrcset={preview.srcset} imagesizes="(min-width: 1024px) 1136px, 92vw"
        type="image/webp" fetchpriority="high" />
)}
```

Head content reaches `<head>` via the named-slot forwarding through `PageLayout`
(`PageLayout` renders `BaseLayout` and forwards its head slot — preserved deliberately by a past
review fix; verify the mechanism when reading the file).

### Structural test constraint — `tests/structural.test.mjs`

~line 88: built CSS/preload wiring for the hero face is asserted (read the exact assertion);
~lines 140–147 pin HOMEPAGE rules (`no hero image preload`, `no eager images`). Any change here
must keep both green — check whether the Estedad preload assertion pins the `fetchpriority` value
itself.

### Measurement harness (exists, use it)

- `npm run build && node scripts/lab-server.mjs` — serves `dist/` with Brotli/gzip like Cloudflare.
- `bash scripts/lab-benchmark.sh <outdir>` — 3×median sweep across five representative routes,
  mobile + desktop. Read the script header first for output format and prerequisites (Chrome/CDP
  availability). `/work/noveno-website` is among the swept routes.

### Repo conventions

- Performance decisions are recorded where they're made (BaseLayout comments reference DESIGN §5.3
  and prior measurements); update those comments if behavior changes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Serve dist | `node scripts/lab-server.mjs` | serves on its documented port |
| Benchmark sweep | `bash scripts/lab-benchmark.sh .artifacts/lab/font-preload-a` | exit 0, JSON/markdown artifacts |
| Structural suite | `node --test tests/structural.test.mjs` (after build) | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `src/layouts/BaseLayout.astro` (+ `src/layouts/PageLayout.astro` ONLY if prop forwarding is required)
- `"src/pages/work/[slug].astro"` — pass the override prop
- `tests/structural.test.mjs` — only if it pins the exact preload attributes
- `.artifacts/lab/**` measurement outputs (gitignored dir)
- `docs/DESIGN.md` §5.3 note + `CHANGELOG.md` IF the change is adopted
- `plans/README.md` — status row

**Out of scope**:
- Changing font files, `@font-face` declarations, or caching.
- Touching the homepage/headline-LCP wiring (pinned by tests).
- New dependencies (no lighthouse CI integrations; the existing shell harness suffices).

## Git workflow

- Branch: `improve/009-font-preload-measure`
- Conventional commits: `perf(work): deprioritize font preload on image-LCP routes (measured)`
  — or `revert(perf): font-preload experiment showed no win (recorded)` if reverting.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

```bash
npm run build
node scripts/lab-server.mjs &          # per script docs; note port
bash scripts/lab-benchmark.sh .artifacts/lab/font-preload-baseline
```

Record median LCP for `/work/noveno-website` (mobile profile especially), plus the other four
routes as guardrails (homepage must not regress later).

**Verify**: artifacts exist under `.artifacts/lab/font-preload-baseline/`; numbers transcribed
into your working notes / commit message draft.

### Step 2: Implement the route-scoped override

1. Add an optional prop to `BaseLayout`:

```astro
interface Props {
  ...
  /** Routes whose LCP is an image set "low" so the font stops contending
   *  with the hero-image preload in the first network window. Default keeps
   *  the text-LCP behavior pinned by structural tests. */
  fontPreloadPriority?: "high" | "low";
}
const { fontPreloadPriority = "high", ... } = Astro.props;
```

and bind it: `fetchpriority={fontPreloadPriority}` on the font preload link.

2. Forward through `PageLayout` only if `PageLayout` does NOT already spread props into
   `BaseLayout` (inspect first; mirror however `ogImage` reaches BaseLayout today).
3. In `work/[slug].astro`, pass `fontPreloadPriority={preview.type === "image" ? "low" : "high"}`
   (concept entries without image previews keep the default).

Run `npm run build`; inspect one work page's HTML: the font link now carries
`fetchpriority="low"` while the homepage's stays `"high"`.

**Verify**: `grep -o 'rel="preload"[^>]*estedad[^>]*' dist/work/noveno-website/index.html` → contains `fetchpriority="low"`; same grep on `dist/index.html` → `"high"`.

### Step 3: Re-measure and decide

```bash
npm run build && node scripts/lab-server.mjs &
bash scripts/lab-benchmark.sh .artifacts/lab/font-preload-low
```

Decision rule (write it down before looking):

- **Adopt** if `/work/*` median LCP improves by ≥3% AND no other route regresses ≥3%.
- **Revert** otherwise. Either way, record the two medians in the commit message and, if adopted,
  a one-line note in `DESIGN.md` §5.3 area ("work detail routes request the face at low priority;
  measured <date>") plus CHANGELOG.

**Verify**: `node --test tests/structural.test.mjs` passes (update it FIRST if it pins
`fetchpriority="high"` literally — make the assertion accept the attribute with either priority
on non-home pages while keeping the homepage pin strict).

### Step 4: Full gate

```bash
bash scripts/verify.sh
```

**Verify**: exit 0 regardless of adopt/revert outcome.

## Test plan

No new unit tests: the deliverable is a measured decision. Structural suite updated only if it
over-pinned the attribute (Step 3). Keep before/after artifacts in `.artifacts/lab/` (gitignored)
and cite them in the PR description.

## Done criteria

ALL must hold:

- [ ] Baseline + variant artifacts exist with transcribed medians in the commit message/PR body
- [ ] Adopt OR revert completed per the written decision rule — no third state
- [ ] `npm run check`, `npm run build`, `npm test`, `bash scripts/verify.sh` all exit 0
- [ ] Homepage font preload still `fetchpriority="high"` (built HTML grep)
- [ ] Docs/CHANGELOG updated iff adopted; `plans/README.md` status row updated with the outcome

## STOP conditions

Stop and report back if:

- The lab harness cannot run in this environment (no Chrome/CDP) — report; the plan then blocks
  on a machine that can measure (do NOT ship the change unmeasured).
- Structural tests pin the font preload more tightly than expected such that the override
  requires relaxing a security/perf assertion (needs human sign-off).
- PageLayout/BaseLayout prop plumbing has changed shape since planning.

## Maintenance notes

- If a future route gains an image LCP, opt it into `"low"` the same way; the default protects
  text-LCP pages.
- Reviewers should demand the two benchmark artifacts, not trust the summary.
