#!/usr/bin/env node
/**
 * Route inventory — the deep module behind the "what routes exist?" seam.
 *
 * One interface defines the static route table (path → changefreq,
 * priority, lastmod) DERIVED from the src/pages filesystem: every
 * top-level page plus the two collection indexes, minus 404, minus
 * noindex utility routes (thank-you). The sitemap generator, the Astro
 * config's prerender list, and the route tests all import this table —
 * the filesystem is scanned once, the array is never hand-edited, and
 * the committed sitemap.xml is output, not a source.
 */
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Sitemap metadata per static route (product-owned cadence, not guesswork). */
const ROUTE_META = {
  "/": { changefreq: "monthly", priority: "1.0" },
  "/audit": { changefreq: "monthly", priority: "0.9" },
  "/services": { changefreq: "monthly", priority: "0.8" },
  "/pricing": { changefreq: "monthly", priority: "0.9" },
  "/work": { changefreq: "weekly", priority: "0.8" },
  "/blog": { changefreq: "weekly", priority: "0.8" },
  "/process": { changefreq: "monthly", priority: "0.8" },
  "/about": { changefreq: "yearly", priority: "0.7" },
  "/contact": { changefreq: "yearly", priority: "0.7" },
  "/privacy": { changefreq: "yearly", priority: "0.3" },
  "/terms": { changefreq: "yearly", priority: "0.3" },
};

/** Routes the filesystem provides but the public index must not list. */
const UNLISTED = new Set(["/404", "/audit/thank-you"]);

/** Fixed lastmod for static pages (the product-led pass date). */
export const STATIC_LASTMOD = "2026-10-01";

/**
 * Derive the static route table from the pages directory. A top-level
 * `foo.astro` (or `foo/index.astro`) yields `/foo`; `index.astro` yields
 * `/`. Collection slugs (`[slug]`) contribute their index only.
 */
export function staticRoutes(pagesDir) {
  const routes = [];
  const top = readdirSync(pagesDir, { withFileTypes: true });
  for (const entry of top) {
    if (entry.isFile() && entry.name.endsWith(".astro")) {
      const base = entry.name.slice(0, -6);
      const path = base === "index" ? "/" : `/${base}`;
      if (UNLISTED.has(path)) continue;
      const meta = ROUTE_META[path];
      if (!meta) continue;
      routes.push({ path, ...meta, lastmod: STATIC_LASTMOD });
    } else if (entry.isDirectory()) {
      const indexFile = join(pagesDir, entry.name, "index.astro");
      const path = `/${entry.name}`;
      if (existsSync(indexFile) && ROUTE_META[path] && !UNLISTED.has(path)) {
        routes.push({ path, ...ROUTE_META[path], lastmod: STATIC_LASTMOD });
      }
    }
  }
  const order = Object.keys(ROUTE_META);
  return routes.sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));
}

/** Every path the public site indexes (static + collection entries supplied by callers). */
export function inventory(pagesDir, collectionPaths = []) {
  return [...staticRoutes(pagesDir).map((r) => r.path), ...collectionPaths];
}
