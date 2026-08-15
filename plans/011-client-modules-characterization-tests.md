# Plan 011: Characterization tests for the client modules (analytics, theme, menu, motion) + Web3Forms/offline/draft-restore paths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- src/scripts/ tests/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002-audit-replay-dedupe.md (already applied — `tests/audit-retry.test.mjs` may have been extended)
- **Category**: tests
- **Planned at**: commit `13ef792`

## Why this matters

Four client modules carry real behavior with zero automated coverage:
`src/scripts/analytics.ts` (attribution capture — first-page-wins UTM/
referrer — the core promise of the funnel, plus the event queue and PII-free
delivery), `theme.ts` (a11y `aria-pressed`, localStorage persistence,
system-change listener), `menu.ts` (Escape close, focus return), and
`motion.ts` (parallax, IntersectionObserver reveal, reduced-motion guards).
Separately, half of the audit client's surface is untested: the Web3Forms
notification path (PII POST to a third party), the offline/unconfigured/
rate banner branches, and boot-time draft restore. The repo already proved a
cheap fake-DOM harness works (`tests/audit-retry.test.mjs`). This plan adds
the missing suites so these behaviors get a regression net.

## Current state

- `tests/audit-retry.test.mjs` — the established fake-DOM harness driving
  the REAL `src/scripts/audit.ts`; `installGlobals({ onLine })` sets up
  globals; `initAudit({ turnstileSiteKey, web3formsKey, web3formsUrl })`
  starts the form; scriptable fetch records requests. Read it fully before
  writing anything.
- `tests/audit-retry.test.mjs:448,529,583` — every `initAudit` call passes
  `web3formsKey: ""` and `web3formsUrl: ""` (the Web3Forms path is never
  exercised).
- `src/scripts/analytics.ts` exports: `captureAttribution()`,
  `readAttribution()`, `track(name, payload)`, `initAnalytics()`. Behavior:
  sessionStorage key `noveno:attribution` (first page wins); `track()` queues
  and flushes via `navigator.sendBeacon(EVENT_URL, body)` after 800ms or on
  pagehide/visibilitychange; falls back to `fetch(..., {keepalive:true})`
  when sendBeacon is missing.
- `src/scripts/theme.ts` exports: `readStoredTheme()`, `systemTheme()`,
  `effectiveTheme()`, `applyTheme(theme)`, `clearOverride()`,
  `initThemeToggle(button)` (returns unsubscribe; syncs `aria-pressed`,
  `data-theme-label` aria-label, icon visibility; persists override in
  `localStorage` under `noveno-theme`; follows system changes while no
  override).
- `src/scripts/menu.ts` exports: `initMobileMenu(...)` (Escape closes +
  returns focus; transitionend + timeout fallback).
- `src/scripts/motion.ts` exports: `initHeroParallax`, `initHeroStages`,
  `initReveal`, `initStagger` — all take `root = document`; use
  IntersectionObserver and honor `prefers-reduced-motion`.
- `src/scripts/audit.ts` — `notifyWeb3Forms(payload)` (posts to
  `config.web3formsUrl`, two attempts, `safeText` sanitization); banner
  codes `unconfigured` / `offline` / `network` / `turnstile` / `rate` /
  `validation`; draft key `noveno:audit:draft` restored at boot
  (`readDraft` → `applyDraftToDom` → render at saved step).

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| New suites | `node --test tests/client-modules.test.mjs` | all pass |
| Retry suite | `node --test tests/audit-retry.test.mjs` | all pass (extended) |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

## Scope

**In scope**:
- `tests/client-modules.test.mjs` (create)
- `tests/audit-retry.test.mjs`

**Out of scope** (do NOT touch):
- `src/scripts/*.ts` — tests only. If a test reveals a genuine bug, STOP
  and report the bug instead of fixing it here.
- `tests/audit-function.test.mjs` (server-side suite)
- Any other file.

## Git workflow

- Commit once at the end:
  `test: characterize client modules + Web3Forms/offline/draft-restore paths`
- Do NOT push or open a PR.

## Steps

### Step 1: New suite — analytics module

Create `tests/client-modules.test.mjs`. Build a minimal global stub harness
(do NOT import from audit-retry; keep this file self-contained):

- `globalThis.sessionStorage` — a Map-backed stub with `getItem`/`setItem`/`removeItem`.
- `globalThis.location` — `{ pathname, search, href }` mutable.
- `globalThis.document` — `{ referrer, documentElement: { getAttribute/setAttribute/removeAttribute }, addEventListener, visibilityState }`.
- `globalThis.window` — `{ matchMedia: () => ({ matches, addEventListener, removeEventListener }), setTimeout/clearTimeout (real), addEventListener }`.
- `globalThis.navigator` — `{ sendBeacon: spy, onLine: true }`.

Reset all stubs between tests (`beforeEach`-style via `t.beforeEach` or
manual setup in each test — node:test supports `beforeEach` on the test
context; follow what audit-retry does).

Import the real modules: `import { captureAttribution, readAttribution, track, initAnalytics } from "../src/scripts/analytics.ts";` (check how audit-retry imports the TS module and mirror it).

Tests:

1. **First page wins**: set `location.search = "?utm_source=ig&utm_medium=post"`, call `captureAttribution()`, then change `location.search` and call again → `readAttribution()` still has the FIRST values.
2. **UTM + landing page captured**: assert `landing_page === pathname + search`, `utm_source === "ig"`, `referrer === document.referrer`, `first_seen_at` is an ISO string.
3. **Corrupt storage**: pre-seed `noveno:attribution` with `"not json"` → `readAttribution()` returns null.
4. **Queue + sendBeacon flush**: `track("audit_started", { section: "hero" })` → `navigator.sendBeacon` called (after timer — use `await new Promise(r => setTimeout(r, 900))` or call the flush via pagehide: dispatch `pagehide` on window stub → assert the beacon body parses to `{ name: "audit_started", payload: { section: "hero", page: location.pathname } }`.
5. **fetch fallback**: `navigator.sendBeacon = undefined` → `track(...)` + pagehide flush → `globalThis.fetch` called with `keepalive: true` (stub fetch).
6. **Click wiring**: `initAnalytics()`; dispatch a click on a stub element with `data-event="phone_click"` (the harness needs a minimal `closest` implementation like audit-retry's FakeEl — reuse that pattern) → beacon fired with the event name.
7. **PII-free payload contract**: assert `track` payloads never contain keys `name|phone|email` (structural: assert the sent beacon body keys ⊆ `EVENT_PAYLOAD_KEYS` + `name`).

**Verify**: `node --test tests/client-modules.test.mjs` → all pass.

### Step 2: New suite — theme module

In the same file (or a second describe block):

1. `initThemeToggle(button)` with a stub button (needs `getAttribute`, `setAttribute`, `querySelector`, `addEventListener`) → initial `aria-pressed` reflects `data-theme` on documentElement; click → toggles `data-theme` + persists `noveno-theme` in localStorage + `aria-pressed` flips.
2. **System-change listener**: stub `matchMedia` returning `{ matches: false, addEventListener: (_, fn) => captured = fn, removeEventListener }`; set `data-theme="dark"` manually then fire the captured change with `matches: true` → since no stored override, `data-theme` becomes "dark"; with a stored override → system change does NOT override.
3. **Unsubscribe**: call the returned function → click no longer toggles.

**Verify**: `node --test tests/client-modules.test.mjs` → all pass.

### Step 3: New suite — menu + motion modules

Read `src/scripts/menu.ts` and `src/scripts/motion.ts` first; write
behavior-pinning tests for the observable contracts:

- **menu**: `initMobileMenu(...)` — opening sets state; Escape keypress closes and restores focus to the trigger; the timeout fallback path fires when `transitionend` never arrives (use a fake timer or dispatch the timeout by awaiting; if the module uses `setTimeout`, stub timers or wait real ms — prefer small real waits, matching audit-retry's approach).
- **motion**: `initReveal(root)` — with `matchMedia("(prefers-reduced-motion: reduce)").matches === true` → NO IntersectionObserver created (stub the global IntersectionObserver constructor with a spy); with `matches === false` → observer created and observes `[data-reveal]` elements (stub `querySelectorAll`).

Adapt to the actual signatures/selectors you find in the modules — the tests pin behavior, not implementation.

**Verify**: `node --test tests/client-modules.test.mjs` → all pass.

### Step 4: Extend audit-retry with the three missing journeys

In `tests/audit-retry.test.mjs`:

1. **Web3Forms configured**: a test that calls `initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "test-key", web3formsUrl: "https://api.web3forms.com/test" })`, completes the form (reuse the existing form-filling helpers — read how existing tests drive steps), mock fetch so `/api/audit` returns `{ ok: true, id, status: "inserted" }` → assert exactly ONE POST to the web3forms URL, with a body containing `access_key: "test-key"`, `submission_id`, `name`, and sanitized fields; assert the thank-you navigation still happens even if the web3forms POST rejects (mock it to reject → still navigates).
2. **Offline banner**: `installGlobals({ onLine: false })` (check the harness's signature; adapt if it takes different options) → submit → banner shows the offline state (assert via the harness's banner query, e.g. `[data-banner]` text or a class); then `navigator.onLine = true` + dispatch the `online` event (the module listens for it — check `src/scripts/audit.ts:842-846`) → banner clears.
3. **Draft restore**: pre-seed `sessionStorage["noveno:audit:draft"]` with a JSON draft (`{ submission_id, step: 3, values: {...} }` matching the `Draft` interface shape in `src/scripts/audit.ts:40-46`) → `initAudit(...)` → assert the form renders at step 3 with the saved values applied (use the harness's DOM assertions).

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass with the new tests.

## Test plan

- New `tests/client-modules.test.mjs` (Steps 1-3); extended
  `tests/audit-retry.test.mjs` (Step 4).
- Pattern: audit-retry's fake-DOM + scriptable-fetch harness.

## Done criteria

- [ ] `tests/client-modules.test.mjs` exists with ≥ 12 tests covering analytics (7), theme (3), menu + motion (≥2)
- [ ] `tests/audit-retry.test.mjs` has the Web3Forms, offline-banner, and draft-restore tests
- [ ] `node --test tests/client-modules.test.mjs && node --test tests/audit-retry.test.mjs` → all pass
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified
- [ ] No `src/scripts/*.ts` changes (if you found a bug, it is in your report, not the diff)

## STOP conditions

Stop and report back (do not improvise) if:

- A test exposes an actual bug in `src/scripts/*.ts` (report the bug with
  evidence; do not fix it in this plan).
- The audit-retry harness's `installGlobals`/`initAudit` signatures differ
  materially from the excerpts — read the file first and adapt the plan's
  test descriptions to the real harness, noting the adaptation.
- Timer-based tests prove flaky on this machine (real timers) — use the
  pagehide/visibilitychange flush paths instead of waiting, and note it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- These suites are characterization tests: they pin current behavior. When a
  module's behavior intentionally changes, update the corresponding test
  deliberately.
- The PII-free payload contract test (Step 1.7) is the machine guard for the
  "no PII in analytics" invariant — keep it aligned with
  `EVENT_PAYLOAD_KEYS` in `functions/lib/contract.ts` if that list grows.
- Reviewer should scrutinize: tests assert real observable effects
  (beacon bodies, aria-pressed, focus return), not internal calls only.
