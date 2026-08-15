# Plan 005: Add HSTS + tighten secret hygiene (`.pi/models.env`, quoted-value scan)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- public/_headers .gitignore .pi/ scripts/pi-doctor.sh tests/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `13ef792`

## Why this matters

Two cheap, high-value hygiene gaps:

1. The site collects PII (name, phone, email) but `public/_headers` has no
   `Strict-Transport-Security` and the CSP lacks `upgrade-insecure-requests`.
   Cloudflare serves HTTPS, but without HSTS a first visit is not pinned —
   an SSL-strip window on a lead form. Header-only fix.
2. `.pi/models.env` (sourced into the environment by the `p` launcher, and
   checked by `pi-doctor.sh`) is **committed and not gitignored** — the
   natural future home for a provider API key. The CI secret scan also
   skips values that start with a quote (`KEY="value"`), the idiomatic
   export form. Fix: ignore the live file, commit an example with names
   only, keep `pi-doctor` green on a fresh checkout, and widen the scan.

## Current state

- `public/_headers:36-40` — security header block: nosniff, Referrer-Policy,
  X-Frame-Options, Permissions-Policy, CSP — no HSTS, and CSP has no
  `upgrade-insecure-requests`.
- `.gitignore` — covers `.env*`, `.dev.vars`, `*.pem`, `*.key`, and many
  `.pi/*` artifacts (`.pi/npm/`, `.pi/git/`, `.pi/sessions/`, `.pi/cache/`,
  `.pi/auth.json`, `.pi/models.json`, `.pi/trust.json`, `.pi/mcp.json`,
  `.pi/mcp-oauth/`, `.pi/mcp-traces/`) — but NOT `.pi/models.env`.
- `.pi/models.env` is tracked (`git ls-files` shows it). Content today:
  model/telemetry settings only (no secrets) — the risk is conditional.
- `scripts/pi-doctor.sh:53` — `.pi/models.env` is in the `required=(...)`
  list; lines ~346-348 grep it for the model profile; lines ~362-363 the
  secret scan regex: `'sk-[A-Za-z0-9_-]{16,}|(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)[[:space:]]*=[[:space:]]*[^"<${][^[:space:]]+'`
  (the `[^"<${]` guard skips `KEY="value"`).
- `p` (launcher, lines 17-19) already guards `[[ -f "$ROOT_DIR/.pi/models.env" ]]` — safe when the file is absent.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Doctor     | `bash scripts/pi-doctor.sh --ci` | exits 0, "no obvious committed secret pattern found" |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |
| Tracked check | `git ls-files .pi/models.env` | empty (untracked) after Step 3 |

## Scope

**In scope**:
- `public/_headers`
- `.gitignore`
- `.pi/models.env.example` (create)
- `scripts/pi-doctor.sh`
- `tests/structural.test.mjs`

**Out of scope** (do NOT touch):
- `.pi/models.env` content — never edit, never commit; it stays on disk.
- `.env.example`, `p`, `.github/workflows/quality.yml`, any other file.

## Git workflow

- Commit once at the end:
  `fix(security): add HSTS and tighten secret hygiene (.pi/models.env, quoted-value scan)`
- Do NOT push or open a PR.

## Steps

### Step 1: HSTS + upgrade-insecure-requests

In `public/_headers`, under the `/*` block, add:

```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

and add `upgrade-insecure-requests` to the `Content-Security-Policy` value
(e.g. after `form-action 'self'`, as the final directive; keep the single-line CSP).

Update the comment block above the `/*` rule to mention HSTS.

**Verify**: `grep -n "Strict-Transport-Security" public/_headers` → present;
`grep -c "upgrade-insecure-requests" public/_headers` → 1.

### Step 2: Structural test for the headers

In `tests/structural.test.mjs`, add a test (follow the file's existing style
— it reads built output and files under the repo root):

```js
test("security headers include HSTS and upgrade-insecure-requests", () => {
  const headers = fs.readFileSync(path.join(root, "public", "_headers"), "utf8");
  assert.match(headers, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  assert.match(headers, /upgrade-insecure-requests/);
});
```

(`root` and `fs`/`path`/`assert`/`test` are already imported in that file.)

**Verify**: `node --test tests/structural.test.mjs` → passes (needs a prior
`npm run build` — run `npm run build` first if dist/ is stale or absent).

### Step 3: Untrack + ignore `.pi/models.env`, add example

1. `git rm --cached .pi/models.env` (file stays on disk, becomes untracked).
2. In `.gitignore`, under the "Pi local runtime" section, add:
   ```
   .pi/models.env
   ```
   (next to the existing `.pi/models.json` etc. entries).
3. Create `.pi/models.env.example` with the same shape as the current live
   file but documented as a template (names only; the current values are
   model/telemetry settings, not secrets — keep them as defaults):

   ```bash
   # Template — copy to .pi/models.env for local use. Never commit .pi/models.env.
   export PI_MAIN_MODEL="opencode-go/deepseek-v4-flash"
   export PI_MAIN_THINKING="max"
   export PI_ENABLED_MODELS=""
   export PI_TELEMETRY="0"
   export PI_SKIP_VERSION_CHECK="1"
   export PI_CACHE_RETENTION="long"
   ```

**Verify**: `git ls-files .pi/models.env` → no output; `git ls-files .pi/models.env.example` → listed; `.pi/models.env` still exists on disk.

### Step 4: Keep pi-doctor green without the live file

In `scripts/pi-doctor.sh`:

1. In the `required=(...)` list (~line 53), replace `.pi/models.env` with
   `.pi/models.env.example`.
2. The model-profile check (~lines 346-348) must tolerate the file's
   absence. Guard it:
   ```bash
   if [[ -f .pi/models.env ]] && grep -Eq '^export PI_MAIN_MODEL=...' .pi/models.env && ...; then
     pass "..."
   elif [[ ! -f .pi/models.env ]]; then
     pass "model profile: .pi/models.env absent locally (example committed); skip"
   else
     fail "..."
   fi
   ```
   (Adjust to keep the original pass/fail copy identical when the file exists.)

**Verify**: `bash scripts/pi-doctor.sh --ci` → exits 0 with the new pass line.

### Step 5: Widen the secret scan to quoted values

In `scripts/pi-doctor.sh` (~lines 362-363), change the regex so a value that
begins with a quote is still scanned. The current guard `[^"<${]` excludes
`"`, `<`, `$`, `{`. New pattern (keep the sk- pattern unchanged):

```
'sk-[A-Za-z0-9_-]{16,}|(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)[[:space:]]*=[[:space:]]*("|\x27)?[^<${][^[:space:]]+'
```

(Allow an optional opening quote — `"` or `'` — but still skip shell
expansion characters. Verify the repo scan stays clean.)

**Verify**: `bash scripts/pi-doctor.sh --ci` → exits 0, "no obvious committed
secret pattern found". Also sanity-check the new regex matches a quoted
assignment: `printf 'export FOO_API_KEY="sk-abcdefghijklmnopqrstuvwxyz1234"\n' | grep -En <regex>` → matches.

## Test plan

- Structural HSTS test (Step 2). No other new tests — pi-doctor is verified
  by running it.

## Done criteria

- [ ] `grep -n "Strict-Transport-Security" public/_headers` → present
- [ ] `grep -c "upgrade-insecure-requests" public/_headers` → 1
- [ ] `git ls-files .pi/models.env` → empty; `.pi/models.env.example` tracked
- [ ] `bash scripts/pi-doctor.sh --ci` → exit 0
- [ ] `node --test tests/structural.test.mjs` passes (after build)
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified (`git status --porcelain`
      shows `.pi/models.env` as untracked — that is expected and correct)

## STOP conditions

Stop and report back (do not improvise) if:

- `.pi/models.env` content contains anything secret-looking (it should not —
  if it does, STOP and report without reproducing the value).
- The model-profile check in pi-doctor.sh is structured differently from the
  excerpt — adapt minimally, keeping the pass/fail semantics, and note it.
- `pi-doctor.sh --ci` fails for an unrelated reason — report, don't fix.

## Maintenance notes

- Anyone who ever puts an API key in `.pi/models.env` now gets: no commit
  (ignored), scan still silent — the regex now catches quoted values, but
  the file is untracked so it can't be committed accidentally. Rotation is
  still required for any key that previously lived in the committed file.
- `p` already tolerates the missing file; a fresh clone must copy the
  example before first `./p` use (the example file documents this).
- Reviewer should scrutinize: the quoted-value regex change does not
  false-positive on the repo (run the scan), and `pi-doctor` still fails
  when the model profile is wrong AND the file exists.
