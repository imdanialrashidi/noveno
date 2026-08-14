# Plan 001: Cover the untested client submit paths (error banners, Web3Forms notification, safeText)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- src/scripts/audit.ts tests/audit-retry.test.mjs`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The primary conversion surface's user-visible error states are unproven. On
`/audit`, `submit()` maps `403 → turnstile banner`, `429 → rate banner`,
`400 → validation banner`, and offline/network to their banners
(`src/scripts/audit.ts:590-659`), but no test returns those statuses from
the scripted fetch — only the fetch-throw (network) path and the Turnstile
script-failure path are exercised (`tests/audit-retry.test.mjs`). The
Web3Forms founder-email notification (`notifyWeb3Forms`, `audit.ts:677-727`)
is **statically dead in tests**: every test passes `web3formsKey: ""`, which
early-returns at line 678 — so the email path (including the `safeText`
HTML-injection sanitizer at `audit.ts:855-857`) can silently regress with no
red test. This plan adds defect-sensitive tests only; no production code
changes.

## Current state

- `src/scripts/audit.ts` (857 lines) — client journey state machine. The
  branches to cover:
  - `submit()` (lines ~590-659): 403 → `bridge?.invalidate(); showBanner("turnstile")`;
    429 → `showBanner("rate")`; 400 → `showBanner("validation")`; fetch throw →
    `showBanner(navigator.onLine === false ? "offline" : "network")`; missing
    `config.turnstileSiteKey` → `showBanner("unconfigured")` at line ~578.
  - `onSuccess()` (lines ~663-675): `track("audit_submitted")`; `clearDraft()`;
    `sessionStorage.setItem(DONE_KEY, ...)`; `await notifyWeb3Forms(payload)`;
    `window.location.assign("/audit/thank-you")`.
  - `notifyWeb3Forms()` (lines ~677-727): early return when
    `!config.web3formsKey`; builds a body with `labelOf`/`safeText` for each
    field; two attempts (`AbortSignal.timeout(2500)`), `keepalive: true`;
    returns after one `result.ok` or after both attempts.
  - `safeText(value)` (line ~855): `return value.replace(/[<>]/g, "")`.
- `tests/audit-retry.test.mjs` (550 lines) — the reusable harness that drives
  the REAL `initAudit` through a fake DOM:
  - `installGlobals({ turnstile, fetchImpl, onLine = true })` (line ~295)
    installs `globalThis.location = { search: "", pathname: "/audit", assign }`,
    a sessionStorage Map, `navigator` with `{ onLine, sendBeacon: () => true }`,
    and a scripted `fetch` that records `/api/audit` POSTs into `auditCalls`
    and returns `{ ok: true, status: 200, json: async () => ({}) }` for
    everything else.
  - `buildAuditDom()` builds the page shell: banner blocks for
    `["network", "offline", "turnstile", "rate", "validation", "unconfigured"]`
    with `data-retry` buttons on network/offline/turnstile only (matching
    `src/pages/audit.astro`), a six-step form with `${fieldId}-error` slots
    for every field, `#audit-next`, `#audit-back`, `#turnstile-container`.
  - `okResponse()` helper; `tick()` awaits one macrotask; `walkToContactStep(dom)`
    fills all six steps; `bannerState(dom)` inspects banner hidden flags.
  - Tests currently pass `initAudit({ turnstileSiteKey: "test-site-key",
    web3formsKey: "", web3formsUrl: "" })` (lines 436, 505).

## Repo conventions to match

- Tests: `node:test` + `assert/strict`, files under `tests/*.test.mjs`; they
  import TypeScript modules directly (`import { initAudit } from "../src/scripts/audit.ts"`)
  — Node 22.19's type stripping makes this work. Match the existing harness
  style exactly: `FakeEl`, `parseSelector`, `matches`, `tick()`.
- No lint/formatter config exists; keep 2-space indent, single quotes,
  semicolons, trailing commas (the file's existing style).
- Persian UI copy lives only in production files (`src/scripts/audit.ts`,
  `src/pages/audit.astro`) — test assertions use the banner *kinds*
  (`"network"`, `"offline"`, `"turnstile"`, `"rate"`, `"validation"`,
  `"unconfigured"`), not Persian strings, except where the Web3Forms body
  labels are asserted (those ARE the Persian labels from `src/data/audit.ts`).
- Test naming style: descriptive `test("...", async () => {...})` blocks with
  comments explaining which production contract each pin.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-retry.test.mjs` | all tests pass |
| Typecheck | `npm run check` | exit 0, 0 errors |
| Full app tests | `npm run test` | all pass (120/120 before this change) |
| Build | `npm run build` | exit 0 |
| Affected route | `node scripts/verify-affected.mjs --file tests/audit-retry.test.mjs` | routes to the app lane |

## Scope

**In scope** (the only files you should modify):
- `tests/audit-retry.test.mjs`

**Out of scope** (do NOT touch, even though they look related):
- `src/scripts/audit.ts` — production behavior changes belong to plans 003/005
  (which DEPEND on this plan's coverage landing first).
- `src/pages/audit.astro`, `functions/**`, other test files.

## Git workflow

- Branch: `improve/001-client-submit-coverage`
- Commit per logical test group; message style matches the repo's
  conventional commits, e.g. `test(audit): cover client submit error banners,
  Web3Forms notification and safeText` (see `git log` for examples like
  `fix(audit): repair retry TypeError and light-theme faint contrast`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the harness to capture Web3Forms calls and expose more knobs

In `tests/audit-retry.test.mjs`:

1. In `installGlobals`, change the signature to accept
   `{ turnstile, fetchImpl, onLine = true, web3formsUrl }` and return an
   additional `web3formsCalls: []` array in the returned env object. Inside
   the scripted `fetch`, before the final `return { ok: true, ... }` fallback,
   add a branch that records POSTs to the configured web3forms URL:

   ```js
   if (web3formsUrl && parsed === web3formsUrl) {
     env.web3formsCalls.push(JSON.parse(String(opts.body)));
     return fetchImpl.shift()();
   }
   ```

   (Note: `fetchImpl` is shared by `/api/audit` and web3forms calls — order
   the scripted responses in the order the requests happen.)

2. Change the `navigator` stub to capture beacons:

   ```js
   const beacons = [];
   Object.defineProperty(globalThis, "navigator", {
     value: { onLine, sendBeacon: (url, data) => { beacons.push({ url, data }); return true; } },
     configurable: true,
     writable: true,
   });
   ```

   and include `beacons` in the returned env object. This is needed only by
   plan 013 later, but capturing it now keeps the harness stable. If you
   prefer to leave beacons untouched in this plan, skip this sub-step — it is
   not load-bearing for this plan's assertions.

3. Keep `web3formsUrl` optional in `installGlobals` so existing callers
   (which pass no such argument) are unchanged.

**Verify**: `node --test tests/audit-retry.test.mjs` → all existing tests still pass (2 tests).

### Step 2: Add per-status error-banner tests

Add these tests to `tests/audit-retry.test.mjs` (after the existing retry
tests; model the journey setup on the existing first test — `installGlobals`,
`buildAuditDom`, `captureScripts`, `initAudit`, `walkToContactStep`):

1. **403 (turnstile rejection)**: `fetchImpl = [() => ({ ok: false, status: 403, json: async () => ({ error: { code: "turnstile_failed" } }) })]`; submit; assert `bannerState(dom).turnstileHidden === false`, the button is re-enabled, and a SECOND submit issues a new `/api/audit` request whose token differs from the first (proving `bridge.invalidate()` took effect — with the mock widget, the second `getToken()` resets the widget; assert `turnstile.resets === 2` and `env.auditCalls[1].cf_turnstile_token !== env.auditCalls[0].cf_turnstile_token` after emitting a fresh token).
2. **429**: `fetchImpl = [() => ({ ok: false, status: 429, json: async () => ({ error: { code: "rate_limited" } }) })]`; assert the `rate` block is visible, banner visible, button re-enabled.
3. **400 validation**: `fetchImpl = [() => ({ ok: false, status: 400, json: async () => ({ error: { code: "validation", fields: { name: "too_long" } } }) })]`; assert the `validation` block is visible, button re-enabled. (Per-field rendering of `fields` is plan 003's production change — do not assert it here.)
4. **Offline**: `installGlobals({ turnstile, fetchImpl: [() => { throw new TypeError("Failed to fetch"); }], onLine: false })`; assert the `offline` block is visible.
5. **Unconfigured**: `initAudit({ turnstileSiteKey: "", web3formsKey: "", web3formsUrl: "" })`; walk to the contact step, submit; assert the `unconfigured` block is visible and `env.auditCalls.length === 0` (no request may be sent without a configured key).

**Verify**: `node --test tests/audit-retry.test.mjs` → all tests pass, including the 5 new ones.

### Step 3: Add Web3Forms notification + safeText tests

Add these tests:

1. **Successful notification**: `installGlobals({ turnstile, fetchImpl: [okResponse, () => ({ ok: true, status: 200, json: async () => ({}) })] , web3formsUrl: "https://web3forms.test/submit" })`; `initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "test-key", web3formsUrl: "https://web3forms.test/submit" })`; walk the journey with a business name containing markup — e.g. `setField(dom, "business_name", "کافه <b>نو</b>")` — and submit successfully. Assert:
   - `env.web3formsCalls.length === 1`;
   - `env.web3formsCalls[0].access_key === "test-key"`;
   - `env.web3formsCalls[0].industry === "رستوران و کافه"` (label mapping via `labelOf` — the Persian label from `src/data/audit.ts`);
   - `env.web3formsCalls[0].business_name === "کافه نو"` (the `<b>` tags stripped by `safeText`);
   - navigation happened (`env.nav[0] === "/audit/thank-you"`).
2. **Notification failure still reaches thank-you (A4-iii)**: `fetchImpl = [okResponse, () => ({ ok: false, status: 500, json: async () => ({}) }), () => ({ ok: false, status: 500, json: async () => ({}) })]` — first entry serves `/api/audit`, the next two are the two web3forms attempts; assert `env.web3formsCalls.length === 2` (exactly one automatic retry) and `env.nav[0] === "/audit/thank-you"`.

**Verify**: `node --test tests/audit-retry.test.mjs` → all tests pass (2 new).

## Test plan

New tests (7 total in this plan):
- 5 banner-kind tests (403 / 429 / 400 / offline / unconfigured) — the exact
  branches listed in "Why this matters";
- 2 Web3Forms tests — happy path with label + sanitizer assertions, and
  fail-twice-then-continue (pins `A4-iii`: email failure never blocks the
  visitor's success experience).

Structural pattern to follow: the existing first retry test
(`tests/audit-retry.test.mjs`, "retry after a recoverable network failure…")
— same setup sequence, same assertion style.

**Defect sensitivity**: before this plan's tests, every one of the new
banner tests fails (the branches are unreachable from the old harness) and
the Web3Forms tests fail because `notifyWeb3Forms` early-returns with an
empty key. There is no production change here, so "red before green" is
demonstrated simply by running the new tests against the untouched
`src/scripts/audit.ts` — they should already pass once the harness drives
the right inputs, because the production code already implements the
behavior. If a new test fails against the current production code, STOP and
report: that is a real production bug this plan did not anticipate (likely a
new plan or a bug-report, not an in-scope fix).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-retry.test.mjs` exits 0 with the 2 original tests + 7 new tests
- [ ] `npm run check` exits 0
- [ ] `npm run test` exits 0 (all suites pass)
- [ ] `npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A new test fails against the current production code (see "Defect
  sensitivity" — that means a live production bug exists and needs its own plan).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- Plans 003 and 005 depend on this coverage: run this suite before and after
  those changes.
- The `safeText` sanitizer is asserted behaviorally (via the captured
  Web3Forms body) — if a future change moves the notification server-side or
  to a different provider (forbidden without approval per `docs/ops/runbook.md`),
  these tests must move with it.
- `labelOf` is asserted via the `industry` label — new options added to
  `src/data/audit.ts` enums will be exercised here automatically; keep the
  walkToContactStep fixture in sync when the form's field set changes.
