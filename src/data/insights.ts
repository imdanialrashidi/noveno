/**
 * Insights helpers — shared editorial logic for the /insights section.
 * Draft filtering lives in exactly one place so the index, article
 * pages, and internal recommendations can never disagree about what
 * is published (draft articles must never reach production pages).
 */

import type { CollectionEntry } from "astro:content";

export type InsightsEntry = CollectionEntry<"insights">;

/** Published = not draft. The only gate between content and the public site. */
export function isPublished(entry: InsightsEntry): boolean {
  return !entry.data.draft;
}

/** Newest first; never reorders drafts (they are filtered before this). */
export function sortByDate(entries: InsightsEntry[]): InsightsEntry[] {
  return [...entries].sort(
    (a, b) => b.data.published_at.valueOf() - a.data.published_at.valueOf(),
  );
}

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

/**
 * Related articles by topic: same category, newest first, excluding the
 * current article, capped at `limit`. Returns [] when there is no real
 * related content — never fabricates recommendations.
 */
export function relatedEntries(
  all: InsightsEntry[],
  current: InsightsEntry,
  limit = 2,
): InsightsEntry[] {
  return sortByDate(
    all.filter((entry) => isPublished(entry) && entry.id !== current.id && entry.data.category === current.data.category),
  ).slice(0, limit);
}

/** Chronological neighbours for previous/next navigation (by published date). */
export function neighbours(
  all: InsightsEntry[],
  current: InsightsEntry,
): { older: InsightsEntry | null; newer: InsightsEntry | null } {
  const sorted = sortByDate(all.filter((entry) => isPublished(entry)));
  const index = sorted.findIndex((entry) => entry.id === current.id);
  if (index === -1) return { older: null, newer: null };
  return {
    older: sorted[index + 1] ?? null, // published before → «نوشتهٔ قبلی»
    newer: sorted[index - 1] ?? null, // published after → «نوشتهٔ بعدی»
  };
}
