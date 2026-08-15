// Structural tests over the built site (QUALITY invariants 1–2, 8;
// plan §10). Defect sensitivity: these must fail if the site loses
// fa+RTL, gains a client framework, blows the font budget, drops the
// accepted theme anchors, or exceeds the interactive JS budget.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");

const PAGE_PATHS = [
  "/index.html",
  "/services/index.html",
  "/work/index.html",
  "/work/noveno-website/index.html",
  "/process/index.html",
  "/about/index.html",
  "/audit/index.html",
  "/audit/thank-you/index.html",
  "/contact/index.html",
  "/privacy/index.html",
  "/terms/index.html",
  "/blog/index.html",
  "/blog/instagram-lead-tracking/index.html",
  "/404.html",
];

const REQUIRED_TOKENS = [
  "#679e86", // light primary anchor (DESIGN §6.1)
  "#619881", // dark primary anchor (DESIGN §6.2)
  "#f9fafa", // light canvas
  "#050606", // dark canvas
  "#070808", // light text
  "#f7f8f8", // dark text
  "#06130d", // on-primary ink (dark ink on green)
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test("every built page is fa + dir=rtl and has a title", () => {
  for (const rel of PAGE_PATHS) {
    const file = path.join(dist, rel);
    assert.ok(fs.existsSync(file), `missing built page ${rel}`);
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /<html[^>]*lang="fa"/, `${rel}: missing lang="fa"`);
    assert.match(html, /<html[^>]*dir="rtl"/, `${rel}: missing dir="rtl"`);
    assert.match(html, /<title>[^<]+<\/title>/, `${rel}: missing title`);
  }
});

test("package.json asserts no client UI framework", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const forbidden of ["react", "vue", "svelte", "preact", "solid-js"]) {
    assert.ok(!(forbidden in deps), `forbidden client framework dependency: ${forbidden}`);
  }
  assert.ok(deps.astro, "astro must be a dependency");
});

test("font budget ≤ 200 KB woff2, four subsets, no extras", () => {
  const fonts = walk(path.join(root, "public", "fonts")).filter((f) => f.endsWith(".woff2"));
  const names = fonts.map((f) => path.basename(f)).sort();
  assert.deepEqual(names, [
    "estedad-arabic-wght-normal.woff2",
    "estedad-latin-wght-normal.woff2",
    "vazirmatn-arabic-wght-normal.woff2",
    "vazirmatn-latin-wght-normal.woff2",
  ]);
  const total = fonts.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  assert.ok(total <= 200 * 1024, `font total ${total} exceeds 200 KB`);
  // built CSS declares the faces and preload targets the hero face
  const cssFiles = walk(path.join(dist, "_astro")).filter((f) => f.endsWith(".css"));
  const css = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("");
  assert.match(css, /font-family:\s*['"]?Estedad/, "built CSS missing Estedad face");
  assert.match(css, /font-family:\s*['"]?Vazirmatn/, "built CSS missing Vazirmatn face");
});

test("accepted theme anchors and semantic tokens present in built CSS", () => {
  const cssFiles = walk(path.join(dist, "_astro")).filter((f) => f.endsWith(".css"));
  const css = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("");
  for (const token of REQUIRED_TOKENS) {
    assert.ok(css.includes(token), `built CSS missing token ${token}`);
  }
  assert.match(css, /data-theme=dark/, "missing dark theme override");
  assert.match(css, /prefers-color-scheme:dark/, "missing OS-default dark wiring");
});

test("the flowchart grammar is gone from built pages and CSS (2026-08-14 founder override)", () => {
  const cssFiles = walk(path.join(dist, "_astro")).filter((f) => f.endsWith(".css"));
  const css = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("");
  const pages = walk(dist)
    .filter((f) => f.endsWith(".html"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("");
  for (const marker of [
    "route-node",
    "route-station",
    "stepper-station",
    "scatter-field",
    "jl-fade",
    "jl-draw",
    "route-grow",
    "diagram-well",
    "section-node",
  ]) {
    assert.ok(!css.includes(marker), `built CSS still ships removed grammar class ${marker}`);
    assert.ok(!pages.includes(marker), `built HTML still ships removed grammar class ${marker}`);
  }
});

test("reduced-motion guard zeroes animation delays too (no from-state flash)", () => {
  const cssFiles = walk(path.join(dist, "_astro")).filter((f) => f.endsWith(".css"));
  const css = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("");
  const guard = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]*)\}/s);
  assert.ok(guard, "built CSS must carry the reduced-motion guard");
  assert.match(guard[1], /animation-duration:[^;]+!important/, "guard must zero animation durations");
  assert.match(guard[1], /animation-delay:[^;]+!important/, "guard must zero animation delays (else fill-mode:both holds `from` keyframes)");
});

test("homepage hero is the brand artwork: inline SVG, zero raster hero media", () => {
  const home = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  // The hero artwork is an inline SVG signal field (data-hero-art) — no
  // screenshot, no photo, no preloaded hero raster. The headline text is
  // the LCP element (Estedad is preloaded in BaseLayout, nothing else).
  assert.match(home, /data-hero-art/, "hero must carry the brand artwork (inline SVG)");
  assert.ok(!/<link[^>]*rel="preload"[^>]*as="image"/.test(home), "homepage must not preload any hero image");
  const hero = home.split('<section aria-labelledby="hero-title"')[1].split("</section>")[0];
  assert.ok(!/<img/.test(hero), "hero section must contain no <img> (no screenshot/photo)");
  const eagerImages = [...home.matchAll(/<img(?!.*loading="lazy")[^>]*>/g)];
  assert.ok(eagerImages.length === 0, "no image may be eager — LCP is the headline text");
  const lazyImages = [...home.matchAll(/<img[^>]*loading="lazy"/g)];
  assert.ok(lazyImages.length >= 2, "below-fold screenshots must stay lazy");
});

test("homepage hero is brand-led: signal-field artwork + stage strip, no screenshot/photo", () => {
  const home = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  const hero = home.split('<section aria-labelledby="hero-title"')[1].split("</section>")[0];
  assert.ok(!hero.includes("noveno-website-audit"), "hero must not show the audit screenshot");
  assert.ok(!/photography\//.test(hero), "hero must not reference photography");
  assert.match(hero, /hero-stages/, "hero must carry the 4-stage typographic strip");
  assert.match(hero, /data-hero-stages/, "hero strip must be wired for the quiet entrance");
  // the audit UI screenshot survives below the fold as proof (system section)
  assert.ok(home.includes("noveno-website-audit"), "real product UI must remain as proof below the hero");
});

test("old /insights routes no longer build — no duplicate indexable routes", () => {
  assert.ok(!fs.existsSync(path.join(dist, "insights")), "dist must not contain /insights pages");
  assert.ok(fs.existsSync(path.join(dist, "blog", "index.html")), "dist must contain /blog");
  assert.ok(fs.existsSync(path.join(dist, "blog", "instagram-lead-tracking", "index.html")), "dist must contain /blog/[slug]");
});

test("contextual business photography is gone from the production path (2026-09 override)", () => {
  const pages = walk(dist).filter((f) => f.endsWith(".html"));
  const html = pages.map((f) => fs.readFileSync(f, "utf8")).join("");
  for (const marker of [
    "photography/barbershop",
    "photography/salon",
    "photography/workday-close",
    "عکس: Mostafa Meraji",
  ]) {
    assert.ok(!html.includes(marker), `built HTML still references retired photography: ${marker}`);
  }
  const photoDir = path.join(root, "public", "images", "photography");
  const remaining = walk(photoDir).filter((f) => /\.(avif|webp|jpe?g|png)$/.test(f));
  assert.deepEqual(remaining, [], "photography binaries must be removed from public/images/photography");
});

test("every /images/ reference in built pages is content-hashed and exists on disk", () => {
  // Caching contract: /images/* is `immutable` in _headers, which is
  // only safe because every referenced image URL is content-addressed.
  // A hard-coded unhashed path would break cache correctness on
  // founder image replacement — this test makes that a build failure.
  const pages = walk(dist).filter((f) => f.endsWith(".html"));
  const refs = new Set();
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    for (const m of html.matchAll(/(?:src|srcset|href|imagesrcset)="([^"]*\/images\/[^"]+)"/g)) {
      for (const candidate of m[1].split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url.startsWith("/images/")) refs.add(url);
      }
    }
  }
  assert.ok(refs.size > 0, "expected at least one /images/ reference in built pages");
  for (const ref of refs) {
    assert.match(
      ref,
      /\/images\/.*\.[0-9a-f]{8}\.(avif|webp|png|jpe?g)$/,
      `unhashed image reference in built HTML: ${ref}`,
    );
    assert.ok(
      fs.existsSync(path.join(dist, ref.replace(/^\//, ""))),
      `built HTML references missing image file: ${ref}`,
    );
  }
});

test("interactive JS ≤ 15 KB gzip and no client framework runtime", () => {
  const jsFiles = walk(path.join(dist, "_astro")).filter((f) => f.endsWith(".js"));
  // Astro inlines small page-scoped modules; measure them too.
  const inlineModules = [];
  for (const file of walk(dist).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
      inlineModules.push(m[1]);
    }
  }
  const total =
    jsFiles.reduce((sum, f) => sum + gzipSync(fs.readFileSync(f)).length, 0) +
    gzipSync(inlineModules.join("\n")).length;
  assert.ok(total <= 15 * 1024, `interactive JS ${total} bytes gzip exceeds 15 KB`);
  const all = jsFiles.map((f) => fs.readFileSync(f, "utf8")).join("") + inlineModules.join("\n");
  for (const marker of ["__fragment_registry__", "React.createElement", "createApp("]) {
    assert.ok(!all.includes(marker), `client framework marker found: ${marker}`);
  }
});

test("primary CTA flows to /audit in Slice 2 (launch contract), contact fallback intact", () => {
  const pages = walk(dist).filter((f) => f.endsWith(".html"));
  // The header CTA is the canonical primary conversion on every page.
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    assert.ok(html.includes('href="/audit"'), `${path.relative(dist, file)}: missing header/primary CTA to /audit`);
  }
  // Homepage: primary = audit, secondary = work (Spec §3.5–3.6).
  const home = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.ok(home.includes('href="/audit"'), "homepage must link the primary CTA to /audit");
  assert.ok(home.includes('href="/work"'), "homepage must keep the secondary CTA to /work");
  // Direct contact stays reachable everywhere (resilience, Spec §64.1).
  const contact = fs.readFileSync(path.join(dist, "contact", "index.html"), "utf8");
  assert.ok(contact.includes('href="tel:09353598620"'), "contact page must keep click-to-call");
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    assert.ok(html.includes('href="tel:09353598620"'), `${path.relative(dist, file)}: footer contact fallback missing`);
  }
});

test("no dead internal links in built pages", () => {
  const pages = walk(dist).filter((f) => f.endsWith(".html"));
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const hrefs = [...html.matchAll(/href="(\/[^"#]*)/g)].map((m) => m[1]);
    for (const href of hrefs) {
      if (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("https://")) continue;
      const target = path.join(dist, href === "/" ? "index.html" : href + "/index.html");
      assert.ok(
        fs.existsSync(target) || fs.existsSync(path.join(dist, href.replace(/^\//, ""))),
        `${path.relative(dist, file)}: dead link ${href}`,
      );
    }
  }
});

test("build output contains no source maps or dev-only markers", () => {
  for (const file of walk(dist)) {
    if (file.endsWith(".map")) assert.fail(`source map shipped: ${file}`);
  }
  const indexHtml = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.ok(!indexHtml.includes("vite-error-overlay"), "dev overlay marker present");
});

test("no secrets or real-looking env values in built output", () => {
  const all = walk(dist)
    .filter((f) => f.endsWith(".html") || f.endsWith(".js") || f.endsWith(".css"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("");
  const envFile = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const names = [...envFile.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)].map((m) => m[1]);
  for (const name of names) {
    assert.ok(
      !all.includes(`process.env.${name}`) && !all.includes(`import.meta.env.${name}`),
      `env name ${name} leaked into built output`,
    );
  }
});

// Ensure the tests themselves fail when the app disappears (red check).
test("the app route is wired into verification routing", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, ".pi", "verification.json"), "utf8"));
  const appRoute = config.routes.find((r) => r.id === "app");
  assert.ok(appRoute, "missing app route");
  assert.ok(appRoute.include.includes("src/**"), "app route must include src/**");
  assert.ok(appRoute.commands.some((c) => c.includes("tests/structural.test.mjs")), "app route must run structural tests");
});

// Convenience: run the canonical build from the test (used by verify.sh flow).
export function buildSite() {
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
}
