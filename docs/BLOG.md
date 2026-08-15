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
   author: "نوونو"            # یا نام نویسندهٔ واقعی
   category: "پیگیری لید"      # موضوع — قدرت «نوشته‌های هم‌موضوع» است
   draft: true                # تا وقتی آمادهٔ انتشار نیستید true بماند
   tags: ["پیگیری لید", "ثبت درخواست"]
   # updated_at: 2026-09-05   # فقط وقتی مطلب واقعاً بازبینی شده
   # ogImage: "/og/blog/my-article.png"   # فقط اگر کارت اختصاصی می‌خواهید
   # canonical: "https://…"   # فقط اگر واقعاً نشانی دیگری مرجع است
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

3. **Write the Markdown body** — Persian, RTL is automatic. Supported:

   - headings `##` / `###` (semantic, one `#` only in the page title);
   - lists, `> blockquote`, tables (scrollable on mobile), `code`;
   - images with meaningful Persian `alt` (screenshots should be real product
     surfaces — see `docs/IMAGERY.md`); a short caption line under the image
     renders as a quiet note;
   - links to `/audit`, `/services`, other `/blog/...` articles — one
     contextual CTA at the end is enough; don't spam links.

   Structure that reads well and ranks: **useful answer first → practical
   framework → example → relevant Noveno next step**. Sell after answering,
   not before. Reading time is computed automatically from word count and
   shown on the article and index.

   **No thumbnails required.** Blog previews are typography-first (category,
   date, title, description). Only add an image when the article genuinely
   has one — never insert stock photography for decoration.

4. **Build and publish**:

   ```bash
   npm run build      # validates content + regenerates sitemap, OG cards, image hashes
   git add src/content/blog/my-article.md
   git commit -m "feat(blog): publish …"
   git push           # Cloudflare Pages deploys automatically
   ```

   Set `draft: false` in the same edit when the article is ready.

## What happens automatically on every build

| Step | What runs |
|---|---|
| `prebuild` | image manifest (hashed URLs), **social cards** for every published article (`scripts/generate-og-images.py`), **sitemap** (`scripts/generate-sitemap.mjs` — drafts excluded) |
| `astro build` | static pages; drafts are never generated |
| article page | canonical `/blog/[slug]`, `og:type=article`, Article JSON-LD (title, dates, author, publisher), breadcrumbs (خانه / وبلاگ / عنوان), related-by-category + previous/next navigation, contextual audit CTA |
| `/blog` | newest article featured first; chronological list; index updates automatically |

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
