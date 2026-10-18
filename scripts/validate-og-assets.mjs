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
 *   - one card per PUBLISHED work entry  public/og/work/{slug}.png
 *                                 (draft: true skipped — same gate as pages)
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
import { isAbsolute, join, relative, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const REQUIRED_W = 1200;
const REQUIRED_H = 630;

import { contentEntries, parseFrontmatterFile, requiredCards as requiredCardsFromScan } from "./lib/published-scan.mjs";

/** Minimal frontmatter parse — the shared published-scan parser. */
function parseFrontmatter(file) {
  return parseFrontmatterFile(file, (src) => {
    // Hand-rolled line parse kept for dependency-free gating (no yaml dep):
    // [a-zA-Z_] so camelCase schema keys like `ogImage` are read too.
    const data = {};
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, "utf8"));
    if (!match) return {};
    for (const line of match[1].split(/\r?\n/)) {
      const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const value = kv[2].trim().replace(/^"|"$/g, "");
      data[kv[1]] = value === "true" ? true : value === "false" ? false : value;
    }
    return data;
  });
}

/**
 * The cards the site requires — resolved through the shared scan module
 * (same draft gate + cardFor default the pages apply).
 */
function requiredCards() {
  const contentBase = join(ROOT, "src", "content");
  const work = contentEntries(contentBase, "work", (src) => {
    const data = {};
    for (const line of src.split(/\r?\n/)) {
      const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const value = kv[2].trim().replace(/^"|"$/g, "");
      data[kv[1]] = value === "true" ? true : value === "false" ? false : value;
    }
    return data;
  }, { skipDrafts: true });
  // OG_ASSETS_BLOG_DIR lets tests point the gate at a throwaway fixture
  // directory so temp entries never race other suites that read
  // src/content/blog (node --test runs test files concurrently).
  const blogBase = process.env.OG_ASSETS_BLOG_DIR
    ? resolve(process.env.OG_ASSETS_BLOG_DIR)
    : join(ROOT, "src", "content", "blog");
  const blogFiles = [];
  for (const name of readdirSync(blogBase).filter((f) => f.endsWith(".md"))) {
    blogFiles.push({ slug: name.slice(0, -3), data: parseFrontmatter(join(blogBase, name)) });
  }
  return requiredCardsFromScan(work, blogFiles);
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
  console.error("Regenerate missing/changed cards locally with `npm run generate:og`, then commit them:");
  console.error("  npm run generate:og && npm run build");
  process.exit(1);
}

console.log(`og assets: ${cards.length} social cards validated (${REQUIRED_W}×${REQUIRED_H} PNG)`);
