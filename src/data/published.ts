/**
 * Published set — the deep module behind the "what ships?" seam.
 *
 * One interface defines the published collections: draft gating, newest-first
 * ordering, featured-first work ordering, related/neighbour resolution, and
 * social-card resolution (ogImage default + override). Pages, RSS, the
 * sitemap generator, and the OG validator all import from this module —
 * per-page inline filters and per-script frontmatter parsers become
 * callers with leverage from one implementation.
 *
 * Two entry flavors, one seam: Astro collection entries (pages/RSS, rich
 * typed objects) and raw frontmatter records (Node scripts, which must
 * stay free of the Astro content layer). Both cross the same gate names.
 */

// Script-side filesystem access only — pages/RSS import the pure
// collection helpers above; scripts import the file helpers below.

export interface PublishableEntry {
  id: string;
  data: {
    draft?: boolean;
    featured?: boolean;
    type?: string;
    published_at?: Date | string;
    updated_at?: Date | string;
    category?: string;
    ogImage?: string;
    title?: string;
  };
}

/** Published = not draft. The only gate between content and the public site. */
export function isPublished(entry: Pick<PublishableEntry, "data">): boolean {
  return !entry.data.draft;
}

function publishedAtOf(entry: PublishableEntry): number {
  const raw = entry.data.published_at;
  if (raw instanceof Date) return raw.valueOf();
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Newest first; never reorders drafts (they are filtered before this). */
export function sortByDate<T extends PublishableEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => publishedAtOf(b) - publishedAtOf(a));
}

/**
 * Work ordering: featured first, then newest. The order the /work index,
 * the homepage proof section, and the thank-you pointer all share.
 */
export function sortWork<T extends PublishableEntry>(entries: T[]): T[] {
  const published = entries.filter(isPublished);
  return published.sort((a, b) => {
    if (a.data.featured !== b.data.featured) return a.data.featured ? -1 : 1;
    return publishedAtOf(b) - publishedAtOf(a);
  });
}

/** Non-concept work (proof pointer candidates), featured first. */
export function realWork<T extends PublishableEntry>(entries: T[]): T[] {
  return sortWork(entries).filter((entry) => entry.data.type !== "concept");
}

export function publishedWork<T extends PublishableEntry>(entries: T[]): T[] {
  return sortWork(entries.filter(isPublished));
}

export function publishedBlog<T extends PublishableEntry>(entries: T[]): T[] {
  return sortByDate(entries.filter(isPublished));
}

/**
 * Related articles by topic: same category, newest first, excluding the
 * current article, capped at `limit`. Returns [] when there is no real
 * related content — never fabricates recommendations.
 */
export function relatedEntries<T extends PublishableEntry>(
  all: T[],
  current: T,
  limit = 2,
): T[] {
  return sortByDate(
    all.filter(
      (entry) =>
        isPublished(entry) && entry.id !== current.id && entry.data.category === current.data.category,
    ),
  ).slice(0, limit);
}

/** Chronological neighbours for previous/next navigation (by published date). */
export function neighbours<T extends PublishableEntry>(
  all: T[],
  current: T,
): { older: T | null; newer: T | null } {
  const sorted = sortByDate(all.filter((entry) => isPublished(entry)));
  const index = sorted.findIndex((entry) => entry.id === current.id);
  if (index === -1) return { older: null, newer: null };
  return {
    older: sorted[index + 1] ?? null,
    newer: sorted[index - 1] ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Social-card resolution — one default, honoured everywhere            */
/* ------------------------------------------------------------------ */

/** Default social card for a published entry: `ogImage ?? og/{kind}/{slug}.png`. */
export function cardFor(kind: "work" | "blog", slug: string, ogImage?: string): string {
  if (typeof ogImage === "string" && ogImage !== "") return ogImage;
  return `/og/${kind}/${slug}.png`;
}

/** Whether an ogImage value is a repo-committed card (vs external URL). */
export function isCommittedCard(ogImage: string): boolean {
  if (!ogImage) return false;
  if (/^https?:\/\//i.test(ogImage)) return false;
  return true;
}
