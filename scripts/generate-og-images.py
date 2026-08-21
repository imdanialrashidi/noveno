#!/usr/bin/env python3
"""
Generate the Noveno social-card set (1200×630 PNGs) at build time.

Cards (docs/IMAGERY.md §Social cards):
  public/og.png                        homepage / default card
  public/og/about.png                  about card
  public/og/work.png                   work index
  public/og/work/{slug}.png            per work item (real preview when
                                       available; typographic concept card
                                       otherwise, always proof-labeled)
  public/og/blog.png                   blog index (وبلاگ نوونو)
  public/og/blog/{slug}.png            per published article (title +
                                       category; drafts are never rendered)

The homepage card uses the brand «signal field» artwork (the same
scatter-to-structure composition as the hero — drawn in Pillow geometry,
no screenshots) since the hero is now brand artwork, not a product shot.

Brand tokens come from docs/DESIGN.md §6; typography is Noto Sans Arabic
(system font; Estedad/Vazirmatn ship as woff2 which Pillow cannot read).
The NOVENO wordmark is drawn from the brand path geometry (same path as
src/components/brand/Logo.astro). No runtime OG service — cards are
static assets referenced by og:image/twitter:image in page metadata.

Requires: python3 + Pillow with raqm (Arabic shaping).
Run:  python3 scripts/generate-og-images.py
"""

import os
import re
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
CANVAS = "#f9fafa"
SURFACE = "#ffffff"
SOFT = "#f1f4f2"
INK = "#070808"
MUTED = "#4c5751"
FAINT = "#66716b"
PRIMARY = "#679e86"
ON_PRIMARY = "#06130d"
LINE = "#dfe3e1"
LINE_STRONG = "#7e8a83"
GREEN = "#2f7a5e"  # text-action

FONT_DIR = "/usr/share/fonts/noto"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "og")

WORDMARK_PATH = (
    "M266.458,392.827L124.074,174.407L63.904,318.218L0.5,317.995L114.581,51.524"
    "L265.649,288.586C265.649,288.586 347.798,174.154 371.997,84.837L317.715,62.386"
    "L263.782,84.45C263.782,84.45 269.742,147.856 313.528,163.292L284.862,214.638"
    "C284.862,214.638 208.851,188.767 199.035,49.522L317.889,0.5L436.986,49.522"
    "C436.986,49.522 436.866,152.092 266.458,392.827Z"
)


def font(name, size):
    return ImageFont.truetype(f"{FONT_DIR}/{name}", size)


F_WORD = font("NotoSansArabic-SemiCondensedExtraBold.ttf", 64)
F_KICKER = font("NotoSansArabic-SemiCondensedBold.ttf", 26)
F_TITLE = font("NotoSansArabic-SemiCondensedExtraBold.ttf", 44)
F_TITLE_SMALL = font("NotoSansArabic-SemiCondensedExtraBold.ttf", 36)
F_BODY = font("NotoSansArabic-SemiCondensedMedium.ttf", 24)
F_CHIP = font("NotoSansArabic-SemiCondensedBold.ttf", 24)
F_FOOT = font("NotoSansArabic-SemiCondensedMedium.ttf", 20)


def rtl_text(draw, xy, text, fnt, fill, anchor="ra"):
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor,
              features=["rtla"], direction="rtl")


def wrap_text(draw, text, fnt, max_width):
    """Greedy RTL-safe wrapping on word boundaries using measured widths."""
    words = text.split()
    if not words:
        return []
    lines = []
    current = ""
    for word in words:
        probe = f"{word} {current}".strip() if current else word
        if draw.textlength(probe, font=fnt) <= max_width or not current:
            current = probe
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def truncate_to_lines(draw, text, fnt, max_width, max_lines):
    lines = wrap_text(draw, text, fnt, max_width)
    if len(lines) <= max_lines:
        return lines
    out = lines[: max_lines - 1]
    last = lines[max_lines - 1]
    while last and draw.textlength(last + "…", font=fnt) > max_width:
        last = last[:-1]
    out.append(last.rstrip() + "…")
    return out


def cover_panel(shot_path, panel_w, panel_h, img, draw, x, y):
    """Cover-crop a screenshot into the left panel + hairline divider."""
    out = img
    im = Image.open(shot_path).convert("RGB")
    ratio = panel_w / panel_h
    pw, ph = im.size
    if pw / ph > ratio:
        nw = int(ph * ratio)
        left = (pw - nw) // 2
        im = im.crop((left, 0, left + nw, ph))
    else:
        nh = int(pw / ratio)
        top = (ph - nh) // 2
        im = im.crop((0, top, pw, top + nh))
    im = im.resize((panel_w, panel_h), Image.LANCZOS)
    out.paste(im, (x, y))
    draw.rectangle([x + panel_w, y, x + panel_w + 2, y + panel_h], fill=LINE)


def signal_panel(draw, x, y, w, h):
    """The brand artwork — scattered signals becoming a structured system.
    Pillow mirror of the hero SVG composition (docs/DESIGN.md §16):
    faint field grid, a hairline system plate with registered squares,
    and scattered rotated marks converging into it. No logo paste, no
    text — geometry only, so the card stays brand art like the hero."""
    import math
    draw.rectangle([x, y, x + w, y + h], fill=CANVAS)
    # faint field grid (only the structured half, faded)
    for gx in range(x + 48, x + 340, 48):
        draw.line([gx, y, gx, y + h], fill=LINE, width=1)
    for gy in range(y + 48, y + h, 48):
        draw.line([x, gy, x + w, gy], fill=LINE, width=1)
    # system plate (lower-left)
    px, py, pw, ph = x + 40, y + 250, 280, 280
    draw.rectangle([px, py, px + pw, py + ph], fill=SOFT)
    draw.rectangle([px, py, px + pw, py + ph], outline=LINE, width=1)
    for gx in range(px + 40, px + pw, 40):
        draw.line([gx, py, gx, py + ph], fill=LINE, width=1)
    for gy in range(py + 40, py + ph, 40):
        draw.line([px, gy, px + pw, gy], fill=LINE, width=1)
    # registered signals (axis-aligned squares on the grid; outline=0.0)
    cells = [
        (px + 20, py + 20, 1), (px + 100, py + 20, 0), (px + 180, py + 20, 1),
        (px + 260, py + 20, 0), (px + 20, py + 60, 0), (px + 140, py + 60, 1),
        (px + 60, py + 100, 0), (px + 180, py + 100, 1), (px + 260, py + 100, 1),
        (px + 100, py + 140, 0), (px + 20, py + 180, 0), (px + 140, py + 180, 1),
        (px + 260, py + 180, 0), (px + 60, py + 220, 1), (px + 180, py + 220, 0),
    ]
    for cx, cy, filled in cells:
        if filled:
            draw.rectangle([cx, cy, cx + 10, cy + 10], fill=INK)
        else:
            draw.rectangle([cx, cy, cx + 10, cy + 10], outline=INK, width=1)
    for cx, cy in [(px + 60, py + 100), (px + 140, py + 140), (px + 220, py + 180), (px + 180, py + 220)]:
        draw.rectangle([cx, cy, cx + 10, cy + 10], fill=GREEN)
    # queued at the plate's edge
    draw.rectangle([px + pw + 10, py + 120, px + pw + 20, py + 130], fill=INK)
    draw.rectangle([px + pw + 10, py + 160, px + pw + 20, py + 170], outline=INK, width=1)

    def rot_rect(cx, cy, s, ang):
        a = math.radians(ang)
        pts = []
        for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
            rx = dx * s / 2 * math.cos(a) - dy * s / 2 * math.sin(a)
            ry = dx * s / 2 * math.sin(a) + dy * s / 2 * math.cos(a)
            pts.append((cx + rx, cy + ry))
        return pts

    for cx, cy, s, ang, ink, op in [
        (x + 400, y + 60, 12, 22, INK, 0.7), (x + 470, y + 130, 12, -14, INK, 0.55),
        (x + 430, y + 210, 12, 28, INK, 0.6), (x + 490, y + 300, 14, 12, INK, 0.4),
        (x + 380, y + 100, 9, 30, INK, 0.45), (x + 500, y + 170, 9, 18, INK, 0.5),
    ]:
        draw.polygon(rot_rect(cx, cy, s, ang), fill=ink)
    for cx, cy, r, ink, op in [
        (x + 440, y + 50, 5, INK, 0.55), (x + 515, y + 250, 6, GREEN, 0.75),
        (x + 395, y + 180, 4, INK, 0.5), (x + 530, y + 60, 4, INK, 0.4),
    ]:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)
    a = math.radians(40)
    draw.line([x + 420, y + 140, x + 434, y + 140], fill=LINE_STRONG, width=2)
    draw.line([x + 427 - 7 * math.cos(a), y + 140 - 7 * math.sin(a), x + 427 + 7 * math.cos(a), y + 140 + 7 * math.sin(a)], fill=LINE_STRONG, width=2)
    a2 = math.radians(-25)
    draw.line([x + 470, y + 240, x + 482, y + 240], fill=LINE_STRONG, width=2)
    draw.line([x + 476 - 6 * math.cos(a2), y + 240 - 6 * math.sin(a2), x + 476 + 6 * math.cos(a2), y + 240 + 6 * math.sin(a2)], fill=LINE_STRONG, width=2)


def geometry_panel(draw, x, y, w, h, seed):
    """Quiet brand geometry panel: hairline grid + squares (blog cards)."""
    draw.rectangle([x, y, x + w, y + h], fill=SOFT)
    # hairline grid, 48px pitch — subtle, 1px, low contrast
    for gx in range(x + 48, x + w, 48):
        draw.line([gx, y, gx, y + h], fill=LINE, width=1)
    for gy in range(y + 48, y + h, 48):
        draw.line([x, gy, x + w, gy], fill=LINE, width=1)
    # a small filled square accent derived from the seed
    draw.rectangle([x + 48, y + 48, x + 48 + 14, y + 48 + 14], fill=PRIMARY)
    draw.rectangle([x + w - 62, y + h - 62, x + w - 48, y + h - 48], fill=PRIMARY)


def base_card(kicker):
    img = Image.new("RGB", (W, H), CANVAS)
    draw = ImageDraw.Draw(img)
    # NOVENO wordmark — brand geometry top-right (RTL lead), + green square
    rtl_text(draw, (W - 56, 44), "NOVENO", F_WORD, INK, anchor="ra")
    draw.rectangle([W - 56, 44 + 12, W - 56 + 10, 44 + 12 + 10], fill=PRIMARY)
    if kicker:
        rtl_text(draw, (W - 56, 128), kicker, F_KICKER, FAINT, anchor="ra")
    return img, draw


def footer(draw, note):
    rtl_text(draw, (W - 56, H - 44), f"noveno.ir  ·  {note}", F_FOOT, FAINT, anchor="ra")


def text_column(draw, title, body, title_font=None, chip=None, chip_fill=None,
                start_y=168):
    x = W - 56
    max_w = 560
    tf = title_font or F_TITLE
    lines = truncate_to_lines(draw, title, tf, max_w, 3)
    y = start_y
    for line in lines:
        rtl_text(draw, (x, y), line, tf, INK, anchor="ra")
        y += int(tf.size * 1.28)
    y += 6
    if body:
        for bline in wrap_text(draw, body, F_BODY, max_w)[:2]:
            rtl_text(draw, (x, y), bline, F_BODY, MUTED, anchor="ra")
            y += int(F_BODY.size * 1.5)
        y += 12
    if chip:
        cw = draw.textlength(chip, font=F_CHIP) + 48
        ch = 56
        draw.rounded_rectangle([x - cw, y, x, y + ch], radius=6, fill=chip_fill or PRIMARY)
        rtl_text(draw, (x - cw // 2, y + ch // 2), chip, F_CHIP,
                 ON_PRIMARY if chip_fill in (None, PRIMARY) else INK, anchor="mm")


# --------------------------------------------------------------------------
# Content inputs (frontmatter parsing — same files the build validates)
# --------------------------------------------------------------------------

def parse_fm(file):
    raw = open(file, encoding="utf-8").read()
    m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---", raw)
    if not m:
        return {}
    data = {}
    for line in m.group(1).splitlines():
        kv = re.match(r"^([a-z_]+):\s*(.*)$", line.strip())
        if kv:
            key, val = kv.groups()
            val = val.strip().strip('"')
            if val == "true":
                val = True
            elif val == "false":
                val = False
            data[key] = val
    return data


def work_entries():
    out = []
    for name in sorted(os.listdir(os.path.join(ROOT, "src", "content", "work"))):
        if not name.endswith(".md"):
            continue
        data = parse_fm(os.path.join(ROOT, "src", "content", "work", name))
        if data.get("draft"):
            continue  # drafts never get cards (parity with blog)
        slug = name[:-3]
        shot = os.path.join(ROOT, "assets", "images", "work", f"{slug}-hero.webp")
        out.append({
            "slug": slug,
            "title": data.get("title", slug),
            "type": data.get("type", "project"),
            "shot": shot if os.path.exists(shot) else None,
        })
    return out


def blog_entries():
    out = []
    for name in sorted(os.listdir(os.path.join(ROOT, "src", "content", "blog"))):
        if not name.endswith(".md"):
            continue
        data = parse_fm(os.path.join(ROOT, "src", "content", "blog", name))
        if data.get("draft"):
            continue  # drafts never get cards
        out.append({
            "slug": name[:-3],
            "title": data.get("title", name[:-3]),
            "category": data.get("category", "وبلاگ"),
        })
    return out


def prune_stale_cards(entries, kind):
    """Remove cards whose content no longer exists or is no longer published
    (e.g. an article flipped to draft) so the og/ tree never accumulates
    dead weight."""
    dir_path = os.path.join(OUT_DIR, kind)
    if not os.path.isdir(dir_path):
        return
    live = {e["slug"] for e in entries}
    for name in os.listdir(dir_path):
        if name.endswith(".png") and name[:-4] not in live:
            os.remove(os.path.join(dir_path, name))
            print(f"  pruned stale card: og/{kind}/{name}")


PROOF_LABEL = {"case-study": "مطالعه موردی", "project": "پروژه", "concept": "نمونه نمایشی — سناریوی مفهومی"}


def hero_headline():
    src = open(os.path.join(ROOT, "src", "data", "site.ts"), encoding="utf-8").read()
    m = re.search(r'HERO_HEADLINE\s*=\s*"([^"]+)"', src)
    return m.group(1) if m else "بازدید را به یک مسیر قابل‌پیگیری برای جذب مشتری تبدیل کنید."


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, "work"), exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, "blog"), exist_ok=True)
    made = []

    # --- homepage / default card: the brand signal-field artwork ---------
    img, draw = base_card("سیستم جذب مشتری برای کسب‌وکارهای خدماتی")
    signal_panel(draw, 0, 0, 528, H)
    text_column(draw, hero_headline(), None,
                chip="درخواست بررسی مسیر جذب", start_y=200)
    footer(draw, "هنر نشانهٔ نوونو — از توجه پراکنده تا سامانهٔ منظم")
    img.save(os.path.join(ROOT, "public", "og.png"), "PNG")
    made.append("og.png")

    # --- about -------------------------------------------------------------
    img, draw = base_card("درباره نوونو")
    geometry_panel(draw, 0, 0, 400, H, 1)
    text_column(draw, "چرا نوونو وجود دارد، چه باوری دارد و چه کاری نمی‌کند",
                "مسئلهٔ کسب‌وکار قبل از فناوری؛ کوچک‌ترین سیستم قابل اعتماد؛ شواهد واقعی بر ادعا.",
                chip="خواندن دربارهٔ نوونو", start_y=200)
    footer(draw, "نوونو — سیستم جذب مشتری")
    img.save(os.path.join(OUT_DIR, "about.png"), "PNG")
    made.append("og/about.png")

    # --- work index --------------------------------------------------------
    entries = work_entries()
    featured = next((e for e in entries if e["slug"] == "noveno-website"), entries[0] if entries else None)
    img, draw = base_card("پروژه‌ها و نمونه‌کارها")
    if featured and featured["shot"]:
        cover_panel(featured["shot"], 528, H, img, draw, 0, 0)
    else:
        geometry_panel(draw, 0, 0, 528, H, 2)
    text_column(draw, "کارهایی که می‌سازیم — با برچسب صادقانه",
                "هر کاری یا واقعاً ساخته شده یا صریحاً «نمونه نمایشی» نام دارد.",
                chip="دیدن پروژه‌ها", start_y=200)
    footer(draw, "کارهای نوونو")
    img.save(os.path.join(OUT_DIR, "work.png"), "PNG")
    made.append("og/work.png")

    # --- per-work cards ------------------------------------------------------
    prune_stale_cards(entries, "work")
    for e in entries:
        img, draw = base_card(PROOF_LABEL.get(e["type"], "پروژه"))
        if e["shot"]:
            cover_panel(e["shot"], 528, H, img, draw, 0, 0)
        else:
            geometry_panel(draw, 0, 0, 528, H, 3)
        label = PROOF_LABEL.get(e["type"], "پروژه")
        text_column(draw, e["title"], None, title_font=F_TITLE_SMALL,
                    chip=label, chip_fill=PRIMARY, start_y=200)
        footer(draw, "کارهای نوونو")
        img.save(os.path.join(OUT_DIR, "work", f"{e['slug']}.png"), "PNG")
        made.append(f"og/work/{e['slug']}.png")

    # --- blog index ---------------------------------------------------------
    img, draw = base_card("نوونو · وبلاگ")
    geometry_panel(draw, 0, 0, 528, H, 4)
    text_column(draw, "وبلاگ نوونو",
                "جذب، پیگیری لید و ثبت درخواست برای کسب‌وکارهای خدماتی — بدون وعده و با روش.",
                chip="خواندن نوشته‌ها", start_y=200)
    footer(draw, "وبلاگ نوونو")
    img.save(os.path.join(OUT_DIR, "blog.png"), "PNG")
    made.append("og/blog.png")

    # --- per-article cards (published only) ------------------------------------
    blogs = blog_entries()
    prune_stale_cards(blogs, "blog")
    for a in blogs:
        img, draw = base_card(a["category"])
        geometry_panel(draw, 0, 0, 528, H, 5)
        text_column(draw, a["title"], None, title_font=F_TITLE_SMALL,
                    chip="خواندن نوشته", start_y=200)
        footer(draw, "وبلاگ نوونو")
        img.save(os.path.join(OUT_DIR, "blog", f"{a['slug']}.png"), "PNG")
        made.append(f"og/blog/{a['slug']}.png")

    total = sum(
        os.path.getsize(os.path.join(ROOT, "public", m if m == "og.png" else os.path.join("og", m.split("/", 1)[1])))
        for m in made
    )
    print(f"og cards: {len(made)} generated, {total // 1024} KB total")
    for m in made:
        print(f"  {m}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover
        print(f"og generation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
