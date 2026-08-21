# Plan 029: Add RSS feed for /blog (وبلاگ) — D-02

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- src/pages/blog/ src/content.config.ts astro.config.mjs public/sitemap.xml src/data/blog.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction / docs+perf
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`/blog` (canonical after `public/_redirects` 301 from `/insights`) is the only editorial surface (`docs/PRODUCT.md` non-goals, `docs/BLOG.md` policy). It has a sitemap (`scripts/generate-sitemap.mjs`) and per-page OG cards (`scripts/generate-og-images.py`), but no `feed.xml` / `rss.xml`. For a Persian SMB blog, RSS is low urgency, but it's the cheapest adjacent surface (~30 LOC), makes the editorial surface complete (readers + automation can subscribe without scraping `/blog`), and is one interface away — Astro's `@astrojs/rss` is built for `astro:content` collections already defined at `src/content.config.ts:blog`.

Previously rejected in `plans/README.md` as "near-zero demand for a Persian SMB audience — not worth doing" — this plan revisits it now that `وبلاگ` is shipped and has at least one real post (`src/content/blog/instagram-lead-tracking.md`). It's gated: if the founder confirms no demand, REJECT with one line.

## Current state

Relevant files:
- `src/pages/blog/index.astro` — typography-first listing, `featured` + `rest`, draft-filtered
- `src/pages/blog/[slug].astro` — per-article page (not read yet, but follows `work` pattern)
- `src/content.config.ts` — `blog` collection with `title`, `description`, `published_at`, `category`, `tags`, `author`, `draft`
- `astro.config.mjs` — `site: process.env.PUBLIC_APP_URL ?? "https://noveno.ir"`, no RSS integration
- `public/sitemap.xml` — committed, validated by `scripts/validate-og-assets.mjs` + `scripts/generate-sitemap.mjs`
- `public/_redirects` — `/insights* → /blog*` 301s
- `src/data/blog.ts` — helpers `isPublished`, `sortByDate`, `formatFaDate`, `readingMinutes`

Excerpt — `src/content.config.ts:62-92` (`blog` schema):

```ts
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string().min(3).max(120),
    description: z.string().min(20).max(180),
    published_at: z.coerce.date(),
    updated_at: z.coerce.date().optional(),
    author: z.string().min(2).max(60).default("نوونو"),
    draft: z.boolean().default(false),
    category: z.string().min(2).max(40),
    tags: z.array(z.string().min(2).max(30)).default([]),
    ogImage: z.string().optional(),
    canonical: z.url().optional(),
  }),
});
```

Excerpt — `src/data/blog.ts` (helpers, to reuse):

```ts
export function isPublished(entry) { return !entry.data.draft; }
export function sortByDate(entries) { return entries.slice().sort((a,b) => b.data.published_at - a.data.published_at); }
```

Repo conventions:
- Content is Markdown-first (`src/content/blog/*.md`), no CMS. See `docs/BLOG.md` publishing guide.
- New route = new file under `src/pages/` — Astro static build emits `dist/<route>/index.html` or `dist/<route>.xml`. `GET` for `rss.xml` follows same pattern as `src/pages/blog/[slug].astro`.
- Sitemap/OG are committed and validated — RSS should be too (committed `dist/rss.xml` or `dist/feed.xml` after build, not runtime).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` (after adding `@astrojs/rss`) | exit 0 |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | 19+1 pages (new feed) |
| Tests | `npm test` | all pass (new feed test additive) |
| Local check | `curl -s http://localhost:4321/rss.xml \| head -20` | valid XML after `npm run dev` |

## Scope

**In scope** (only files you should modify):
- `src/pages/rss.xml.ts` (or `src/pages/feed.xml.ts` — pick one, document canonically; `rss.xml` is conventional) — feed endpoint using `@astrojs/rss`
- `package.json` — add ` @astrojs/rss` dep (check `astro 7` compatibility)
- `public/sitemap.xml` — ensure feed URL not listed (sitemap is for HTML pages only — or add if desired, but document choice)
- `src/pages/blog/index.astro` — add `<link rel="alternate" type="application/rss+xml" href="/rss.xml">` in `PageLayout` head (if `PageLayout.astro` exposes it) or via `BaseLayout` prop
- `tests/seo-contract.test.mjs` or `tests/blog.test.mjs` — pin feed exists, valid XML, draft excluded
- `docs/BLOG.md` — one line on `rss.xml`

**Out of scope** (do NOT touch):
- Changing `src/content.config.ts` blog schema
- Adding tag/category pages (thin taxonomy rule at `src/content.config.ts:88` — `tags` has no pages)
- JSON Feed or Atom alongside RSS (one feed only until demand)

## Git workflow

- Branch: `advisor/029-rss-feed`
- Commit per step; conventional commits (e.g., `feat(blog): add rss feed`)
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Install @astrojs/rss and create the feed endpoint

1. `npm install @astrojs/rss` (check that `astro 7.2.0` is compatible — `@astrojs/rss` is framework-agnostic; if `peerDependencies` warn, use `--legacy-peer-deps` and note).

2. Create `src/pages/rss.xml.ts`:

```ts
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { isPublished, sortByDate } from "../data/blog";

export async function GET(context) {
  const posts = sortByDate((await getCollection("blog")).filter(isPublished));
  return rss({
    title: "وبلاگ نوونو — نوشته‌هایی درباره جذب و پیگیری مشتری",
    description: "نوشته‌های کاربردی نوونو برای کسب‌وکارهای خدماتی: جذب مشتری، پیگیری لید، ثبت درخواست و تبدیل بازدید به درخواست — با مثال و بدون وعده تضمینی.",
    site: context.site ?? "https://noveno.ir",
    stylesheet: false, // or "/rss/styles.xsl" if you add one — don't
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.published_at,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
      link: `/blog/${post.id}/`,
    })),
    customData: `<language>fa</language>`,
  });
}
```

Use `context.site` from `astro.config.mjs: site` (respects `PUBLIC_APP_URL`). If `context.site` is `undefined` in dev, fallback to `https://noveno.ir` (Astro requires `site` for RSS).

3. Decide filename: `rss.xml.ts` → `dist/rss.xml` (conventional). If you prefer `feed.xml`, use `feed.xml.ts` → `dist/feed.xml` and keep only one. Document the choice.

**Verify**: `npm run check` → exit 0

### Step 2: Expose feed discovery on /blog

In `src/layouts/BaseLayout.astro` or `src/layouts/PageLayout.astro` (whichever owns `<head>`), add:

```html
<link rel="alternate" type="application/rss+xml" title="وبلاگ نوونو" href="/rss.xml" />
```

Only on `/blog` pages if the layout is per-page, or globally if the layout is shared — either is fine, but **one** discovery link is enough. Check `src/pages/blog/index.astro` already sets `PageLayout` `title`/`description` — the feed `<link>` belongs in the layout head, not in page body.

**Verify**: `npm run build && grep -n "rss.xml" dist/blog/index.html` → hit

### Step 3: Validate feed output

1. `npm run build && cat dist/rss.xml | head -30` — must be valid RSS 2.0 XML with `<?xml`, `<rss version="2.0">`, `<channel>`, `<language>fa</language>`, at least one `<item>` if a published post exists, no `<item>` for drafts.

2. Add a pin in `tests/blog.test.mjs` or `tests/seo-contract.test.mjs`:

```ts
test("rss feed exists, is valid XML, and excludes drafts", async () => {
  const feed = fs.readFileSync("dist/rss.xml", "utf8");
  assert.match(feed, /<rss[^>]*version="2.0"/);
  assert.match(feed, /<language>fa<\/language>/);
  // every published post has an item, no draft does
  const posts = (await getCollection("blog")).filter(isPublished);
  for (const p of posts) assert.ok(feed.includes(`/blog/${p.id}/`));
  const drafts = (await getCollection("blog")).filter(p => p.data.draft);
  for (const d of drafts) assert.ok(!feed.includes(`/blog/${d.id}/`));
});
```

Or a simpler file-exists check if you don't want to import `astro:content` in the test harness — just assert `dist/rss.xml` exists and contains `instagram-lead-tracking` (the one real post) and not a draft slug.

**Verify**: `npm test` → new test passes; `npm run build` → 19+1 files

### Step 4: Update docs and sitemap decision

1. `docs/BLOG.md` — add one line: "Feed: `https://noveno.ir/rss.xml` — rebuilt with `npm run build`."

2. Sitemap: `public/sitemap.xml` is for HTML pages — do **not** add `rss.xml` unless you decide to (document either way). If you add it, update `scripts/generate-sitemap.mjs` (or note that RSS is intentionally excluded — follow existing sitemap contract).

**Verify**: `bash scripts/project-verify.sh` (if exists) → no failures

## Test plan

- `rss feed exists and is valid XML` — new test, asserts `dist/rss.xml` exists, `version="2.0"`, `<language>fa</language>`, published slugs present, draft slugs absent.
- `rss discovery link on /blog` — `grep rss.xml dist/blog/index.html` hit.
- Regression: `npm test` all green, `npm run build` 19+1 pages (no dead links).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new test `rss feed exists` exists and passes
- [ ] `npm run build` produces `dist/rss.xml` (or `dist/feed.xml` — one canonical)
- [ ] `grep -rn "rss.xml" dist/blog/index.html` returns a hit (discovery link)
- [ ] `grep -rn "application/rss+xml" src/layouts/` or `src/pages/blog/index.astro` returns a hit
- [ ] No draft slug appears in `dist/rss.xml` (`grep draft-slug dist/rss.xml` empty)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- `astro.config.mjs: site` is required for `@astrojs/rss` and is `undefined` at build (your `GET(context)` fallback must cover dev; if prod `PUBLIC_APP_URL` is empty, the feed URL will be `https://noveno.ir` — that's fine, but document fallback)
- Adding `@astrojs/rss` forces a peer dep conflict with `astro 7.2.0` that `npm install` cannot resolve — report and pin version, don't force
- The project decides RSS is not worth doing (founder says no) — mark REJECTED with one-line rationale (same as original rejection) and stop
- `dist/rss.xml` is not emitted (Astro route not matched — check `src/pages/rss.xml.ts` vs `src/pages/rss.xml/index.ts` — file naming matters; `rss.xml.ts` with `GET` is correct, not a directory)

## Maintenance notes

- Reviewer should check that every new `src/content/blog/*.md` with `draft: false` automatically appears in the feed on next `npm run build` (no manual feed update).
- Keep `tags` thin — feed categories are `[category, ...tags]` today; if tags grow unbounded, limit to `category` only.
- If a feed XSL stylesheet is desired later, add `public/rss/styles.xsl` and set `stylesheet: "/rss/styles.xsl"` — don't add stylesheets in this plan.
