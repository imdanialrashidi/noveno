# Plan 013: Make doc truth machine-checked (extend the project-contract gate)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- scripts/check-project-contract.mjs tests/project-contract.test.mjs README.md docs/PRODUCT.md docs/Noveno_Website_Master_Spec.md`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> Execute AFTER plan 010 — several invariants below assert facts that plan
> fixes. If 010 hasn't landed, its items will fail here by design; stop and
> sequence correctly instead of weakening assertions.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: LOW–MED (gate additions can annoy future legitimate edits — keep the list tiny per the repo's own contract philosophy)
- **Depends on**: plans/010-docs-reconcile.md (hard)
- **Category**: direction / dx (docs drift protection)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

This cycle found four doc-vs-code contradictions (README describing inverted structural-test
behavior; stale `/insights` routes in the primary spec; PRODUCT listing settled decisions as
open; a directory map missing the newest modules). All were exact, machine-assertable facts that
drifted because `check-project-contract.mjs` pins only identity markers and placeholder-forbids,
not factual alignment. This repo's memory is its docs and agents act on them; converting today's
corrections into gate assertions makes the next drift cost a failing check instead of a handoff
surprise.

Deliberate scope limit: FOUR invariants only. The repo's own doc-contract comment says "Keep
markers durable" — over-pinning prose makes every legitimate edit fight the gate.

## Current state

### The checker — `scripts/check-project-contract.mjs`

Structure:

```js
const DOC_CONTRACTS = {
  "docs/PRODUCT.md": { require: [...], forbid: [/^- Primary users:\s*$/m, ...] },
  "docs/ARCHITECTURE.md": { require: ["Astro", ...], forbid: [...] },
  ...
  "README.md": { require: ["Noveno"], forbid: [/Pi Production Workflow Template/] },
};

function checkDocContract(root, relative, contract) { ... }   // require = substring present, forbid = regex absent
export function checkProjectContract(root) { ... }            // runs all checks; exitCode 1 on failure
```

Consumed by `bash scripts/project-verify.sh` (in verify.sh's single lane) and by
`tests/project-contract.test.mjs`, which imports `checkProjectContract` and asserts results as
data.

### Facts to pin (all true AFTER plan 010; verified at planning time against code)

1. **Structural summary**: `tests/structural.test.mjs:140–147` asserts homepage has NO hero-image
   preload and NO eager images ("LCP is the headline text"). README must not claim an
   "AVIF preload + eager hero" contract.
   - Invariant: README forbids `/AVIF preload \+ eager hero/`.
2. **Route history**: shipped routing is `/blog`; `/insights` exists only inside annotated lines.
   - Invariant: Master Spec forbids `/(?<!\[renamed[^\n]*)\/insights(?!\s*— renamed)/` … simpler
     and robust: after 010 every `/insights` occurrence sits on a line also containing `2026-10`
     or `DESIGN §16`. Encode exactly that line-level rule:
     for each line containing `/insights`, require `/(renamed|DESIGN §16|301)/`.
3. **Directory map**: README's map must mention the modules that exist:
   - Require substrings in README: `"components/brand/"`, `"motion.ts"`, `"work-filter.ts"`,
     `"data/blog.ts"`. (Presence-checks only — full tree equality is too brittle.)
4. **Open decisions**: PRODUCT must not re-list settled decisions:
   - Forbid `/Hero headline selection between the two approved candidates/`;
   - Forbid `/Persian font choice[^\\n]*deferred to .?\/design/`.

### Repo conventions

- Checker messages are one-liners stating what's wrong and where.
- Tests treat the checker as a pure function returning structured findings.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Checker | `node scripts/check-project-contract.mjs` | exit 0 |
| Contract lane | `bash scripts/project-verify.sh` | exit 0 |
| Contract tests | `node --test tests/project-contract.test.mjs` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `scripts/check-project-contract.mjs` — new invariants
- `tests/project-contract.test.mjs` — cases covering each new invariant (passing + failing fixture)
- `plans/README.md` — status row

**Out of scope**:
- Any doc content edits (that was plan 010).
- Pinning CHANGELOG freshness, sitemap contents, or test-count claims (too volatile).
- New config files or a second checker script.

## Git workflow

- Branch: `improve/013-doc-truth-guards`
- Conventional commits: `test(contract): pin structural-summary, route-history, map, open-decisions facts`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the invariants

In `DOC_CONTRACTS`:

```js
"README.md": {
  require: [
    "Noveno",
    // Directory-map accuracy spot checks (full equality is too brittle):
    "components/brand/",
    "motion.ts",
    "work-filter.ts",
    "data/blog.ts",
  ],
  forbid: [
    /Pi Production Workflow Template/,
    // Pre-2026-10 brand pass contract, inverted vs tests/structural.test.mjs
    /AVIF preload \+ eager hero/,
  ],
},
```

For the Master Spec, the existing entry gets a custom check rather than plain `forbid`
(every occurrence must be ANNOTATED). Add a small dedicated function next to
`checkDocContract`:

```js
function checkSpecRouteHistory(root, relative) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  const offenders = text.split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.includes("/insights"))
    .filter(({ line }) => !/(renamed|DESIGN §16|301)/.test(line));
  return offenders.map(({ n }) => `${relative}:${n} mentions /insights without the rename annotation`);
}
```

Wire it into `checkProjectContract`'s aggregate result list with the same message shape the other
checks use.

For PRODUCT, add to its existing `forbid` list:

```js
/Hero headline selection between the two approved candidates/,
/Persian font choice[^\n]*deferred to [`/]?design/,
```

**Verify**: `node scripts/check-project-contract.mjs` → exit 0 on the post-010 tree.

### Step 2: Red-proof the invariants

In a THROWAWAY working-tree edit (never commit this step): revert ONE fact (e.g. re-add the
forbidden README sentence), run the checker → exit 1 with your message, then restore. Record the
observed failure output in the PR body. Repeat mentally for the spec-line rule using a scratch
copy of the file if editing the real spec is uncomfortable (`--root` flag exists for pointing the
checker at a temp copy — prefer that).

**Verify**: observed exit 1 → restore → exit 0.

### Step 3: Test the checker

Extend `tests/project-contract.test.mjs` following its existing pattern (it imports
`checkProjectContract` and feeds it fixture roots):

- a fixture root whose README contains the forbidden sentence → finding mentioning the pattern;
- a fixture root whose spec has an UNannotated `/insights` line → route-history finding;
- a clean fixture root → no new findings.

If the test file builds fixture roots via temp dirs, reuse that helper; keep fixtures minimal.

**Verify**: `node --test tests/project-contract.test.mjs` → all pass.

## Test plan

Step 3 is the test plan. Keep each new assertion tied to ONE documented fact so future removal is
a deliberate decision visible in git blame.

## Done criteria

ALL must hold:

- [ ] `node scripts/check-project-contract.mjs` exits 0 on the real tree
- [ ] Each of the four invariants demonstrably fails on a mutated fixture (red-proof recorded)
- [ ] `node --test tests/project-contract.test.mjs` passes with the new cases
- [ ] `bash scripts/project-verify.sh` and `bash scripts/verify.sh` exit 0
- [ ] No changes outside the two in-scope files (+ plans index); `plans/README.md` row updated

## STOP conditions

Stop and report back if:

- Plan 010 has not landed (invariants would fire on known-stale docs) — sequence, don't weaken.
- A legit current README/spec/PRODUCT phrasing trips a forbid regex (adjust the REGEX to be more
  specific; never delete the invariant to get green).
- `checkProjectContract`'s return shape can't accommodate the line-level spec rule without
  refactoring its contract (small refactor is fine; large one needs human eyes).

## Maintenance notes

- When the D‑01 cutover lands, add the natural successor invariant here (e.g. ARCHITECTURE no
  longer promising Web3Forms client posting) — this file is where such facts graduate into gates.
- Reviewers should reject any PR that weakens these forbids without replacing them with a newer
  truth.
