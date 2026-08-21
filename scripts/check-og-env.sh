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
# Best-effort raqm check for Persian shaping (warning only)
python3 - <<'PY' 2>/dev/null | grep -q "WARN" && printf 'WARNING: libraqm not available — Persian text shaping may be degraded. Install: sudo apt-get install libraqm0 (Debian/Ubuntu) or brew reinstall pillow (macOS)\n' >&2 || true
try:
    from PIL import ImageFont
    # Pillow 10+ exposes Layout.RAQM when libraqm is available via wheels
    has_raqm = hasattr(ImageFont, "Layout") and hasattr(ImageFont.Layout, "RAQM")
    if not has_raqm:
        print("WARN")
except Exception:
    print("WARN")
PY
printf 'OG renderer environment OK (Pillow %s)\n' "$GOT_VER"
