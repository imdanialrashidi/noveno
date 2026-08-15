#!/usr/bin/env node
/**
 * Validate the committed OG / social-card asset set (prebuild).
 *
 * Social cards are intentionally local build-tooling output: the founder
 * renders them on a machine with Python + Pillow + raqm
 * (`npm run generate:og` → scripts/generate-og-images.py) and COMMITS the
 * PNGs under public/og/. Cloudflare Pages must be able to build an
 * unchanged static site without any image-generation tooling, so the
 * normal production build does not render cards — it VERIFIES the
 * committed set instead.
 *
 * This script is the dependency-free Node gate for that contract:
 *
 *   - the default homepage card  public/og.png
 *   - the fixed per-page cards    public/og/about.png, og/work.png,
 *                                 og/blog.png (one per page that sets a
 *                                 dedicated ogImage — mirrors src/pages)
 *   - one card per WORK entry     public/og/work/{slug}.png
 *                                 (the work collection has no draft gate)
 *   - one card per PUBLISHED blog article  public/og/blog/{slug}.png
 *                                 (draft: true articles never get a card;
 *                                  a frontmatter ogImage override is
 *                                  validated in its place, matching what
 *                                  the article page actually references)
 *
 * Every required card must exist, carry the PNG signature, and be exactly
 * 1200×630 (the social-card size social crawlers expect). Any failure
 * exits non-zero with a clear message so a missing card can never reach
 * production silently.
 *
 * Usage: node scripts/validate-og-assets.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const REQUIRED_W = 1200;
const REQUIRED_H = 630;

/** Minimal frontmatter parse (same shape the sitemap generator uses). */
function parseFrontmatter(file) {
  const raw = readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    // [a-zA-Z_] so camelCase schema keys like `ogImage` are read too (the
    // sitemap generator only needs lowercase keys and keeps [a-z_]).
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim().replace(/^"|"$/g, "");
    data[key] = value === "true" ? true : value === "false" ? false : value;
  }
  return data;
}

/** Slugs of the content collection, optionally gated by draft. */
function contentSlugs(dir, { skipDrafts }) {
  const base = join(ROOT, "src", "content", dir);
  const slugs = [];
  for (const name of readdirSync(base).filter((f) => f.endsWith(".md"))) {
    const data = parseFrontmatter(join(base, name));
    if (skipDrafts && data.draft) continue;
    slugs.push(name.slice(0, -3));
  }
  return slugs.sort();
}

/**
 * The cards the site requires. Entries mirror the ogImage values in
 * src/pages (index → /og.png default; about, work index, work item,
 * blog index, blog article each set a dedicated card).
 */
function requiredCards() {
  const cards = [
    { rel: "og.png", why: "default / homepage card (BaseLayout fallback)" },
    { rel: "og/about.png", why: "/about page card" },
    { rel: "og/work.png", why: "/work index card" },
    { rel: "og/blog.png", why: "/blog index card" },
  ];
  for (const slug of contentSlugs("work", { skipDrafts: false })) {
    cards.push({ rel: `og/work/${slug}.png`, why: `work entry \`${slug}\`` });
  }
  const blogBase = join(ROOT, "src", "content", "blog");
  for (const name of readdirSync(blogBase).filter((f) => f.endsWith(".md"))) {
    const slug = name.slice(0, -3);
    const data = parseFrontmatter(join(blogBase, name));
    if (data.draft) continue; // drafts never get a social card
    // Match blog/[slug].astro exactly: `data.ogImage ?? /og/blog/{slug}.png`.
    //   "/og/blog/x.png"          → committed repo card → validate it
    //   "og/blog/x.png" (relative) → resolves against the site origin to the
    //     same public path → validate it as a committed repo card
    //   "https://cdn.example/.."  → external asset, not committed here → skip
    if (typeof data.ogImage === "string" && data.ogImage !== "") {
      if (/^https?:\/\//i.test(data.ogImage)) {
        // external URL — nothing to validate in this repo
      } else {
        cards.push({
          rel: data.ogImage.replace(/^\/+/, ""),
          why: `published article \`${slug}\` ogImage override`,
        });
      }
    } else if (!data.ogImage) {
      cards.push({ rel: `og/blog/${slug}.png`, why: `published article \`${slug}\`` });
    }
  }
  return cards;
}

/** Full path of a public/rel asset; null when it escapes public/. */
function publicPath(rel) {
  const abs = join(PUBLIC, rel);
  const relToPublic = relative(PUBLIC, abs);
  return relToPublic.startsWith("..") || isAbsolute(relToPublic) ? null : abs;
}

function validateCard(card) {
  const abs = publicPath(card.rel);
  if (!abs || !existsSync(abs)) {
    return `missing required social card public/${card.rel} (${card.why})`;
  }
  const buf = readFileSync(abs);
  // PNG signature + IHDR chunk (8-byte sig + 4 len + 4 "IHDR" + 13 data).
  if (buf.length < 33 || buf.subarray(1, 4).toString() !== "PNG") {
    return `public/${card.rel} is not a PNG (${card.why})`;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== REQUIRED_W || height !== REQUIRED_H) {
    return `public/${card.rel} is ${width}×${height}, expected ${REQUIRED_W}×${REQUIRED_H} (${card.why})`;
  }
  return null;
}

const cards = requiredCards();
const failures = [];
for (const card of cards) {
  const error = validateCard(card);
  if (error) failures.push(error);
}

if (failures.length > 0) {
  console.error("og asset validation failed:");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(
    "Regenerate missing/changed cards locally with `npm run generate:og`, then commit them:",
  );
  console.error("  npm run generate:og && npm run build");
  process.exit(1);
}

console.log(`og assets: ${cards.length} social cards validated (${REQUIRED_W}×${REQUIRED_H} PNG)`);
