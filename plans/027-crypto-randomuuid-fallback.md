# Plan 027: Fallback for crypto.randomUUID when unavailable (insecure context / old WebView)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- src/scripts/audit.ts tests/audit-retry.test.mjs`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 023 (god-module split) is nice-to-have but not required; if 023 is deferred, land the fallback inline in `src/scripts/audit.ts`
- **Category**: bug
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`createDraft()` at `src/scripts/audit.ts:133` does `submission_id: crypto.randomUUID()` with no fallback. `crypto.randomUUID` is unavailable in insecure contexts (`http://`) and in old WebViews (some Iranian Android WebViews, `slice2-test-server.mjs` on `http://localhost:8788`). The journey then throws before the first interaction — no draft, no submit, silent failure. The fallback is a 10-line UUID v4 shim using `crypto.getRandomValues` (present even when `randomUUID` is not) or `Math.random` as last resort — cheap, and the server validates `UUID_PATTERN` at `functions/lib/contract.ts:28`.

## Current state

Relevant files:
- `src/scripts/audit.ts:7, 133` — `submission_id` minting
- `functions/lib/contract.ts:28` — `UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- `tests/audit-retry.test.mjs:320` — `installGlobals` installs `crypto.randomUUID` via Node's `globalThis.crypto` (inherits from host)
- `functions/lib/validate.ts:55` — `if (!UUID_PATTERN.test(submissionId)) fail("submission_id", "invalid_uuid")`

Excerpt — `src/scripts/audit.ts:7` + `:133`:

```ts
 * - submission_id: `crypto.randomUUID()` minted at journey start, stable
---
function createDraft(): Draft {
  return {
    submission_id: crypto.randomUUID(),
    step: 1,
    values: {},
    attribution: readAttribution() ?? captureAttributionNow(),
  };
}
```

Excerpt — `tests/audit-retry.test.mjs:18` (import) — test harness relies on host `crypto`:

```ts
import { initAudit } from "../src/scripts/audit.ts";
```

Repo conventions:
- Framework-free TS modules — add a tiny `randomUUID()` helper co-located with `createDraft` (or in `src/scripts/audit/draft.ts` if plan 023 has landed). See `src/scripts/audit.ts:22-46` for the `Draft` interface region.
- Tests use `node:test` + fake DOM; `installGlobals` at `tests/audit-retry.test.mjs:320` fakes `fetch`, `sessionStorage`, `window.turnstile` — follow that pattern for crypto stubbing.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass (including new fallback test) |
| Targeted | `npm test -- --test-name-pattern="draft\|randomUUID\|uuid"` | subset passes |
| Build | `npm run build` | 19 pages |

## Scope

**In scope** (only files you should modify):
- `src/scripts/audit.ts` — add fallback helper + replace `crypto.randomUUID()` call (or `src/scripts/audit/draft.ts` if 023 landed — place fallback there)
- `tests/audit-retry.test.mjs` or new `tests/audit-uuid-fallback.test.mjs` — pin that fallback produces valid UUIDs

**Out of scope** (do NOT touch):
- `functions/lib/contract.ts:28` UUID pattern (already case-insensitive)
- `functions/lib/validate.ts` — server validation unchanged
- Any new `nanoid` / `uuid` dependency (stdlib only)

## Git workflow

- Branch: `advisor/027-crypto-randomuuid-fallback`
- Commit per step; conventional commits
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Add a small randomUUID fallback helper

In `src/scripts/audit.ts` (or `src/scripts/audit/draft.ts` if 023 exists), add **above** `createDraft`:

```ts
/**
 * Fallback UUID v4: prefer crypto.randomUUID, then crypto.getRandomValues, then Math.random.
 * Output matches functions/lib/contract.ts UUID_PATTERN (lowercase hex).
 * The server lowers submission_id (.toLowerCase()) at validate time anyway, but we emit lowercase.
 */
function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  // Last resort — not crypto-strong but better than throwing (journey still completes)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

Replace `crypto.randomUUID()` at `createDraft:133` with `randomId()`.

Keep the function pure, <20 lines, no new imports.

**Verify**: `npm run check` → exit 0

### Step 2: Tests — pin fallback still produces valid UUIDs and the journey survives

Add a test (extend `tests/audit-retry.test.mjs` or create `tests/audit-uuid-fallback.test.mjs` — follow the existing harness at `audit-retry.test.mjs:18-120` FakeEl / buildAuditDom pattern):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { initAudit } from "../src/scripts/audit.ts";

// Temporarily stub crypto to lack randomUUID, drive initAudit → createDraft, assert submission_id valid
test("createDraft falls back when crypto.randomUUID is unavailable", async () => {
  const saved = globalThis.crypto;
  // keep getRandomValues, drop randomUUID
  globalThis.crypto = { getRandomValues: saved.getRandomValues.bind(saved) } as any;
  // ... installGlobals + buildAuditDom + walkToContactStep + check env.auditCalls[0].submission_id matches UUID_PATTERN
  // restore
  globalThis.crypto = saved;
});
```

Simpler standalone test without the full harness (also acceptable):

```ts
test("randomId fallback matches UUID_PATTERN", () => {
  // directly import the helper if exported, or trigger via buildWeb3FormsBody/submission_id
});
```

If you didn't export `randomId` (it's internal), test via the observable: stub `crypto.randomUUID` to `undefined`, call `initAudit`, walk to submit, assert `env.auditCalls[0].submission_id` matches `UUID_PATTERN` from `functions/lib/contract.ts:28`.

**Verify**: `npm test` → all pass, new fallback test passes even with `randomUUID` stubbed away

### Step 3: Build and verify no behavior change when crypto.randomUUID exists

**Verify**: `npm run build` → 19 pages; `npm test` without stubbing still passes (fallback not exercised but present)

## Test plan

- `randomId fallback matches UUID_PATTERN` — stub `crypto.randomUUID` away, drive a submit, assert `submission_id` matches `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- `createDraft falls back when crypto.randomUUID unavailable` — same but via full journey harness (or combine)
- `Math.random last-resort still valid` — stub both `randomUUID` and `getRandomValues` away, assert still UUID-shaped
- Regression: `npm test` all green; existing `audit-retry.test.mjs` draft-restore test still passes

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new test `falls back when crypto.randomUUID is unavailable` exists and passes
- [ ] `grep -n "randomId\|randomUUID" src/scripts/audit.ts` returns hits (helper exists and is used in `createDraft`)
- [ ] `grep -n "Math.random" src/scripts/audit.ts` appears only inside the fallback (not in hot path when crypto available)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- The fallback still throws because `crypto` itself is `undefined` in the test harness (polyfill `globalThis.crypto` before importing `initAudit` — `tests/audit-retry.test.mjs:18` imports at top level before stubbing; you may need to lazy-import after stubbing)
- `UUID_PATTERN` at `functions/lib/contract.ts:28` is case-sensitive (it's `/i` — so lowercase/uppercase both pass; if changed, fix pattern, not this plan)
- Adding the helper blows the per-module LOC budget from plan 023 — still fine; this is S effort

## Maintenance notes

- Reviewer should check that the fallback is `getRandomValues`-first (strong) and `Math.random` only as last resort — the comment should say so.
- If `src/scripts/audit.ts` has been split by plan 023, the helper belongs in `src/scripts/audit/draft.ts` next to `createDraft`, not in the controller.
- Future: if Astro ever polyfills `crypto.randomUUID` via `unenv`, the helper becomes dead code but harmless — keep it.
