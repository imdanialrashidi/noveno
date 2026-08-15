# Noveno Insights — Publishing Guide (founder)

«دیدگاه‌ها» is the Insights section of the Noveno website: `/insights` (index)
and `/insights/[slug]` (articles). It is a Markdown-first publishing system —
no CMS, no application-code edits. Publishing a new article takes about
five minutes and one command.

## The workflow (four steps)

1. **Create one content file** — copy an existing article as a template:

   ```bash
   cp src/content/insights/instagram-lead-tracking.md src/content/insights/my-article.md
   ```

   The filename becomes the URL slug: `my-article.md` → `/insights/my-article`.

2. **Fill the frontmatter** (the block between the `---` lines):

   ```yaml
   ---
   title: "عنوان نوشته — یک جملهٔ مشخص و جستجوپذیر"
   description: "یک تا دو جمله که دقیقاً می‌گوید نوشته چه مسئله‌ای را جواب می‌دهد (همان متا دیسکریپشن)."
   published_at: 2026-08-20
   author: "نوونو"            # یا نام نویسندهٔ واقعی
   category: "پیگیری لید"      # موضوع — قدرت «نوشته‌های هم‌موضوع» است
   draft: true                # تا وقتی آمادهٔ انتشار نیستید true بماند
   tags: ["پیگیری لید", "ثبت درخواست"]
   # updated_at: 2026-08-25   # فقط وقتی مطلب واقعاً بازبینی شده
   # ogImage: "/og/insights/my-article.png"   # فقط اگر کارت اختصاصی می‌خواهید
   # canonical: "https://…"   # فقط اگر واقعاً نشانی دیگری مرجع است
   ---
   ```

   Rules that matter:

   - `draft: true` → the article is **invisible everywhere**: not built, not in
     `/insights`, not in the sitemap, no social card. Nothing to clean up.
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
   - links to `/audit`, `/services`, other `/insights/...` articles — one
     contextual CTA at the end is enough; don't spam links.

   Structure that reads well and ranks: **useful answer first → practical
   framework → example → relevant Noveno next step**. Sell after answering,
   not before.

4. **Build and publish**:

   ```bash
   npm run build      # validates content + regenerates sitemap, OG cards, image hashes
   git add src/content/insights/my-article.md
   git commit -m "feat(insights): publish …"
   git push           # Cloudflare Pages deploys automatically
   ```

   Set `draft: false` in the same edit when the article is ready.

## What happens automatically on every build

| Step | What runs |
|---|---|
| `prebuild` | image manifest (hashed URLs), **social cards** for every published article (`scripts/generate-og-images.py`), **sitemap** (`scripts/generate-sitemap.mjs` — drafts excluded) |
| `astro build` | static pages; drafts are never generated |
| article page | canonical, `og:type=article`, Article JSON-LD (title, dates, author, publisher), breadcrumbs, related-by-category + previous/next navigation, contextual audit CTA |
| `/insights` | newest article featured first; index updates automatically |

## Editing an existing article

- Fix a typo → edit + rebuild + push. No date change needed.
- Material rewrite → set `updated_at` (shown as «آخرین بازبینی» and used as
  sitemap `lastmod`).
- Unpublish → set `draft: true` (or delete the file); the old URL 404s.

## Content policy (keep the bar high)

- Subjects stay inside Noveno's domain: جذب مشتری برای کسب‌وکارهای خدماتی،
  پیگیری لید، ثبت درخواست، فرم جذب، دایرکت، attribution، CRM در برابر سیستم
  ساده، نرخ تبدیل صفحات خدمات، اندازه‌گیری برای کسب‌وکار کوچک.
- No AI-news, no generic marketing news, no content-farm filler. One strong
  article a month beats ten thin ones.
- No fabricated authors, metrics, clients, or testimonials. Author default is
  «نوونو» (the publisher) — use a real name only for real authors.
- Tag pages are intentionally not generated; category is the only taxonomy.

## Verification

The gate enforces the publishing contract mechanically:

- `tests/insights.test.mjs` — metadata completeness, no future dates, no
  duplicate titles/descriptions, no keyword-stuffed titles, body length floor;
- `tests/seo-contract.test.mjs` — drafts never build/never enter the sitemap,
  article schema + canonical + og:type, per-page social cards exist;
- `tests/structural.test.mjs` — insights pages in the structural page list.
