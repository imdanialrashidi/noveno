#!/usr/bin/env node
/**
 * Published-set scan for Node scripts — the filesystem side of the
 * published seam. The contract (draft gate, ordering, card resolution)
 * lives in src/data/published.ts; this module only reads slugs +
 * frontmatter from disk so the sitemap generator and the OG validator
 * share one parser and one required-card list instead of three dialects.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Minimal frontmatter parse — the only parser the build trusts. */
export function parseFrontmatterFile(file, yamlParse) {
  const raw = readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return {};
  const data = yamlParse(match[1]);
  return data && typeof data === "object" ? data : {};
}

/** Slugs + frontmatter for a content dir, optionally gated by the draft rule pages use. */
export function contentEntries(contentBase, dir, yamlParse, options) {
  const base = join(contentBase, dir);
  const entries = [];
  for (const name of readdirSync(base).filter((f) => f.endsWith(".md"))) {
    const data = parseFrontmatterFile(join(base, name), yamlParse);
    if (options?.skipDrafts && data.draft) continue;
    entries.push({ slug: name.slice(0, -3), data });
  }
  return entries.sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

/**
 * Default social card for a published entry: `ogImage ?? og/{kind}/{slug}.png`.
 * Mirrors cardFor() in src/data/published.ts (kept string-trivial so
 * scripts never import the browser module graph).
 */
export function cardFor(kind, slug, ogImage) {
  if (typeof ogImage === "string" && ogImage !== "") return ogImage;
  return `/og/${kind}/${slug}.png`;
}

/** Whether an ogImage value is a repo-committed card (vs external URL). */
export function isCommittedCard(ogImage) {
  if (!ogImage) return false;
  if (/^https?:\/\//i.test(ogImage)) return false;
  return true;
}

/**
 * The social cards the site requires — resolved through cardFor, the same
 * default the article page applies.
 */
export function requiredCards(work, blogFiles) {
  const cards = [
    { rel: "og.png", why: "default / homepage card (BaseLayout fallback)" },
    { rel: "og/about.png", why: "/about page card" },
    { rel: "og/work.png", why: "/work index card" },
    { rel: "og/blog.png", why: "/blog index card" },
  ];
  for (const { slug } of work.filter(({ data }) => !data.draft)) {
    cards.push({ rel: `og/work/${slug}.png`, why: `work entry \`${slug}\`` });
  }
  for (const { slug, data } of blogFiles) {
    if (data.draft) continue;
    const resolved = cardFor("blog", slug, typeof data.ogImage === "string" ? data.ogImage : undefined);
    if (!isCommittedCard(resolved)) continue;
    cards.push({ rel: resolved.replace(/^\/+/, ""), why: `published article \`${slug}\`` });
  }
  return cards;
}
