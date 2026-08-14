# Plan 012: Add the case-study intake guide (content template + honesty checklist)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- docs/ops/case-study-intake.md src/content.config.ts src/content/work/`
> If `src/content.config.ts` or the content files changed since this plan
> was written, compare the schema excerpts below against the live file; on
> a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The proof journey is the site's differentiator ("Every case study real,
every result evidence-backed" — PRODUCT.md acceptance) yet
`src/content/work/` holds 1 project + 2 concepts and **zero case studies**.
The authoring rules are real and strict — the zod schema in
`src/content.config.ts` REQUIRES `metric.verified: z.literal(true)` +
`source` and `client.public: z.literal(true)` for case studies; DESIGN §4.3
imposes line-code/tag rules per proof type; Spec §18-19 define the honesty
grammar — but they are scattered across three docs. The first real
engagement will arrive post-launch (Spec §72 Phase 2) and the founder or a
future agent will have to reverse-engineer the union schema to publish it.
This plan delivers a single intake guide so the first real case study ships
without breaking the honesty contract — content-creation tooling only, zero
code changes.

## Current state

- `src/content.config.ts` — the `work` collection schema: a
  `z.discriminatedUnion("type", [...])` with three shapes:
  - `case-study`: `client: z.object({ name: z.string(), public: z.literal(true) })`,
    `metrics: z.array(metric).default([])` where
    `metric = z.object({ name, value, unit?, period?, baseline?, source,
    verified: z.literal(true), note? })`, plus `limitations`, `featured`,
    optional `timeline`/`scope`/`problem`/`solution`/`components`.
  - `project`: same shape but `client` optional with `public: z.boolean()`
    and an `outcome: z.enum(["measuring", "unknown"]).default("measuring")`.
  - `concept`: `client` optional (`public: z.literal(false)`), `goals` and
    `kpis` arrays instead of outcome/metrics claims.
  - All shapes: `type`, `title`, `industry`, `summary`, `published_at:
    z.coerce.date()` required.
- `src/content/work/noveno-website.md` — the "project" exemplar; note its
  `outcome: "measuring"` honesty marker and how metrics are phrased with
  sources.
- `src/content/work/clinic-acquisition-concept.md` — the "concept"
  exemplar; design goals + proposed KPIs, no results.
- DESIGN §4.3 (docs/DESIGN.md) — per-type proof rules (line-code/tag
  presentation for verified metrics vs labeled demos); Spec §18-19
  (docs/Noveno_Website_Master_Spec.md) — no fabricated proof; Spec §21 —
  the repeatable case-study structure.

## Repo conventions to match

- Docs under `docs/ops/` are short, founder-sized, single-operator (see
  `docs/ops/runbook.md` tone).
- Content files are Persian-first markdown; frontmatter ids are Latin;
  labels Persian.
- The honesty invariants are non-negotiable: never suggest fabricating or
  "rounding" results; every metric needs `source` + `verified: true` or it
  will (correctly) fail `npm run check`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 (the schema is type-checked by astro check) |
| Content tests | `node --test tests/content.test.mjs` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `docs/ops/case-study-intake.md` (create)

**Out of scope** (do NOT touch):
- `src/content/work/` — do NOT add a template file there: the loader globs
  `**/*.md` and any committed file becomes a live entry on `/work` AND must
  pass the schema (a placeholder can break the build or ship junk to the
  site). The skeleton lives in the intake doc as a code block.
- `src/content.config.ts` — the schema is the guard; it stays as is.
- Actual case-study content — none exists yet by design (no fabricated
  proof); this plan only prepares the authoring path.

## Git workflow

- Branch: `improve/012-case-study-intake`
- Commit message style (match the repo): `docs(ops): add case-study intake guide (template + honesty checklist)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write `docs/ops/case-study-intake.md`

Sections (match runbook brevity; Persian where the founder reads it,
English identifiers):

1. **When to publish** — the three types in one table:
   `case-study` (real client + real verified results), `project` (real
   implementation, outcome «در دست اندازهگیری»/«نامشخص»), `concept`
   (fictional/demo, goals + proposed KPIs only). The deciding question:
   "is there a real client with real evidence?" — if not, it is a
   project/concept, never a case study.
2. **The skeleton** — a fenced code block with the full `case-study`
   frontmatter (every field from the schema, with a short comment per
   field in Persian/English), PLUS the `project` and `concept` skeletons
   (or one skeleton with the type-specific fields marked). Read
   `src/content/work/noveno-website.md` and
   `src/content/work/clinic-acquisition-concept.md` while writing it and
   mirror their tone.
3. **Metric rows** — the exact `metric` shape with the rule in bold:
   `verified: true` + `source` are REQUIRED (schema-enforced); a metric
   without evidence fails the build. Guidance on phrasing limitations
   (`limitations` array) and baselines (`baseline` + `period`).
4. **Honesty checklist** (before publish) — bullet list: real client?
   evidence exists? no invented numbers; no fake testimonials/logos;
   demo/concept labeled; no guaranteed-sales language; Persian copy
   natural (Spec §18-19, §53-54).
5. **Publish steps** — create the file under `src/content/work/<slug>.md`,
   then: `npm run check` (schema + typecheck), `node --test
   tests/content.test.mjs` (content-honesty tests), `npm run build`,
   browser-check `/work` and `/work/<slug>` (DESIGN §15 screen 6), and
   record the source-of-truth reference for the metric.

**Verify**: file exists; `grep -n "verified: true" docs/ops/case-study-intake.md` → the metric skeleton contains it; `bash scripts/verify.sh` exits 0.

### Step 2: Link it from the runbook

In `docs/ops/runbook.md`, in the "Lead pipeline" section (or a new
"Publishing proof content" line), add:

```markdown
- Publishing proof content (`/work`): follow
  `docs/ops/case-study-intake.md` — the schema enforces the honesty
  contract (`npm run check` fails on a metric without evidence).
```

**Verify**: `grep -n "case-study-intake" docs/ops/runbook.md` → present; `bash scripts/verify.sh` exits 0.

## Test plan

- Doc-only: no new tests. `tests/content.test.mjs` already guards content
  honesty for existing files; the intake doc does not alter it.
- Sanity: confirm the skeleton in the doc would pass the schema if copied
  into a real file (mentally or via a scratch file in /tmp + `npm run
  check` — do NOT commit the scratch file; if you do the scratch check,
  note the result in the report).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `docs/ops/case-study-intake.md` exists with: types table, case-study skeleton incl. `verified: true` + `source`, honesty checklist, publish steps
- [ ] `grep -n "case-study-intake" docs/ops/runbook.md` → link present
- [ ] `npm run check` exits 0; `node --test tests/content.test.mjs` passes; `bash scripts/verify.sh` exits 0
- [ ] `git status` shows no files under `src/content/` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/content.config.ts`'s schema differs from the excerpts (drift) —
  reconcile the doc to the live schema.
- You feel tempted to add a template file under `src/content/work/` —
  STOP; that is explicitly out of scope (it would render on the live site).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The first REAL case study is the highest-leverage post-launch content
  (Spec §72 Phase 2) — when it lands, review the intake doc against what
  the author actually needed and tighten it.
- If the schema changes (e.g. new fields), update this intake doc in the
  SAME change — it is the schema's human face.
- DESIGN §15 screen 6 (case-study long-content state) is UNPROVEN until a
  real case study exists — the intake doc's publish steps are where that
  proof gets recorded.
