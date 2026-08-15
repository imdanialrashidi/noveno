# Plan 006: Regenerate the lockfile against the official npm registry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- package-lock.json package.json scripts/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW/MED
- **Depends on**: plans/017-dependency-hygiene.md (already applied — package.json changed; this plan syncs the lockfile last)
- **Category**: dependencies
- **Planned at**: commit `13ef792`

## Why this matters

Every `resolved` URL in `package-lock.json` points at
`registry.npmmirror.com` (a third-party mirror; 497 URLs, zero
`registry.npmjs.org` entries). CI installs from that mirror — a mirror
outage or rate limit breaks every build, and "checked against the official
registry" is false in practice: `npm audit` against the configured registry
fails with 404 (`audit endpoint not implemented`). Integrity hashes in the
lockfile mitigate tampering, but availability and provenance depend on the
mirror. This plan regenerates the lockfile against `registry.npmjs.org`
(keeping exact versions) and adds a CI-time guard so the lockfile cannot
silently flip back to a non-official registry.

## Current state

- `package-lock.json` — every `"resolved"` value starts with
  `https://registry.npmmirror.com/` (verified: 497 occurrences of
  `registry.npmmirror`, 0 of `registry.npmjs.org`).
- `package.json` — pins `astro: 7.2.0`, `tailwindcss: 4.3.3`,
  `wrangler: 4.120.1`; other deps use ranges.
- `scripts/verify-package-integrity.mjs` — runs `npm view` against the
  locally configured registry; does not inspect lockfile resolved hosts.
- The developer's local npm config may point at the mirror (registry
  configured in ~/.npmrc); do NOT change user-level config. The lockfile and
  the CI guard are repo-level fixes.
- After plan 017 the `package.json` dependencies changed (fontsource moved
  to devDependencies, workers-types removed, yaml added by plan 016) — this
  plan's regeneration must pick up those changes.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Regenerate | `npm install --package-lock-only --registry=https://registry.npmjs.org/` | exit 0 |
| Diff       | `git diff --stat package-lock.json` | only `resolved` URLs (and new/changed entries for the package.json changes) |
| Integrity check | `node scripts/verify-package-integrity.mjs` | exits 0 |
| Install   | `npm ci`                    | exit 0 |
| Full suite | `npm test`                  | all pass |

## Scope

**In scope**:
- `package-lock.json`
- `scripts/verify-package-integrity.mjs`

**Out of scope** (do NOT touch):
- `package.json` (plan 017 owns it)
- `.npmrc` (do not create one — the registry override is a one-shot flag; a
  committed `.npmrc` would force the official registry on the founder's
  Iranian network, which may be deliberately using the mirror for speed)
- Any other file.

## Git workflow

- Commit once at the end:
  `chore(deps): regenerate lockfile against the official npm registry`
- Do NOT push or open a PR.

## Steps

### Step 1: Regenerate the lockfile

Run:

```bash
npm install --package-lock-only --registry=https://registry.npmjs.org/ --no-audit
```

**Verify**: exit 0. Then inspect the diff:

```bash
git diff package-lock.json | grep -c "registry.npmmirror"   # → 0 (or only removals)
git diff package-lock.json | grep "^[+-].*resolved" | grep -c "registry.npmjs.org"  # → matches the number of changed lines
```

Also confirm versions are unchanged for the pinned packages:
`grep -n '"astro": "7.2.0"\|"tailwindcss": "4.3.3"\|"wrangler": "4.120.1"' package-lock.json` → present with the same version strings (check both the top-level deps section and the resolved package entries).

### Step 2: Add a lockfile-registry guard

In `scripts/verify-package-integrity.mjs`, add a check (follow the file's
existing style — read it first) that fails when the lockfile contains a
`resolved` host that is not `registry.npmjs.org`:

```js
// Lockfile must resolve from the official registry only — a mirror
// (e.g. registry.npmmirror.com) breaks npm audit and makes CI installs
// depend on a third party's availability.
const lock = JSON.parse(fs.readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const bad = new Set();
for (const pkg of Object.values(lock.packages ?? {})) {
  const r = pkg.resolved;
  if (typeof r === "string" && !r.startsWith("https://registry.npmjs.org/")) bad.add(r);
}
if (bad.size > 0) { /* print each and exit non-zero */ }
```

(The file already imports `fs`/uses `process.exit` — match its conventions;
if it uses a different import style, adapt.)

**Verify**: `node scripts/verify-package-integrity.mjs` → exits 0 with the
new check passing. Negative test (manual, not committed): temporarily set
one `resolved` URL back to npmmirror and re-run → the check must fail; then
restore.

### Step 3: Prove install + suite

**Verify**: `npm ci` → exit 0. `npm test` → all pass. `npm run build` → exit 0.

## Test plan

- No new test files — the guard lives in the existing integrity script
  (which CI runs); its negative path is proven manually in Step 2.

## Done criteria

- [ ] `grep -c "registry.npmmirror" package-lock.json` → 0
- [ ] `node scripts/verify-package-integrity.mjs` → exit 0 and includes the new registry guard
- [ ] `npm ci` succeeds
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- `npm install --package-lock-only` changes dependency VERSIONS (other than
  reflecting the plan-016/017 package.json changes) — restore and report.
- The official registry is unreachable from this network (exit code / timeout) — report; do not fall back to a different registry.
- `npm ci` fails after the regeneration — report the error.

## Maintenance notes

- The founder's local `npm install` (with the mirror configured) will flip
  the lockfile back to npmmirror URLs; the CI guard catches that at PR time
  with a clear failure. Documented trade-off: repo lockfile = official
  registry, local speed = mirror.
- `npm audit` works against the official registry (verified: 0 prod
  vulnerabilities at audit time).
- Reviewer should scrutinize: the guard allows only `registry.npmjs.org`
  prefix — GitHub Packages or other legitimate hosts would need an explicit
  allowlist extension (none needed today).
