/**
 * Blog helpers — presentation logic for the /blog section (وبلاگ نوونو).
 *
 * Published-set mechanics (draft gate, ordering, related, neighbours)
 * live behind the published module's seam; this module keeps only
 * blog-presentation helpers (Persian dates, reading time, cover dims).
 * Draft filtering lives in exactly one place so the index, article
 * pages, and internal recommendations can never disagree about what
 * is published (draft articles must never reach production pages).
 */

import type { CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;

export { isPublished, neighbours, publishedBlog, relatedEntries, sortByDate } from "./published.ts";

/** Editorial Persian date — «۱۴ شهریور ۱۴۰۵» style (no invented precision). */
export function formatFaDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Short month-year for index rows — «شهریور ۱۴۰۵». */
export function formatFaMonth(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long" }).format(date);
}

/**
 * Reading-time estimate from the raw body — a factual estimate, not a
 * claim. Persian reading ≈ 120 wpm; conservative ~110 for joined text.
 */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 110));
}

/* ------------------------------------------------------------------ */
/* Article cover — a real product surface, never decoration            */
/* ------------------------------------------------------------------ */

/**
 * Intrinsic pixel size of every cover the blog may reference. Explicit on
 * purpose: only real product surfaces are allowed here (docs/IMAGERY.md),
 * and their capture size is known, so nothing has to be guessed at runtime.
 *
 * This module stays free of the generated image manifest (the `.astro` page
 * resolves the hashed URLs) so it stays importable from plain Node tests.
 */
const HERO_IMAGE_DIMS: Record<string, { width: number; height: number }> = {
  // 1440×900 capture of this site's own /audit form (docs/IMAGERY.md —
  // real product surface, product 16:10 stage).
  "work/noveno-website-audit.webp": { width: 1440, height: 900 },
};

/**
 * Validate a frontmatter `heroImage` value and return its intrinsic size.
 * The key is the same logical path the image manifest uses (WITH extension),
 * so the page can hash it like every other public image. An unknown key
 * returns null, degrading to a typographic article (the blog's normal state)
 * instead of shipping a broken image.
 */
export function heroImageDims(key: string | undefined): { width: number; height: number } | null {
  if (!key || !key.endsWith(".webp")) return null;
  return HERO_IMAGE_DIMS[key] ?? null;
}
