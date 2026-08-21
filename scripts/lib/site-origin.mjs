/** Canonical public origin fallback when PUBLIC_APP_URL is unset.
 *  Consumed by astro.config.mjs (Astro `site`), generate-sitemap.mjs, and rss.xml.ts.
 *  A domain change edits exactly this line. */
export const FALLBACK_SITE_ORIGIN = "https://noveno.ir";
