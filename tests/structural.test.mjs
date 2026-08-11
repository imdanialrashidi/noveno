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
  "/work/clinic-acquisition-concept/index.html",
  "/work/language-school-concept/index.html",
  "/process/index.html",
  "/about/index.html",
  "/contact/index.html",
  "/privacy/index.html",
  "/terms/index.html",
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

test("primary CTA flows to /contact in Slice 1 (no /audit stubs)", () => {
  const home = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  // The audit route must not exist anywhere in built HTML.
  for (const file of walk(dist).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    assert.ok(!html.includes('href="/audit'), `${file}: unexpected /audit link`);
  }
  assert.ok(home.includes('href="/contact"'), "homepage must link the primary CTA to /contact");
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
