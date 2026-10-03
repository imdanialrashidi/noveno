/**
 * SEO / production-readiness contract (plan §7 step 6, Spec §43).
 * Built-site assertions: sitemap coverage (every indexable built page
 * listed, nothing stale), robots policy, security headers, structured
 * data, and the social metadata image. Runs against a fresh `dist/`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const site = "https://noveno.ir";

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test("sitemap covers every indexable built page and nothing stale", () => {
  const sitemap = fs.readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 10, `sitemap too small: ${locs.length}`);

  // every built HTML page (except 404 and pages carrying robots noindex)
  // must be listed
  const pages = walk(dist)
    .filter((f) => f.endsWith(".html") && !f.endsWith("404.html"))
    .filter((f) => {
      const html = fs.readFileSync(f, "utf8");
      return !/name="robots"[^>]*noindex/.test(html);
    })
    .map((f) =>
      path
        .relative(dist, f)
        .replace(/index\.html$/, "")
        .replace(/\.html$/, ""),
    )
    .map((rel) => `${site}/${rel}`.replace(/\/$/, ""));
  const expected = new Set(pages);
  const listed = new Set(locs.map((l) => l.replace(/\/$/, "")));
  for (const page of expected) {
    assert.ok(listed.has(page), `sitemap missing built page ${page}`);
  }
  for (const loc of listed) {
    assert.ok(expected.has(loc), `sitemap lists unbuilt page ${loc}`);
  }
  // noindex pages must not be listed
  assert.ok(!locs.some((l) => l.includes("/audit/thank-you")), "thank-you must not be in the sitemap");
});

test("robots.txt allows crawling and disallows the post-submission page", () => {
  const robots = fs.readFileSync(path.join(root, "public", "robots.txt"), "utf8");
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/audit\/thank-you/);
  assert.ok(robots.includes("Sitemap:"), "robots must reference the sitemap");
});

test("_headers ships baseline security headers and the pragmatic CSP", () => {
  const headers = fs.readFileSync(path.join(root, "public", "_headers"), "utf8");
  assert.match(headers, /\/fonts\/\*/);
  assert.match(headers, /Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Content-Security-Policy:/);
  // the CSP must allow the only third parties the site uses
  assert.match(headers, /challenges\.cloudflare\.com/);
  assert.match(headers, /api\.web3forms\.com/);
  assert.match(headers, /object-src 'none'/);
});

test("every built page carries Organization + WebSite structured data", () => {
  const pages = walk(dist).filter((f) => f.endsWith(".html"));
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    assert.match(
      html,
      /"@type":"Organization"/,
      `${path.relative(dist, file)}: missing Organization JSON-LD`,
    );
    assert.match(html, /"@type":"WebSite"/, `${path.relative(dist, file)}: missing WebSite JSON-LD`);
  }
});

test("social metadata image exists as a 1200×630 PNG", () => {
  const file = path.join(root, "public", "og.png");
  assert.ok(fs.existsSync(file), "public/og.png missing");
  const buf = fs.readFileSync(file);
  assert.ok(buf.subarray(1, 4).toString() === "PNG", "og.png is not a PNG");
  // IHDR width/height (big-endian at bytes 16/20)
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(width, 1200);
  assert.equal(height, 630);
});

test("per-page social cards exist and are referenced with correct metadata", () => {
  const png = (rel) => {
    const file = path.join(root, "public", rel);
    assert.ok(fs.existsSync(file), `missing social card ${rel}`);
    const buf = fs.readFileSync(file);
    assert.ok(buf.subarray(1, 4).toString() === "PNG", `${rel} is not a PNG`);
    assert.equal(buf.readUInt32BE(16), 1200, `${rel} width`);
    assert.equal(buf.readUInt32BE(20), 630, `${rel} height`);
  };
  const expectCard = (htmlFile, cardPath) => {
    const html = fs.readFileSync(path.join(dist, htmlFile), "utf8");
    assert.ok(
      html.includes(`property="og:image" content="https://noveno.ir${cardPath}"`),
      `${htmlFile} must reference ${cardPath} as og:image`,
    );
    assert.ok(
      html.includes(`name="twitter:image" content="https://noveno.ir${cardPath}"`),
      `${htmlFile} must reference ${cardPath} as twitter:image`,
    );
  };

  png("og.png");
  png("og/work.png");
  png("og/work/noveno-website.png");
  png("og/blog.png");
  png("og/blog/instagram-lead-tracking.png");
  png("og/about.png");

  expectCard("index.html", "/og.png");
  expectCard("work/index.html", "/og/work.png");
  expectCard("work/noveno-website/index.html", "/og/work/noveno-website.png");
  expectCard("blog/index.html", "/og/blog.png");
  expectCard("blog/instagram-lead-tracking/index.html", "/og/blog/instagram-lead-tracking.png");
  expectCard("about/index.html", "/og/about.png");
});

test("insights → blog migration: permanent redirects and no duplicate indexable routes", () => {
  const redirects = fs.readFileSync(path.join(root, "public", "_redirects"), "utf8");
  assert.match(
    redirects,
    /^\/insights\/\*\s+\/blog\/:splat\s+301$/m,
    "article slug redirect must be 301 and 1:1",
  );
  assert.match(redirects, /^\/insights\s+\/blog\s+301$/m, "index redirect must be 301");
  // canonical article path is /blog/[slug]; nothing indexable may remain under /insights
  assert.ok(!fs.existsSync(path.join(dist, "insights")), "no /insights pages may be built");
  assert.ok(
    fs.existsSync(path.join(dist, "blog", "instagram-lead-tracking", "index.html")),
    "/blog/[slug] must be built",
  );
});

test("draft blog articles never build and never enter the sitemap", () => {
  const draftHtml = path.join(dist, "blog", "draft-sample", "index.html");
  assert.ok(!fs.existsSync(draftHtml), "draft article must not be built");
  const sitemap = fs.readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
  assert.ok(!sitemap.includes("/blog/draft-sample"), "draft article must not be in the sitemap");
  assert.ok(!sitemap.includes("/insights/"), "sitemap must not list any old /insights URL");
});

test("draft work entries never build and never enter the sitemap (parity with blog)", () => {
  const draftHtml = path.join(dist, "work", "draft-sample", "index.html");
  assert.ok(!fs.existsSync(draftHtml), "draft work must not be built");
  const sitemap = fs.readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
  assert.ok(!sitemap.includes("/work/draft-sample"), "draft work must not be in the sitemap");
});

test("published blog article ships Article schema, breadcrumbs, canonical and fa-IR", () => {
  const html = fs.readFileSync(path.join(dist, "blog", "instagram-lead-tracking", "index.html"), "utf8");
  assert.match(html, /"@type":"Article"/, "article page must carry Article JSON-LD");
  assert.match(html, /"datePublished"/, "article schema must carry the publication date");
  assert.match(html, /"@type":"BreadcrumbList"/, "article page must carry breadcrumbs");
  assert.match(
    html,
    /rel="canonical" href="https:\/\/noveno\.ir\/blog\/instagram-lead-tracking"/,
    "article canonical must be exact /blog URL",
  );
  assert.match(html, /property="og:type" content="article"/, "article og:type must be article");
  assert.match(html, /<html[^>]*lang="fa"[^>]*dir="rtl"/, "article page must be fa + rtl");
  assert.ok(html.includes("وبلاگ"), "article page must use blog terminology");
  // No fabricated schema: no ratings/reviews on the article.
  assert.ok(!html.includes('"@type":"Review"'), "no fabricated review schema");
  assert.ok(!html.includes('"@type":"Rating"'), "no fabricated rating schema");
});

test("built audit page leaks no secret env names or placeholder keys", () => {
  const html = fs.readFileSync(path.join(dist, "audit", "index.html"), "utf8");
  for (const marker of [
    "TURNSTILE_SECRET_KEY",
    "1x00000000000000000000AA", // official test sitekey must never ship
  ]) {
    assert.ok(!html.includes(marker), `audit page leaks ${marker}`);
  }
});

test("audit form renders the honeypot trap (security review MAJOR-1)", () => {
  const html = fs.readFileSync(path.join(dist, "audit", "index.html"), "utf8");
  assert.match(html, /name="company_website"/, "honeypot input must be rendered");
  assert.match(html, /tabindex="-1"/, "honeypot must be excluded from tab order");
  assert.match(html, /autocomplete="off"/, "honeypot must not autofill");
  assert.match(html, /aria-hidden="true"/, "honeypot must be hidden from AT");
});

test("thank-you page ships the pre-paint guard script (reviewer MAJOR)", () => {
  const html = fs.readFileSync(path.join(dist, "audit", "thank-you", "index.html"), "utf8");
  assert.match(
    html,
    /noveno:audit:done/,
    "thank-you must contain the data-audit-done head script (guard regression guard)",
  );
  assert.ok(html.includes("data-audit-done"), "the head script must set the data-audit-done attribute");
});

/**
 * Internal link integrity (technical SEO audit 2026-10).
 *
 * Contract: every same-origin href/src in the built HTML must resolve to a
 * file that the build actually ships. The oracle is the contents of `dist/`
 * itself — the set of emitted routes and assets — so a link to a route that
 * was never built (e.g. a `/portfolio/` page removed from the section
 * grammar) fails here instead of silently 404-ing for a crawler and a reader.
 *
 * Why this gate exists: the sitemap/robots/JSON-LD checks above all passed
 * while five published case studies linked to `https://noveno.ir/portfolio/`
 * on every build. Nothing in the suite asserted link targets.
 *
 * External links are out of scope: client sites, Instagram, messaging apps,
 * and the Cloudflare Turnstile script are not ours to resolve.
 */
test("every same-origin link in built HTML resolves to a built route or asset", () => {
  const files = walk(dist);

  /** Route URLs the build serves as pages, e.g. "/" or "/work/isbatab/". */
  const routes = new Set(
    files
      .filter((f) => f.endsWith(".html"))
      .map((f) => ("/" + path.relative(dist, f)).replace(/\.html$/, "").replace(/\/index$/, "/")),
  );
  /** Non-HTML files the build ships, e.g. "/og/work.png" or "/rss.xml". */
  const assets = new Set(
    files.filter((f) => !f.endsWith(".html")).map((f) => "/" + path.relative(dist, f)),
  );

  assert.ok(routes.size > 0, "dist/ has no built pages — run a build first");

  const broken = [];
  for (const file of files.filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    const page = "/" + path.relative(dist, file);
    for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(mailto:|tel:|#|javascript:|data:)/.test(raw)) continue;
      let url;
      try {
        url = new URL(raw, `${site}/`);
      } catch {
        broken.push({ page, link: raw, why: "unparseable URL" });
        continue;
      }
      if (url.origin !== site) continue; // external — out of scope
      const p = url.pathname;
      const resolves = [p, p.replace(/\/$/, "") + "/", p.replace(/\/$/, "")].some(
        (c) => routes.has(c) || assets.has(c),
      );
      if (!resolves) broken.push({ page, link: raw, why: "not present in dist/" });
    }
  }

  assert.deepEqual(
    broken,
    [],
    "dead same-origin links in built HTML (each resolves to a 404 for readers and crawlers):\n" +
      broken.map((b) => `  ${b.page} -> ${b.link}  [${b.why}]`).join("\n"),
  );
});
