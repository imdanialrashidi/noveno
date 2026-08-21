# Plan 012: Make the OG-image toolchain self-checking (managed Python env + loud preflight)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless the operator told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- scripts/generate-og-images.py scripts/validate-og-assets.mjs package.json docs/BLOG.md README.md`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (direction item → build plan; option A of two, B rejected — see Maintenance)
- **Effort**: S
- **Risk**: LOW (no behavior change on a healthy machine)
- **Depends on**: none (pairs naturally with 011 for the publishing workflow)
- **Category**: direction / dx (founder publish path)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

Publishing an article requires `npm run generate:og` → Python 3 + Pillow (+ libraqm for Persian
text shaping) — an environment the repository does not manage or check: no `requirements.txt`, no
`pyproject.toml`, no CI step. A fresh machine (or the founder) hits an opaque traceback on their
first publish instead of instructions. The build's own validator (`validate-og-assets.mjs`) is
deliberately dependency-free Node — but it only runs at BUILD time, after the author already
stumbled.

This plan makes the renderer's environment explicit and fails loudly with exact fix commands.
Porting the renderer to Node was considered and REJECTED (see Maintenance notes): Persian RTL text
shaping is exactly what Pillow+raqm was chosen for, and re-implementing it risks silently wrong
social cards.

## Current state

- `package.json`: `"generate:og": "python3 scripts/generate-og-images.py"` and
  `"build:with-og": "npm run generate:og && npm run build"`.
- `scripts/generate-og-images.py` imports Pillow (`from PIL import ...`); header documents intent;
  raqm availability affects complex-script rendering (`ImageFont.Layout.RAQM` usage if present).
- No `requirements*.txt` / `pyproject.toml` anywhere (verified).
- `docs/BLOG.md` step ~4 instructs running `npm run generate:og` before committing cards;
  README §5 repeats it ("Python + Pillow required").
- `scripts/validate-og-assets.mjs` runs in `prebuild` and hard-fails on missing/wrong-size cards —
  the safety net AFTER generation.

### Repo conventions

- Scripts are small, single-purpose, documented in headers; npm scripts compose them.
- CONTRIBUTING: no dependencies without concrete benefit over platform capabilities — a pinned
  `requirements-og.txt` is configuration, not a new dependency surface.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Preflight | `bash scripts/check-og-env.sh` | exit 0 on a good machine; exit 1 with instructions otherwise |
| Generate | `npm run generate:og` | exit 0; regenerates committed cards |
| Validate | `node scripts/validate-og-assets.mjs` | exit 0 |
| Full gate | `bash scripts/verify.sh` | exit 0 |

## Scope

**In scope**:
- `requirements-og.txt` (NEW), `scripts/check-og-env.sh` (NEW)
- `package.json` — `generate:og` chains the preflight
- `docs/BLOG.md`, `README.md` §5 — one-line setup note each
- `CHANGELOG.md`
- `plans/README.md` — status row

**Out of scope**:
- Porting the renderer to Node/Satori (rejected — see Maintenance).
- Changing card design, sizes, filenames, or the committed-card policy.
- Adding Python to CI (cards are committed and validated by the Node prebuild; CI needs no
  Python).

## Git workflow

- Branch: `improve/012-og-env-preflight`
- Conventional commits: `dx(publish): managed og-renderer deps + loud env preflight`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pin the Python requirements

Create `requirements-og.txt` with the versions actually working here:

```bash
python3 -c "import PIL; print(PIL.__version__)"    # record this version
```

```
# Social-card renderer (scripts/generate-og-images.py).
# libraqm is a system package for Persian shaping: Debian/Ubuntu:
#   sudo apt-get install libraqm0   (macOS: brew install pillow shipsraqm via wheels)
Pillow==<recorded-version>
```

**Verify**: `python3 -m pip install --dry-run -r requirements-og.txt` → resolves cleanly (or is
already satisfied).

### Step 2: Write the preflight

`scripts/check-og-env.sh`:

```bash
#!/usr/bin/env bash
# Fails loudly BEFORE generate-og-images.py with exact fixes, so the first
# article publish never dies on an opaque ImportError.
set -euo pipefail
fail() { printf 'OG renderer environment problem:\n%s\n' "$1" >&2; exit 1; }

command -v python3 >/dev/null || fail "python3 not found. Install Python 3.10+ first."
python3 -c "import PIL" 2>/dev/null || \
  fail "Pillow missing. Run: python3 -m pip install -r requirements-og.txt"
# Version pin check against requirements-og.txt
REQ_VER="$(sed -n 's/^Pillow==\(.*\)$/\1/p' "$(dirname "$0")/../requirements-og.txt")"
GOT_VER="$(python3 -c 'import PIL; print(PIL.__version__)')"
[ "$GOT_VER" = "$REQ_VER" ] || fail "Pillow $GOT_VER installed, $REQ_VER pinned. Run: python3 -m pip install -r requirements-og.txt"
printf 'OG renderer environment OK (Pillow %s)\n' "$GOT_VER"
```

Make it executable (`chmod +x`). If the generator uses raqm layout features, add a best-effort
check (`python3 - <<'PY' ... ImageFont.core.HAVE_RAQM ... PY`) printing a WARNING (not failure)
when absent, pointing at the apt/brew line above — read the .py file first and mirror whichever
feature flags it relies on.

**Verify**: `bash scripts/check-og-env.sh` → success line here; then simulate a bad env safely by
running with PATH stripped of python3 (`env PATH=/usr/bin:/bin bash scripts/check-og-env.sh` may
still find python3 — instead temporarily rename nothing; simply review the failure branch by
inspection if simulation is awkward). Record honestly which branches were executed vs inspected.

### Step 3: Chain it into the npm script

```json
"generate:og": "bash scripts/check-og-env.sh && python3 scripts/generate-og-images.py",
```

`build:with-og` inherits the preflight automatically.

**Verify**: `npm run generate:og` → prints OK line then regenerates cards; `git status` shows no
unintended card diffs (byte-stable renders expected on an unchanged tree — if Pillow re-renders
with byte differences, that's normal; confirm `validate-og-assets.mjs` passes and commit ONLY if
the operator wants refreshed bytes — default: restore unchanged files with `git checkout -- public/og`
if diffs are pure noise).

### Step 4: Docs + changelog

One line each in BLOG.md step 4 area and README §5: "first time on a machine? run
`python3 -m pip install -r requirements-og.txt`; `generate:og` preflights everything else."
CHANGELOG under Unreleased → Added.

**Verify**: `bash scripts/verify.sh` → exit 0 (its Python branch keys off
`pyproject.toml|requirements.txt` at ROOT — `requirements-og.txt` does NOT match that glob, so
gate behavior is unchanged; confirm by reading verify.sh's condition before finishing).

## Test plan

No automated tests (environment detection isn't unit-testable meaningfully here). The Node-side
validator suite (`tests/og-assets.test.mjs`) remains the correctness net for generated artifacts.

## Done criteria

ALL must hold:

- [ ] `bash scripts/check-og-env.sh` exits 0 on this machine and exits 1 with actionable text when
      Pillow is absent (verified at least by temporary venv WITHOUT Pillow:
      `python3 -m venv /tmp/ogtest && /tmp/ogtest/bin/python ...` path override, then delete)
- [ ] `npm run generate:og` runs preflight first (observable output order)
- [ ] requirements-og.txt pins the working Pillow version
- [ ] BLOG.md + README updated; CHANGELOG entry present
- [ ] `bash scripts/verify.sh` exit 0; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The installed Pillow version differs from what `generate-og-images.py` requires syntactically
  (script uses APIs from a different major).
- Chaining the preflight into `generate:og` breaks any test that shells out to the script
  (`grep -rn "generate:og\|generate-og-images" tests/ scripts/`).
- Card regeneration produces LARGE visual diffs on an unchanged tree (renderer drift — needs a
  human look at one card before committing bytes).

## Maintenance notes

- Option B (Node port, e.g. satori/resvg) stays rejected: Persian shaping fidelity risk on the
  brand's social surface outweighs env convenience; revisit only if Pillow becomes unmaintainable.
- When bumping Pillow, regenerate all cards in the same commit (bytes change) and eyeball two.
- Reviewers should run the negative-path check themselves once (venv without Pillow).
