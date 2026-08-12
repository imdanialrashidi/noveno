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
    .map((f) => path.relative(dist, f).replace(/index\.html$/, "").replace(/\.html$/, ""))
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
    assert.match(html, /"@type":"Organization"/, `${path.relative(dist, file)}: missing Organization JSON-LD`);
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

test("built audit page leaks no secret env names or placeholder keys", () => {
  const html = fs.readFileSync(path.join(dist, "audit", "index.html"), "utf8");
  for (const marker of [
    "TURNSTILE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
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
  assert.ok(
    html.includes("data-audit-done"),
    "the head script must set the data-audit-done attribute",
  );
});
