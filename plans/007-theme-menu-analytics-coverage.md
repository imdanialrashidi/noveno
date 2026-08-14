# Plan 007: Add coverage for theme toggle, mobile menu, and analytics delivery

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- src/scripts/theme.ts src/scripts/menu.ts src/scripts/analytics.ts tests/`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

Three client modules have zero test coverage (verified: no test file imports
them):

1. `src/scripts/theme.ts` — `initThemeToggle` manages `aria-pressed`, icon
   swap, the persisted override, and OS-change following. This is the
   accessibility-critical theme control wired on every page
   (`Header.astro:84-96`).
2. `src/scripts/menu.ts` — `initMobileMenu` manages `aria-expanded`, Escape
   close, and focus return. Same a11y-critical class.
3. `src/scripts/analytics.ts` — attribution capture (first-page UTM/referrer
   → sessionStorage), the event queue + delivery (sendBeacon with
   fetch-keepalive fallback, pagehide flush), and the declarative
   `data-event` click handler. The whole site is instrumented with
   `data-event` attributes (10+ components) and attribution-with-lead is a
   launch deliverable (`docs/ops/setup-checklist.md`), yet the producer side
   of the telemetry layer is unproven — one regression away from silent
   event loss with no red test.

This plan adds test files only; no production changes.

## Current state

- `src/scripts/theme.ts` (96 lines): exports `THEME_STORAGE_KEY`,
  `readStoredTheme()`, `systemTheme()`, `effectiveTheme()`, `applyTheme()`,
  `clearOverride()`, `initThemeToggle(button)` (returns an unsubscribe
  function; uses `window.matchMedia("(prefers-color-scheme: dark)")`,
  `localStorage`, `document.documentElement` `data-theme` attribute, button
  `aria-pressed` / `aria-label` / icon elements).
- `src/scripts/menu.ts` (42 lines): exports `initMobileMenu(trigger, panel,
  close)` (returns an unsubscribe function; Escape keydown listener on
  `document`; focus management).
- `src/scripts/analytics.ts` (162 lines): exports `EventName` type,
  `Attribution` interface, `captureAttribution()`, `readAttribution()`,
  `track()`, `initAnalytics()`. Internal: `ATTRIBUTION_KEY =
  "noveno:attribution"`, `EVENT_URL = "/api/events"`, `UTM_KEYS` constant,
  `pending` queue, `send()` (sendBeacon → fetch keepalive fallback),
  `flush()` (on idle 800 ms timer, `pagehide`, and `visibilitychange →
  hidden`), `onDocumentClick()` (closest `[data-event]`).
- The harness pattern to follow: `tests/audit-retry.test.mjs` —
  `installGlobals`-style environment stubs (`globalThis.window =
  globalThis`, sessionStorage Map, navigator stub), `FakeEl`-lite DOM
  elements with `setAttribute`/`getAttribute`/`addEventListener`/
  `dispatchEvent`. Theme/menu/analytics need much less than that full
  harness — small per-file stubs are appropriate (do NOT extract a shared
  helper module; keep each test file self-contained like the existing
  suite).

## Repo conventions to match

- Tests: `node:test` + `assert/strict`, `.mjs` files under `tests/`,
  direct `import ... from "../src/scripts/theme.ts"` (Node 22.19 type
  stripping).
- No lint/formatter; 2-space indent, single quotes, semicolons.
- Persian strings asserted only where they are the behavior (e.g. the
  `aria-label` theme toggle copy is Persian in `theme.ts` — assert the exact
  strings from the module, or assert on the `aria-pressed` attribute and
  icon visibility instead; prefer the latter to avoid copy-churn coupling).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| New tests | `node --test tests/theme-menu.test.mjs tests/analytics.test.mjs` | all pass |
| Full suite | `npm run test` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `tests/theme-menu.test.mjs` (create)
- `tests/analytics.test.mjs` (create)

**Out of scope** (do NOT touch):
- `src/scripts/*.ts` production files — if a test uncovers a production bug,
  STOP and report it (it needs its own plan), do not fix in this plan.
- `tests/audit-retry.test.mjs` — plan 001 owns that file; do not refactor
  its helpers (copy the small patterns you need).

## Git workflow

- Branch: `improve/007-theme-menu-analytics-coverage`
- Commit message style (match the repo): `test(client): cover theme toggle, mobile menu, and analytics delivery`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `tests/theme-menu.test.mjs`

Build a minimal stub environment:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { initThemeToggle, readStoredTheme, effectiveTheme, applyTheme, clearOverride } from "../src/scripts/theme.ts";
import { initMobileMenu } from "../src/scripts/menu.ts";
```

Element stub (enough for theme/menu — attributes, listeners, `querySelector`,
`style`, `focus`):

```js
class El {
  constructor(attrs = {}) { this._attrs = new Map(Object.entries(attrs)); this._handlers = {}; this.style = {}; this.children = []; }
  setAttribute(k, v) { this._attrs.set(k, String(v)); }
  getAttribute(k) { return this._attrs.has(k) ? this._attrs.get(k) : null; }
  hasAttribute(k) { return this._attrs.has(k); }
  removeAttribute(k) { this._attrs.delete(k); }
  addEventListener(t, fn) { (this._handlers[t] ??= []).push(fn); }
  dispatchEvent(t, ev = {}) { for (const fn of this._handlers[t] ?? []) fn(ev); }
  querySelector() { return null; }
  focus() { this.focused = true; }
  append(c) { this.children.push(c); }
}
```

Environment install helper:

```js
function installThemeEnv({ stored, systemDark = false, docAttr = null } = {}) {
  const storage = new Map(stored ? [[themeKey, stored]] : []);
  const systemListeners = [];
  const doc = { documentElement: { _attrs: new Map(docAttr ? [["data-theme", docAttr]] : []),
    setAttribute(k, v) { this._attrs.set(k, String(v)); },
    getAttribute(k) { return this._attrs.has(k) ? this._attrs.get(k) : null; },
    removeAttribute(k) { this._attrs.delete(k); } } };
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
  globalThis.document = doc;
  globalThis.matchMedia = () => ({ matches: systemDark, addEventListener: (_t, fn) => systemListeners.push(fn) });
  return { storage, systemListeners, doc };
}
```

Tests:

1. `readStoredTheme` / `effectiveTheme` / `applyTheme` / `clearOverride`
   unit cases: stored "dark" → `readStoredTheme() === "dark"`; no stored +
   system dark → `effectiveTheme() === "dark"`; `applyTheme("dark")` sets the
   document attribute; `clearOverride()` removes the attribute and the
   storage key.
2. `initThemeToggle` click: install env (system light, no override); button
   = new El(); `initThemeToggle(button)`; dispatch `click`; assert
   `doc.documentElement.getAttribute("data-theme") === "dark"`,
   `localStorage` has the override, `button.getAttribute("aria-pressed") ===
   "true"`.
3. OS change while no override: dispatch a system change with
   `matches: true` (the recorded `systemListeners` entry) → attribute becomes
   "dark"; with a stored override present, the same dispatch leaves the
   attribute unchanged.
4. Unsubscribe: call the returned function, dispatch click → attribute
   unchanged.
5. `initMobileMenu`: trigger + panel `El`s; `initMobileMenu(trigger, panel,
   () => {})`; click trigger → `aria-expanded="true"`, `panel.hidden ===
   false`, first focusable focused (panel children: append a child `El`
   with tagName "A" — the module queries `panel.querySelector<HTMLElement>
   ("a, button")`; your `El.querySelector` must return the first child for
   that selector, or add a simple selector match); dispatch `keydown
   { key: "Escape" }` on `document` (install a `document.addEventListener`
   recorder — theme/menu tests need a `document` stub with
   `addEventListener`; use `globalThis.document.addEventListener` recorder)
   → `aria-expanded="false"`, trigger focused. Unsubscribe → Escape does
   nothing.

**Verify**: `node --test tests/theme-menu.test.mjs` → all pass.

### Step 2: `tests/analytics.test.mjs`

Environment install helper:

```js
function installAnalyticsEnv({ sendBeacon = true, search = "", pathname = "/audit", stored = null } = {}) {
  const session = new Map(stored ? [[ATTRIBUTION_KEY, JSON.stringify(stored)]] : []);
  const beacons = [];
  const windowListeners = {};
  const docListeners = {};
  globalThis.window = globalThis;
  globalThis.location = { search, pathname };
  globalThis.sessionStorage = { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => session.set(k, String(v)), removeItem: (k) => session.delete(k) };
  globalThis.navigator = sendBeacon
    ? { sendBeacon: (url, data) => { beacons.push({ url, data }); return true; } }
    : {};
  globalThis.fetch = async (url, opts = {}) => { fetchCalls.push({ url, opts }); return { ok: true }; };
  globalThis.document = { addEventListener: (t, fn) => { (docListeners[t] ??= []).push(fn); } };
  window.addEventListener = (t, fn) => { (windowListeners[t] ??= []).push(fn); };
  return { session, beacons, fetchCalls, windowListeners, docListeners };
}
```

(Import the module-level constants `ATTRIBUTION_KEY` and `EVENT_URL` from
`../src/scripts/analytics.ts` — export them if they are not exported; that
is the only production change allowed: `export const ATTRIBUTION_KEY = ...`
and `export const EVENT_URL = ...`. If you prefer not to export, hardcode the
literal strings in the test with a comment.)

Tests:

1. **Attribution capture**: `installAnalyticsEnv({ search: "?utm_source=instagram&utm_campaign=summer", pathname: "/" })`;
   `captureAttribution()`; assert the session record's `utm_source ===
   "instagram"`, `utm_campaign === "summer"`, `landing_page === "/?utm_source=..."`,
   `referrer === document.referrer` (stub `document.referrer` — add
   `referrer: ""` to the document stub; the module reads `document.referrer`).
   Call again → first-page-wins (record unchanged).
2. **readAttribution round-trip**: store a record, `readAttribution()`
   returns it; malformed JSON → null.
3. **track → flush → sendBeacon**: `installAnalyticsEnv({})`;
   `initAnalytics()`; `track("primary_cta_click", { section: "hero" })`;
   dispatch `pagehide` via the recorded `windowListeners.pagehide` handler →
   assert `beacons.length === 1`, beacon url `EVENT_URL`, and the Blob
   body parses to `{ name: "primary_cta_click", payload: { section: "hero",
   page: "/audit" } }` (Blob.text() is async — await it).
4. **fetch keepalive fallback**: `installAnalyticsEnv({ sendBeacon: false })`;
   `initAnalytics()`; `track("phone_click")`; dispatch `visibilitychange`
   with `document.visibilityState = "hidden"` (stub it on the document stub)
   → `fetchCalls.length === 1` with `keepalive: true` and the JSON body
   matching the event.
5. **Declarative data-event click**: `installAnalyticsEnv({})`;
   `initAnalytics()`; build a chainable element stub with
   `closest("[data-event]")` returning a node with
   `getAttribute("data-event") === "service_opened"` and
   `getAttribute("data-event-payload") === '{"service":"audit_analysis"}'`;
   dispatch a click through the recorded `docListeners.click` handler with
   `{ target: elementStub }`; flush via pagehide → beacon payload contains
   the merged payload + page.
6. **analytics never throws**: `track` with a throwing
   `navigator.sendBeacon` (sendBeacon throws) → no exception propagates.

**Verify**: `node --test tests/analytics.test.mjs` → all pass.

## Test plan

- `tests/theme-menu.test.mjs`: 5 tests (unit theme fns; toggle click;
  OS-change with/without override; unsubscribe; menu open/Escape/close/
  unsubscribe).
- `tests/analytics.test.mjs`: 6 tests (capture; read round-trip; beacon
  flush; fetch fallback; declarative click; never-throw).
- Structural pattern: the existing `audit-retry.test.mjs` harness style.
- Red-before-green is not applicable (no production change); the value is
  future regression protection — verify the new tests PASS against the
  current production code; if any fails, STOP and report (production bug).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/theme-menu.test.mjs tests/analytics.test.mjs` exits 0 (11 new tests)
- [ ] `npm run check` exits 0
- [ ] `npm run test` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -ln "scripts/theme\|scripts/menu\|scripts/analytics" tests/*.mjs` → both new files listed
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- Any new test fails against current production code — that is a live
  production bug; report it with the failing assertion rather than changing
  production code in this plan.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The 800 ms flush timer: tests must NOT rely on real timers — always flush
  via the pagehide/visibilitychange dispatches. If the module's delivery
  internals change (e.g. batching), the pagehide flush assertions are the
  contract to keep.
- When plan 013 adds UTM keys to `audit_started`, the attribution tests here
  (capture/round-trip) are the ones to extend with the new payload keys.
- If `initThemeToggle`'s Persian `aria-label` copy changes, tests assert
  `aria-pressed`/icons only, so they won't churn — keep it that way.
