# Plan 009: Cache npm dependencies in CI and de-duplicate the install

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- .github/workflows/quality.yml`
> If the workflow file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

Every CI run pays the full pipeline twice with zero caching:
`.github/workflows/quality.yml` has two jobs (`workflow-doctor` and `app`),
both run `bash scripts/ci-install.sh` (a cold `npm ci` of the whole
wrangler/esbuild/tailwind tree) and both run a full build, with no
`actions/cache` or `setup-node` cache. The two-lane design is deliberate
(harness lane + app lane); the redundancy is not. Caching the npm store
keyed on `package-lock.json` is semantics-preserving and removes the largest
fixed cost from the feedback loop.

## Current state

`.github/workflows/quality.yml` — both jobs use:

```yaml
      - name: Set up Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 22.23.2

      - name: Install pinned packages
        run: bash scripts/ci-install.sh
```

(`workflow-doctor` job) and the equivalent `Install app dependencies` step in
the `app` job. `scripts/ci-install.sh` runs `npm ci` when
`package-lock.json` exists. The workflow pins actions by immutable SHA with
`# vX.Y.Z` comments — match that convention for any added action.

## Repo conventions to match

- All actions pinned by full commit SHA + version comment (see the existing
  `actions/checkout@3d3c42e5... # v7.0.1` lines).
- Keep the two-job structure; do not merge jobs.
- Do not change the workflow's `permissions` or `concurrency` blocks.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Local typecheck | `npm run check` | exit 0 |
| Local tests | `npm run test` | all pass |
| YAML sanity | `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/quality.yml')); print('ok')"` | prints `ok` (if pyyaml is unavailable, use `npx --yes actionlint .github/workflows/quality.yml` or a careful manual review and say so) |

Note: the real verification is CI green after the branch is pushed — that is
operator/CI evidence outside this plan's local scope; state it in the done
criteria.

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/quality.yml`

**Out of scope** (do NOT touch):
- `scripts/ci-install.sh` — the install logic is fine; caching happens at
  the workflow level.
- The `.pi/verification.json` routes and any other workflow files.
- Adding npm advisory auditing to CI — that is plan 015.

## Git workflow

- Branch: `improve/009-ci-caching`
- Commit message style (match the repo): `ci: cache npm dependencies in both jobs`
- Do NOT push or open a PR unless the operator instructed it (CI evidence is
  produced after a push by the operator).

## Steps

### Step 1: Add npm caching to both setup-node steps

In both jobs (`workflow-doctor` and `app`), change the `Set up Node` step to:

```yaml
      - name: Set up Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 22.23.2
          cache: npm
```

`cache: npm` makes setup-node derive the cache key from
`package-lock.json` (present in this repo) and restore the npm store before
`npm ci` in `scripts/ci-install.sh` runs — no extra action needed.

**Verify**: the YAML sanity command above prints `ok`; `grep -n "cache: npm" .github/workflows/quality.yml` shows two occurrences (one per job).

### Step 2: Confirm nothing else needs to change

Check `scripts/ci-install.sh` needs no modification for cache hits (it
runs plain `npm ci`, which benefits from a warm store). Confirm the
workflow still has exactly the same steps otherwise.

**Verify**: `git diff .github/workflows/quality.yml` shows ONLY the two
`cache: npm` additions.

## Test plan

- No repository tests apply to a workflow file; the verification is: YAML
  parses, the diff is minimal, and (after operator push) CI is green on the
  branch. Note in the done criteria that the CI run itself is operator-side
  evidence.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] YAML sanity command exits 0 (or the alternative reviewer noted)
- [ ] `git diff .github/workflows/quality.yml` contains only the two `cache: npm` lines
- [ ] `npm run check` exits 0 (unchanged behavior locally)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] (Operator-side, after push) both CI jobs green with cache hits — record in the plan row when observed

## STOP conditions

Stop and report back (do not improvise) if:

- The workflow file at the cited lines doesn't match the excerpts (it may
  have been edited — reconcile, don't overwrite).
- `cache: npm` is rejected by the pinned setup-node version (v7 supports
  it; if not, STOP and report rather than switching to a different action).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- When `package-lock.json` changes, the cache key changes — first CI run
  after a dependency bump is a cold install; that is expected and correct.
- If the repo ever moves to pnpm/yarn, `cache: npm` must change to
  `cache: pnpm`/`cache: yarn` with the matching lockfile.
- The two jobs still build twice (by design); if build time ever dominates,
  a shared build-artifact upload/download is the next step — deliberately
  out of scope here.
