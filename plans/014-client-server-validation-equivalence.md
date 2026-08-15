# Plan 014: Pin client↔server validation equivalence (phone digits, email, caps)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- src/data/audit.ts functions/lib/normalize.ts functions/lib/validate.ts tests/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `13ef792`

## Why this matters

The client and the server each implement phone digit-normalization and an
email regex: `normalizePhoneClient`/`latinDigits` and `EMAIL_PATTERN` in
`src/data/audit.ts`, versus `normalizePhone`/`normalizeDigits` in
`functions/lib/normalize.ts` and the server `EMAIL_PATTERN` in
`functions/lib/validate.ts`. A change on one side (a new digit script, a
+98 handling tweak, a stricter email regex) silently desyncs what the user
experiences (client-side UX validation) from what the server accepts. One
deliberate divergence exists: the client caps phone length at 15 digits,
the server at 24. Rather than force a shared import (which would entangle
the browser bundle with the function's module graph), pin the equivalence
with tests: representative inputs must produce identical outcomes on both
sides, and the documented divergence must be asserted explicitly so nobody
changes one side without seeing the test fail.

## Current state

- `src/data/audit.ts:253-266` (client):
  ```ts
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function latinDigits(value: string): string { ... ۰-۹ and ٠-٩ → Latin ... }
  export function normalizePhoneClient(value: string): string {
    return latinDigits(value).replace(/[^\d+]/g, "");
  }
  ```
  and `validateFieldClient("phone", ...)` at ~line 273-287: requires ≥10
  digits, rejects >15 (`digits.length > 15 → "invalid"` — "Client cap (≤15
  digits) is deliberately stricter than the server").
- `functions/lib/normalize.ts` — `normalizeDigits`, `normalizePhone`,
  `normalizeEmail`, `normalizePlain`, `normalizeText` (read it before
  writing tests).
- `functions/lib/validate.ts:23` — server `EMAIL_PATTERN` (same shape as
  client), `LIMITS.phone: 24` in `functions/lib/contract.ts:100-101`.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Equiv tests | `node --test tests/validation-equivalence.test.mjs` | all pass (new file) |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

## Scope

**In scope**:
- `tests/validation-equivalence.test.mjs` (create)

**Out of scope** (do NOT touch):
- `src/data/audit.ts`, `functions/lib/normalize.ts`, `functions/lib/validate.ts`, `functions/lib/contract.ts` — this plan adds tests only. If a test proves a real divergence, STOP and report it.
- Any other file.

## Git workflow

- Commit once at the end:
  `test: pin client↔server validation equivalence (phone, email, caps)`
- Do NOT push or open a PR.

## Steps

### Step 1: Read both implementations and enumerate the input corpus

Read `functions/lib/normalize.ts` fully (its `normalizePhone` does more
than digit-mapping — it may strip/keep `+`, handle `00` prefixes, etc.).
The corpus below assumes the shapes quoted above; adjust the corpus to the
actual functions after reading them. Then write the test file.

### Step 2: Write the equivalence suite

Create `tests/validation-equivalence.test.mjs`. Import:

```js
import { normalizePhoneClient, validateFieldClient } from "../src/data/audit.ts";
import { normalizePhone, normalizeEmail } from "../functions/lib/normalize.ts";
```

(check how `tests/audit-function.test.mjs` imports from `functions/lib` and
how `tests/audit-retry.test.mjs` imports from `src/` — mirror both).

Tests:

1. **Phone normalization equivalence** — for each input, assert
   `normalizePhoneClient(input) === normalizePhone(input)`:
   `"۰۹۳۵۳۵۹۸۶۲۰"`, `"٠٩٣٥٣٥٩٨٦٢٠"`, `"0935 359 8620"`, `"0935-359-8620"`,
   `"+98 935 359 8620"`, `"00989353598620"`, `"۰۹۳۵-۳۵۹-۸۶۲۰"`,
   `" 09353598620 "`, mixed `"۰۹35۳۵۹۸۶20"`.
2. **Email pattern equivalence** — for each input, assert
   `validateFieldClient("email", e) === ""` matches the server's acceptance
   (the server check is `!EMAIL_PATTERN.test(email) → "invalid"`; replicate
   by calling `validateAuditPayload` from `../functions/lib/validate.ts`
   with a payload containing that email, or compare against the server
   regex by importing `validateAuditPayload` and building a minimal valid
   payload — follow the existing `validPayload()` pattern in
   `tests/audit-function.test.mjs`). Corpus: `"a@b.co"`, `"user@example.com"`,
   `"user+tag@example.com"`, `"no-at-sign"`, `"a@b"`, `"a@b.c"`,
   `"a b@c.d"`, `"a@b.c.d.e"`.
3. **Phone validity agreement** — for each input, assert
   `validateFieldClient("phone", p)` is `""` exactly when the server
   accepts the phone (via `validateAuditPayload` on a valid payload with
   that phone — mirror the `validPayload()` helper). Corpus: valid
   `"09353598620"`, `"۰۹۳۵۳۵۹۸۶۲۰"`, `"+989353598620"`, and invalid
   `"12345"`, `"abc"`, `""`.
4. **Documented divergence pinned**: `validateFieldClient("phone", "0935359862012345")` (16 digits) → `"invalid"`, while the same 16-digit phone passes server validation (`validateAuditPayload` → `ok: true`); and a 15-digit phone passes both. Comment in the test explains this is the documented deliberate divergence (client UX cap vs server limit).

**Verify**: `node --test tests/validation-equivalence.test.mjs` → all pass.
If any equivalence fails, that is a REAL divergence — report it with the
input and both results; do NOT adjust the tests to hide it (unless the
divergence is itself documented, in which case pin it like test 4 and
report).

### Step 3: Suite integration

**Verify**: `npm test` → all pass. `npm run build` → exit 0.

## Test plan

- New `tests/validation-equivalence.test.mjs` per Step 2.
- Pattern: `validPayload()` helper style from `tests/audit-function.test.mjs`.

## Done criteria

- [ ] `tests/validation-equivalence.test.mjs` exists with ≥ 4 tests (normalization, email, validity agreement, divergence pin)
- [ ] `node --test tests/validation-equivalence.test.mjs` passes
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified (tests-only plan)

## STOP conditions

Stop and report back (do not improvise) if:

- A corpus input produces different results on the two sides beyond the
  documented 15-vs-24 digit cap (report the divergence; do not weaken the test).
- `normalizePhone` semantics differ from the quoted shape (read it first;
  adapt the corpus to the real semantics and note it).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- When the server's normalization changes (new digit script, +98
  handling), the equivalence test forces a deliberate client decision —
  either mirror it or document a new divergence.
- If a shared pure module is ever extracted (client+server importing one
  normalize), this suite becomes the equivalence guarantee before/after
  the refactor.
- Reviewer should scrutinize: the divergence test (test 4) is the only
  place the two sides are allowed to differ — any other failure is a bug.
