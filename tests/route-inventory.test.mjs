/**
 * Route inventory (candidates 5+8): static routes derive from the
 * src/pages filesystem — no hand-edited array, no must-match comment.
 * The committed sitemap.xml is output, not a source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { staticRoutes, inventory } from "../scripts/lib/route-inventory.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pagesDir = path.join(root, "src", "pages");

test("static routes derive from the filesystem (no hand array)", () => {
  const routes = staticRoutes(pagesDir);
  const paths = routes.map((r) => r.path);
  const expected = [
    "/",
    "/audit",
    "/services",
    "/pricing",
    "/work",
    "/blog",
    "/process",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ];
  assert.deepEqual(paths, expected);
  for (const r of routes) {
    assert.ok(r.changefreq && r.priority && r.lastmod, `route ${r.path} needs sitemap metadata`);
  }
});

test("utility routes stay unlisted (404, thank-you)", () => {
  const paths = staticRoutes(pagesDir).map((r) => r.path);
  assert.ok(!paths.includes("/404"), "404 must not be listed");
  assert.ok(!paths.includes("/audit/thank-you"), "thank-you (noindex) must not be listed");
});

test("inventory unions static + collection paths", () => {
  const paths = inventory(pagesDir, ["/work/a", "/blog/b"]);
  assert.ok(paths.includes("/") && paths.includes("/work/a") && paths.includes("/blog/b"));
});

test("committed sitemap matches the derived static set", () => {
  const sitemap = fs.readFileSync(path.join(root, "public", "sitemap.xml"), "utf8");
  for (const { path: p } of staticRoutes(pagesDir)) {
    assert.ok(sitemap.includes(`<loc>https://noveno.ir${p}</loc>`), `sitemap missing static route ${p}`);
  }
});
