# Noveno Blog — Publishing Guide (founder)

«وبلاگ» is Noveno's blog: `/blog` (index) and `/blog/[slug]` (articles). It is a
straightforward professional blog — Markdown-first, no CMS, no application-code
edits. Publishing a new article takes about five minutes and one command.

> Route history: the section previously lived at `/insights` («دیدگاه‌ها»).
> Those URLs now **permanently redirect (301) to `/blog`** via
> `public/_redirects`, article slugs map 1:1 (`/insights/example` →
> `/blog/example`), and `/blog` is the only canonical article route. Never
> reintroduce an `/insights` page — it would create duplicate-content SEO.

## The workflow (four steps)

1. **Create one content file** — copy an existing article as a template:

   ```bash
   cp src/content/blog/instagram-lead-tracking.md src/content/blog/my-article.md
   ```

   The filename becomes the URL slug: `my-article.md` → `/blog/my-article`.

2. **Fill the frontmatter** (the block between the `---` lines):

   ```yaml
   ---
   title: "عنوان نوشته — یک جملهٔ مشخص و جستجوپذیر"
   description: "یک تا دو جمله که دقیقاً می‌گوید نوشته چه مسئله‌ای را جواب می‌دهد (همان متا دیسکریپشن)."
   published_at: 2026-09-01
   author: "نوونو" # یا نام نویسندهٔ واقعی
   category: "پیگیری لید" # موضوع — قدرت «نوشته‌های هم‌موضوع» است
   draft: true # تا وقتی آمادهٔ انتشار نیستید true بماند
   tags: ["پیگیری لید", "ثبت درخواست"]
   # updated_at: 2026-09-05   # فقط وقتی مطلب واقعاً بازبینی شده
   # ogImage: "/og/blog/my-article.png"   # فقط اگر کارت اختصاصی می‌خواهید
   # canonical: "https://…"   # فقط اگر واقعاً نشانی دیگری مرجع است
   # heroImage: "work/noveno-website-audit.webp"   # فقط یک تصویر واقعی از محصول (پسوند الزامی)
   # heroImageAlt: "توضیح فارسی از تصویر"   # همراه heroImage اجباری است
   # heroImageCaption: "توضیح کوتاه زیر تصویر"
   ---
   ```

   Rules that matter:

   - `draft: true` → the article is **invisible everywhere**: not built, not in
     `/blog`, not in the sitemap, no social card. Nothing to clean up.
   - `title` and `description` must be unique and non-empty; `published_at`
     must be a real date; `category` is required (it powers related-article
     links). The build validates all of this and fails loudly otherwise.
   - Never invent numbers, clients, or testimonials. Metrics without real
     data are a publishing error, not a copy decision.
   - `heroImage` is **optional and rare**: only a real product surface that
     already exists in the image manifest (a real screenshot, never a stock
     photo or a render). The value is the manifest's logical path _with_
     extension; the build hashes it and serves the 720w partner via `srcset`.
     `heroImageAlt` is mandatory with it — the schema refuses the pair
     otherwise. Unknown keys degrade to a typographic article instead of a
     broken image.

3. **Write the Markdown body** — Persian, RTL is automatic. Supported:

   - headings `##` / `###` (semantic, one `#` only in the page title);
   - lists, `> blockquote`, tables (scrollable on mobile), `code`;
   - **no** hand-written image paths: `/images/...` never survives the build
     (only content-hashed copies ship), so a real product screenshot belongs
     in the `heroImage` frontmatter field and everything else belongs in the
     figures described below;
   - links to `/audit`, `/services`, other `/blog/...` articles — one
     contextual CTA at the end is enough; don't spam links.

   Structure that reads well and ranks: **useful answer first → practical
   framework → example → relevant Noveno next step**. Sell after answering,
   not before. Reading time is computed automatically from word count and
   shown on the article and index.

   **No thumbnails required.** Blog previews are typography-first (category,
   date, title, description). Only add an image when the article genuinely
   has one — never insert stock photography for decoration.

### Figures inside an article (`.fig` / `.mock`)

Long articles carry their own visual material, written as a few lines of
**semantic HTML in the Markdown body** using the classes defined in
`src/styles/global.css` (search for «Article figures»). Start every figure
with `<!-- prettier-ignore -->` so the formatter never re-indents the block
into a code block.

```html
<!-- prettier-ignore -->
<figure class="fig">
<div class="fig-stage">
<span class="fig-tag">خلاصهٔ کوتاه</span>
<div class="fig-list">
<div class="fig-row"><span class="fig-key">منبع</span><span class="fig-val">اینستاگرام</span></div>
</div>
</div>
<figcaption class="fig-cap">یک جمله که بگوید این شکل چه چیزی را نشان می‌دهد.</figcaption>
</figure>
```

The available pieces are `.fig`, `.fig-stage` (+ `--soft`), `.fig-cols`,
`.fig-tag`, `.fig-list` / `.fig-row` / `.fig-key` / `.fig-val`, `.fig-num`,
`.fig-cap`, `.mock` (+ `.mock-head`, `.mock-title`, `.mock-lead`,
`.mock-actions`, `.mock-cta`, `--ghost`, `.mock-form`, `.mock-field`,
`.mock-block`) and `.fig-table`.

Rules for a figure (they are the site's visual contract, not style taste —
`docs/DESIGN.md` §3.1–§3.2/§4):

- **Real Persian labels**, not skeleton bars: the text inside a figure is
  text a reader can select, search and translate to speech.
- **Designed page mockups, editorial numerals, hairline geometry, real
  product surfaces.** Never stock photography, and never the
  line-diagram / node-and-connector grammar the founder rejected (§3.1) —
  express a sequence as `.fig-list` rows with `.fig-num`, not as a flow.
- **Teach something.** A figure that restates the paragraph above it is
  decoration; delete it. Media rhythm stays at ≈4–7 moments per article (§3.4).
- **Say when an example is invented.** Mockups are labelled «نمونهٔ
  نوشتاری» / «نمونهٔ ساختار» and fictional data says so in the caption.
  A real screenshot says what it is a capture of.
- Figures cost no request and reserve their own box, so they add no
  layout shift; that is why the article surface uses HTML/CSS mockups
  instead of image files.
- **Markdown is not processed inside an HTML block.** `[label](/url)` inside
  a figure renders as literal text — use `<a href="/url">label</a>`. The
  build gate fails on leaked Markdown link syntax in rendered HTML.

### In-page table of contents

Long articles may open with a «در این نوشته» list whose entries are
anchor links to the article's own `##` headings:

```markdown
- [جواب کوتاه](#جواب-کوتاه)
```

Astro derives heading ids by slugifying the heading text, so the anchor must
match the slugified heading exactly (`tests/blog.test.mjs` fails the build
when an in-article anchor does not resolve). Keep the list short: it is a
map, not a mirror of every heading.

### Links and measurement

In-body CTAs stay measurable by carrying the site's existing declarative
analytics attributes — no new vendor, no new event vocabulary:

```html
<a href="/audit" data-event="primary_cta_click" data-event-payload='{"section":"blog-article-diagnosis"}'
  >درخواست بررسی مسیر جذب</a
>
```

Link contextually (`/services`, `/pricing`, `/process`, `/work`, and other
articles) with descriptive anchors, and keep conversion moments rare: one
contextual CTA after the reader has diagnosed something, at most one more
near the relevant section, and one final CTA. The article template already
renders a tracked CTA at the end of every article — that is the third one.

### Market numbers and other checkable claims

When an article quotes a price, a benchmark or a regulation: name the
source, date it, and separate **«قیمت اعلامی»** from **«تعرفهٔ رسمی»** —
no Iranian market rate exists, and a table of examples is not an average.
Never quote a Noveno price in an article: link `/pricing` so the number the
reader sees is always the current one.

4. **Build and publish**:

   A new article gets its social card rendered **locally** (Python + Pillow
   — see below) before the build; Cloudflare Pages never renders cards:

   ```bash
   npm run generate:og   # render social cards for NEW/changed articles (local)
   npm run build         # validates content + committed OG cards; regenerates sitemap, image hashes
   git add src/content/blog/my-article.md public/og/blog/my-article.png
   git commit -m "feat(blog): publish …"
   git push              # Cloudflare Pages deploys automatically
   ```

   First time on a machine? Run `python3 -m pip install -r requirements-og.txt`; `generate:og` preflights everything else.

   Or use the single helper that does the first two steps:
   `npm run build:with-og`.

   Set `draft: false` in the same edit when the article is ready.

   > **Social cards are generated locally and committed.**
   > `scripts/generate-og-images.py` needs Python + Pillow + raqm and runs
   > only via `npm run generate:og` on your machine. The production
   > `prebuild` **validates** the committed cards
   > (`scripts/validate-og-assets.mjs`, Node — no extra dependencies) and
   > fails the build if a required card is missing or not a 1200×630 PNG.
   > Cloudflare Pages does **not** regenerate OG cards — it deploys the
   > committed ones. A draft article (`draft: true`) never needs a card.

## What happens automatically on every build

| Step          | What runs                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prebuild`    | image manifest (hashed URLs), **validation of the committed social cards** (`scripts/validate-og-assets.mjs` — every published article must have a 1200×630 PNG card; drafts are excluded), **sitemap** (`scripts/generate-sitemap.mjs` — drafts excluded). Cards themselves are **not** rendered on Cloudflare — see the note above. |
| `astro build` | static pages; drafts are never generated; RSS feed `/rss.xml` rebuilt                                                                                                                                                                                                                                                                 |
| Feed          | `https://noveno.ir/rss.xml` — rebuilt with `npm run build`; draft articles excluded                                                                                                                                                                                                                                                   |
| article page  | canonical `/blog/[slug]`, `og:type=article`, Article JSON-LD (title, dates, author, publisher), breadcrumbs (خانه / وبلاگ / عنوان), related-by-category + previous/next navigation, contextual audit CTA                                                                                                                              |
| `/blog`       | newest article featured first; chronological list; index updates automatically                                                                                                                                                                                                                                                        |

## Editing an existing article

- Fix a typo → edit + rebuild + push. No date change needed.
- Material rewrite → set `updated_at` (shown as «آخرین بازبینی» and used as
  sitemap `lastmod`).
- Unpublish → set `draft: true` (or delete the file); the old URL 404s.

## Content policy (keep the bar high)

- Subjects stay inside Noveno's domain: جذب مشتری برای کسب‌وکارهای خدماتی،
  پیگیری لید، ثبت درخواست، فرم جذب، دایرکت، attribution، CRM در برابر سیستم
  ساده، نرخ تبدیل صفحات خدمات، اندازه‌گیری برای کسب‌وکار کوچک، منبع مشتری،
  مسیر مشتری، سیستم‌های ساده پیگیری.
- No AI-news, no generic marketing news, no content-farm filler, no startup
  news. One strong article a month beats ten thin ones.
- No fabricated authors, metrics, clients, or testimonials. Author default is
  «نوونو» (the publisher) — use a real name only for real authors.
- Tag pages are intentionally not generated; category is the only taxonomy.
  No thin category pages.

## Verification

The gate enforces the publishing contract mechanically:

- `tests/blog.test.mjs` — metadata completeness, no future dates, no
  duplicate titles/descriptions, no keyword-stuffed titles, body length floor;
- `tests/seo-contract.test.mjs` — drafts never build/never enter the sitemap,
  article schema + canonical + og:type, per-page social cards exist, the
  `/insights` → `/blog` 301 redirects are in place, no `/insights` pages build;
- `tests/structural.test.mjs` — blog pages in the structural page list.
