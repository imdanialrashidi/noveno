# Repository Hygiene

Standing rules for repository hygiene. Each rule exists because a real defect
(or a founder decision) forced it; the mechanical enforcement is listed next to
every rule so drift is caught by CI, not by memory.

## Removed / superseded artifacts — do not recreate

| Artifact                       | Status                           | Evidence / decision                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/PI_WORKFLOW.md`          | **Removed 2026-09**              | Duplicated `README.md` + `docs/HARNESS.md` and drifted; Git authority lives in `docs/GIT_POLICY.md`. Recorded in `docs/RESEARCH.md` (Keep/simplify/remove audit, "Duplicate workflow documents → 1 canonical playbook"). |
| Supabase lead store            | **Removed 2026-10**              | Email-only architecture: no database, no `SUPABASE_*`, no `@supabase/supabase-js`. `docs/exec-plans/active/noveno-launch.md` status note + `docs/ARCHITECTURE.md`.                                                       |
| Flowchart/route visual grammar | **Removed 2026-08-14 (founder)** | `docs/DESIGN.md` §3.1 — never reintroduce node-and-line grammar under another name; enforced by `tests/structural.test.mjs`.                                                                                             |
| Contextual photography         | **Retired 2026-09**              | `docs/DESIGN.md` §3.5 — enforced by `tests/structural.test.mjs` (no binaries under `public/images/photography/`).                                                                                                        |
| `src/pages/insights/`          | **Renamed to `/blog` 2026-10**   | `public/_redirects` 301s; enforced by `tests/seo-contract.test.mjs` + `tests/structural.test.mjs`.                                                                                                                       |

## Working-tree hygiene lessons (keep holding)

1. **Tests that mutate committed fixtures must restore them in a `finally` and
   defensively in `after()`.** On 2026-09-23 a crashed `tests/og-assets.test.mjs`
   run left a 64-byte stub at `public/og/work/isbatab.png`, which failed the
   prebuild OG gate (`npm run build` → `scripts/validate-og-assets.mjs`) and
   therefore every deploy. Recovery: `git show HEAD:<path> > <path>` (never
   `git checkout --` for a tracked fix inside a mutation-denied session), then
   re-run the full gate. The test now restores committed card bytes defensively
   after the suite (`tests/og-assets.test.mjs`).
2. **Formatting is mechanical.** Run `npm run format` (never hand-fix format-only
   feedback). Machine-local harness state (`.pi/`, durable plan
   prose, eval fixtures) is intentionally excluded in `.prettierignore` —
   prettier must not rewrap contract-shaped fixtures.
3. **Never reference a public image by a hard-coded `/images/...` path** — use
   `imageUrl()` from the generated manifest; the structural test fails the build
   on unhashed references.
4. **Secrets stay out of the repository.** `.env.example` carries names only;
   `scripts/pi-doctor.sh` secret scan + `scripts/check-project-contract.mjs`
   env-value scan enforce it.
