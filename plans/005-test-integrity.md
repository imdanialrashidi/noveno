# Plan 005: Test integrity (kill the tautology, guarantee lane coverage, exercise the Turnstile lifecycle)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- tests/audit-email-spike.test.mjs .pi/verification.json scripts/verify-affected.mjs tests/client-modules.test.mjs src/scripts/audit/turnstile.ts tests/verify-affected.test.mjs`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> NOTE: if plan 001 already fixed the tautology assertion and added its own
> drift-guard test, skip Step 1 after verifying the fix is present.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW–MED (new tests only; one small guarded behavior addition)
- **Depends on**: none hard; benefits from landing before/with 001 (its seam test complements 001's journey test)
- **Category**: tests
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

Three integrity gaps in the verification net:

1. **A tautological assertion.** `tests/audit-email-spike.test.mjs:102` asserts
   `assert.equal(calls.email.length, undefined ?? calls.email.length)` — a value compared to
   itself, always true. The "email attempted on failure path" check verifies nothing.
2. **Unrouted test files.** `.pi/verification.json` drives affected-file verification
   (`node scripts/verify-affected.mjs --file <path>`). `tests/work-filter.test.mjs` and
   `tests/audit-email-spike.test.mjs` appear in NO lane, so edits to `src/scripts/work-filter.ts`
   or the D‑01 email path pass the affected lane green. Worse, nothing prevents future test files
   from silently escaping routing too.
3. **The Turnstile client lifecycle is untested.** Expiry/error callbacks, theme re-render
   (`syncTheme`), retry semantics, and token freshness are live paths on the lead form; the only
   mock exercises the happy callback. Relatedly, `getToken()`'s doc claims "Existing token if
   fresh" but no age check exists — a token minted minutes earlier fails siteverify (~5-min
   lifetime) and costs the user a spurious 403 + manual retry.

## Current state

### The tautology — `tests/audit-email-spike.test.mjs` (~line 96–104)

```ts
test("email failure → 500 never success (spike)", async () => {
  const { deps, calls } = makeDeps({ sendEmail: async () => ({ ok: false }) });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, "server_error");
  assert.equal(calls.email.length, undefined ?? calls.email.length, "email was attempted");
});
```

Fix (one line): `assert.equal(calls.email.length, 1, "email was attempted");`
(If plan 001 landed, it already did this AND added a label drift-guard importing from
`functions/lib/email.ts` — verify and skip.)

### Lane config — `.pi/verification.json`

Lane `app` includes (abridged): `["src/**", ..., "tests/structural.test.mjs", ...,
"tests/sitemap-parser.test.mjs"]` with matching `commands` entries per file. Lane `functions`
includes `["functions/**", "tests/audit-function.test.mjs"]`.

Missing today:

- `tests/work-filter.test.mjs` (covers `src/scripts/work-filter.ts`) — belongs in the `app` lane.
- `tests/audit-email-spike.test.mjs` (imports `functions/api/audit.ts` +
  `functions/lib/email.ts`) — belongs in the `functions` lane.

Every other suite is routed (workflow-evals, verify-affected, safety-guard, launcher,
project-contract, gate-order lanes). A new guard test must enforce total coverage of
`tests/*.test.mjs`.

### Turnstile bridge — `src/scripts/audit/turnstile.ts`

```ts
export class TurnstileBridge {
  private widgetId: string | null = null;
  private token: string | null = null;
  ...
  private onToken(value: string | null): void {
    this.token = value;
    for (const waiter of this.waiters.splice(0)) waiter(value);
  }

  async ensureRendered(): Promise<boolean> {
    ...
    this.widgetId = window.turnstile.render(this.container, {
      sitekey: this.siteKey,
      theme: effectiveTheme() === "dark" ? "dark" : "light",
      callback: (value: string) => this.onToken(value),
      "expired-callback": () => this.onToken(null),
      "error-callback": () => this.onToken(null),
    });
    return true;
  }

  /** Existing token if fresh, else reset the widget and wait (bounded). */
  async getToken(): Promise<string | null> {
    if (this.token) return this.token;      // ← no freshness check despite the doc
    ...
    window.turnstile.reset(this.widgetId);
    return new Promise((resolve) => { ...20s timeout... });
  }
  invalidate(): void { this.token = null; }
  retry(): void { this.token = null; this.scriptFailed = false; }
  syncTheme(): void {
    if (!this.widgetId || !window.turnstile) return;
    const id = this.widgetId;
    window.turnstile.remove(id);
    this.widgetId = null;
    this.token = null;
    void this.ensureRendered();
  }
}
```

It imports `effectiveTheme()` from `../theme.ts` (reads the `data-theme` attribute / media query).

### Existing harnesses to reuse

- `tests/audit-retry.test.mjs`: full-journey harness (`installGlobals`, fake DOM element
  registry, `makeTurnstileMock()` with `render/reset/remove/emitToken`, scriptable fetch).
  Its `FakeMutationObserver` is a no-op — so attribute-mutation-driven `syncTheme` cannot fire
  through the journey harness; test `syncTheme` via direct instantiation instead (below).
- `tests/client-modules.test.mjs`: self-contained fake-DOM module tests (analytics/theme/menu/motion)
  — the right home for direct `TurnstileBridge` unit tests. It sets up
  `globalThis.matchMedia`, document shims, etc. Follow its header comment conventions.

### Repo conventions

- Tests pin observable behavior, not internal calls (see the client-modules header comment).
- Deterministic: no real network (the Turnstile *real-endpoint* test lives behind
  `RUN_NETWORK_TESTS`); use injected clocks where time matters.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Spike tests | `node --test tests/audit-email-spike.test.mjs` | all pass |
| Module tests | `node --test tests/client-modules.test.mjs` | all pass |
| Journey tests | `node --test tests/audit-retry.test.mjs` | all pass |
| Router tests | `node --test tests/verify-affected.test.mjs` | all pass |
| Affected-lane smoke | `node scripts/verify-affected.mjs --file src/scripts/work-filter.ts` | runs work-filter suite |
| Full suite (after build) | `npm test` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `tests/audit-email-spike.test.mjs` — tautology fix (skip if 001 did it)
- `.pi/verification.json` — route the two suites; add the new guard test's own entry
- `tests/lane-coverage.test.mjs` — NEW guard test
- `src/scripts/audit/turnstile.ts` — token freshness ONLY as specified (Step 4)
- `tests/client-modules.test.mjs` — new TurnstileBridge unit-test section
- `tests/audit-retry.test.mjs` — expiry-path journey case (extend mock)
- `plans/README.md` — status row

**Out of scope**:
- Rewriting `FakeMutationObserver` into a working observer (journey-level theme sync stays
  browser-QA territory; direct `syncTheme` unit tests cover the logic).
- Any change to `theme.ts`, `motion.ts` coverage gaps beyond Turnstile (recorded, not scheduled).
- Modifying lane `include` globs beyond adding the two files + guard entry.

## Git workflow

- Branch: `improve/005-test-integrity`
- Conventional commits, e.g.:
  - `test: replace tautology with exact email-attempt count`
  - `test(dx): route orphaned suites + add lane-coverage guard`
  - `test(audit): pin turnstile lifecycle; treat stale tokens as expired`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the tautology

Replace line ~102 as shown above. If already fixed by plan 001, verify and move on.

**Verify**: `grep -n "undefined ??" tests/audit-email-spike.test.mjs` → no matches.

### Step 2: Route the orphaned suites

In `.pi/verification.json`:

1. `app` lane: add `"tests/work-filter.test.mjs"` to `include` AND
   `["node", "--test", "tests/work-filter.test.mjs"]` to `commands`.
2. `functions` lane: add `"tests/audit-email-spike.test.mjs"` to `include` AND its
   `node --test` command.

**Verify**: `node scripts/verify-affected.mjs --file src/scripts/work-filter.ts` → runs the
work-filter suite; same for `--file functions/lib/email.ts` → runs audit-function +
audit-email-spike suites.

### Step 3: Add the lane-coverage guard

Create `tests/lane-coverage.test.mjs`:

```ts
// Guards against unrouted test suites: every tests/*.test.mjs must appear in
// at least one lane of .pi/verification.json, otherwise affected-file
// verification silently skips regressions (regression: work-filter and
// audit-email-spike escaped routing until 2026-08).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, ".pi", "verification.json"), "utf8"));

test("every test suite is routed in .pi/verification.json", () => {
  const routed = new Set(config.routes.flatMap((r) => r.include));
  const suites = fs.readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".test.mjs"));
  const orphans = suites.filter((f) => !routed.has(`tests/${f}`));
  assert.deepEqual(orphans, [], "unrouted test suites found");
});
```

Then add `"tests/lane-coverage.test.mjs"` itself to the `workflow-contract` lane's `include` and
`commands` (that lane already owns workflow wiring like `gate-order.test.mjs`).

**Verify**: `node --test tests/lane-coverage.test.mjs` → passes now that Step 2 routed everything.

### Step 4: Token freshness in the bridge (small, specified behavior change)

In `src/scripts/audit/turnstile.ts`:

```ts
private tokenAt = 0;
/** Cloudflare tokens live ~5 minutes; refresh margin keeps siteverify safe. */
private static readonly TOKEN_TTL_MS = 4 * 60_000;
```

- In `onToken(value)`: when `value !== null`, set `this.tokenAt = Date.now()`.
- Replace the first line of `getToken()`:

```ts
if (this.token && Date.now() - this.tokenAt < TurnstileBridge.TOKEN_TTL_MS) return this.token;
```

(When stale, fall through: `ensureRendered()` short-circuits on the existing widgetId, then
`reset(this.widgetId)` forces a fresh challenge and the bounded wait proceeds — exactly the
documented "else reset the widget and wait".)

Update `invalidate()` and `syncTheme()` to reset `tokenAt = 0` alongside `token = null`. Update
the doc comment to state the TTL explicitly.

**Verify**: `npm run check` → exit 0; existing suites still pass.

### Step 5: Unit-test the bridge lifecycle (direct instantiation)

Add a section to `tests/client-modules.test.mjs` following its fake-DOM header conventions:

Setup needed: `globalThis.window` alias with `turnstile` mock (reuse the shape from
`audit-retry.test.mjs`'s `makeTurnstileMock`, copied locally — suites stay self-contained), plus
whatever `effectiveTheme()` needs (a `document.documentElement.setAttribute("data-theme", ...)`
shim — mirror how theme tests set attributes).

Cases:

1. **Happy token reuse**: render → emitToken("t1") → `getToken()` resolves "t1" without calling
   `reset`.
2. **Expiry clears**: inject a controllable clock? The bridge calls `Date.now()` directly; use
   `fakeTimers`-style override: save `const realNow = Date.now` and stub
   `Date.now = () => shiftedTime` around the await points (pattern used elsewhere in node tests
   here — grep `Date.now` stubs in the repo; if none exists, stub/restore in try/finally). Emit
   "t1", advance > 4 min, `getToken()` must call `reset` and resolve only after a NEW
   `emitToken("t2")`.
3. **expired-callback fires mid-wait**: start `getToken()` (no token yet), invoke the captured
   `"expired-callback"` option → promise resolves `null` (waiter notified with null).
4. **invalidate/retry semantics**: invalidate clears the stored token; retry also clears
   `scriptFailed` so a previously failed script load retries.
5. **syncTheme re-renders**: with widget rendered and token present, call `syncTheme()` → mock's
   `removes === 1`, token cleared, second `render` observed with the OTHER theme value (toggle
   `data-theme` between calls).

Keep each case independent (fresh bridge + fresh mock).

**Verify**: `node --test tests/client-modules.test.mjs` → all pass.

### Step 6: Journey-level expiry regression case

In `tests/audit-retry.test.mjs`, extend `makeTurnstileMock` with:

```ts
expire() { this.options["expired-callback"](); },
fail() { this.options["error-callback"](); },
```

Add a journey test: complete steps to submit once successfully; then simulate a SECOND submission
where the mock emits expiry before the next `getToken()` — assert the flow resets the widget
(`resets >= 1`) and still completes after `emitToken` delivers a fresh token (or surfaces the
truthful turnstile banner on timeout — follow whichever neighboring test shape fits the harness's
timeout controls). Keep it deterministic: no reliance on real timers beyond the harness's
existing patterns.

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass.

## Test plan

Summarized in steps. Red-first guidance: Step 1's corrected assertion fails pre-fix by
construction (it currently passes vacuously — demonstrate by temporarily asserting an impossible
count if you want explicit proof). Steps 5–6 fail against current code because expiry/freshness
behavior doesn't exist.

## Done criteria

ALL must hold:

- [ ] `grep -rn "undefined ??" tests/` → no matches
- [ ] `node scripts/verify-affected.mjs --file src/scripts/work-filter.ts` runs its suite;
      `--file functions/lib/email.ts` routes both functions suites
- [ ] `node --test tests/lane-coverage.test.mjs` passes
- [ ] `node --test tests/client-modules.test.mjs tests/audit-retry.test.mjs tests/audit-email-spike.test.mjs` all pass
- [ ] `npm run check` exits 0; `npm run build` exits 0; `npm test` passes; `bash scripts/verify.sh` exits 0
- [ ] No files outside the in-scope list modified; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Plan 001 changed `delivery.ts`/`index.ts` signatures in ways that alter how the journey harness
  primes fetch responses (re-read those excerpts; adapt, don't fight).
- Stubbing `Date.now` proves impossible cleanly in the module-test harness (no other repo
  precedent) — report rather than introducing a timer library dependency.
- The lane guard flags PRE-EXISTING intentional exclusions you cannot classify (report the list;
  someone decides whether to route or allowlist them explicitly).
- Adding the TTL changes behavior any existing test depended on (e.g. a test reuses one token
  across a simulated long journey) — adapt the test only if its intent survives; otherwise report.

## Maintenance notes

- The lane guard makes adding a suite a two-line ritual: create the file, route it. Reviewers
  should reject PRs that delete either line.
- `TOKEN_TTL_MS` (4 min) is intentionally under Cloudflare's ~5-minute token lifetime; if
  Turnstile ever documents a different lifetime, adjust the constant — it's the only place.
- Deliberately deferred: a functional MutationObserver for automatic theme-sync testing (browser
  QA covers it today); motion.ts's untested `initHeroStages`/`initStagger` (separate finding,
  not scheduled in this cycle).
