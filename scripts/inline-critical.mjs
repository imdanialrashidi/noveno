#!/usr/bin/env node
/**
 * Inline the first-paint assets into every built page.
 *
 * Why: on some Iranian networks (observed 2026-10-31 on GitHub Pages /
 * Fastly with Chrome) every *subresource* request to the custom domain
 * stalls — the HTML document loads, then the stylesheet, module script and
 * webfont never finish. The page then renders unstyled with no JavaScript.
 *
 * Making each page self-contained (one request) removes that failure mode:
 *   - stylesheets become an inline <style>
 *   - module scripts are bundled with esbuild and inlined
 *   - the webfont <link rel=preload> is dropped, and the self-hosted
 *     @font-face rules are moved out of the CSS into a deferred loader: fonts
 *     are fetched only after `load`, with a short abort timeout, so a network
 *     that stalls font downloads can never keep the page "loading" (the CSS
 *     fallback stack renders immediately either way)
 *
 * The original files stay on disk: they are the source for the inlining and
 * the structural tests read them from `dist/_astro`.
 */

import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const DIST = path.resolve(import.meta.dirname, "..", "dist");

// The custom domain stalls subresource requests on some networks while the
// HTML document loads fine (observed 2026-10-31). Fonts and page images are
// therefore served from jsDelivr, pinned to the deployed commit; the HTML
// itself still comes from GitHub Pages.
const REPO = "imdanialrashidi/noveno";
const REF = process.env.GITHUB_SHA || "main";
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/${REPO}@${REF}/public`;
const FONT_BASE = (family, file) =>
  `https://cdn.jsdelivr.net/npm/@fontsource-variable/${family.toLowerCase()}@5.3.0/files/${file}`;

function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const FONT_BLOCK = /@font-face\{[^}]*src:url\((\/fonts\/[^)]+)\)[^}]*\}/g;

/**
 * Split self-hosted @font-face rules out of the CSS and turn them into a
 * deferred loader spec. Local fallback faces (src:local(...)) stay in CSS.
 */
function extractFonts(css) {
  const fonts = [];
  const stripped = css.replace(FONT_BLOCK, (block, url) => {
    const family = /font-family:([^;]+);/.exec(block)?.[1]?.trim();
    const weight = /font-weight:([^;]+);/.exec(block)?.[1]?.trim() ?? "400";
    const style = /font-style:([^;]+);/.exec(block)?.[1]?.trim() ?? "normal";
    const range = /unicode-range:([^;}]+)/.exec(block)?.[1]?.trim() ?? "";
    if (family && url) fonts.push({ family, weight, style, range, url });
    return "";
  });
  return { css: stripped, fonts };
}

function fontLoader(fonts) {
  if (fonts.length === 0) return "";
  const spec = JSON.stringify(
    fonts.map((font) => ({
      ...font,
      url: font.url.startsWith("/fonts/")
        ? FONT_BASE(font.family, font.url.slice("/fonts/".length))
        : font.url,
    })),
  );
  return `<script type="module">
    (function () {
      var fonts = ${spec};
      function load() {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 2500);
        Promise.all(fonts.map(function (f) {
          return fetch(f.url, { signal: controller.signal })
            .then(function (res) { return res.ok ? res.arrayBuffer() : null; })
            .then(function (buffer) {
              if (!buffer) return null;
              var face = new FontFace(f.family, buffer, {
                weight: f.weight, style: f.style, display: "swap", unicodeRange: f.range
              });
              return face.load().then(function (loaded) { document.fonts.add(loaded); });
            })
            .catch(function () {});
        })).finally(function () { clearTimeout(timer); });
      }
      load();
    })();
  </script>`;
}

const scriptCache = new Map();

async function inlineModuleScript(src) {
  if (!scriptCache.has(src)) {
    const result = await build({
      entryPoints: [path.join(DIST, src)],
      bundle: true,
      format: "esm",
      minify: true,
      target: "es2020",
      write: false,
      logLevel: "silent",
      legalComments: "none",
    });
    scriptCache.set(src, result.outputFiles[0].text.replaceAll("</script", "<\\/script"));
  }
  return scriptCache.get(src);
}

let pages = 0;
let styles = 0;
let scripts = 0;
let preloads = 0;
let images = 0;

for (const file of walkHtml(DIST)) {
  let html = fs.readFileSync(file, "utf8");
  let touched = false;

  for (const [tag, href] of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].map((m) => [
    m[0],
    /\bhref="([^"]+)"/.exec(m[0])?.[1] ?? "",
  ])) {
    if (!href) continue;
    const cssPath = path.join(DIST, href);
    if (!fs.existsSync(cssPath)) continue;
    const extracted = extractFonts(fs.readFileSync(cssPath, "utf8"));
    const css = extracted.css.replaceAll("</style", "<\\/style");
    html = html.replace(tag, `<style>${css}</style>`);
    if (extracted.fonts.length > 0 && !html.includes("data-font-loader")) {
      html = html.replace(
        "</body>",
        `${fontLoader(extracted.fonts).replace("<script", "<script data-font-loader")}</body>`,
      );
    }
    styles += 1;
    touched = true;
  }

  for (const [tag, src] of [...html.matchAll(/<script\b[^>]*\btype="module"[^>]*><\/script>/g)].map((m) => [
    m[0],
    /\bsrc="([^"]+)"/.exec(m[0])?.[1] ?? "",
  ])) {
    if (!src) continue;
    if (!fs.existsSync(path.join(DIST, src))) continue;
    const code = await inlineModuleScript(src);
    html = html.replace(tag, `<script type="module">${code}</script>`);
    scripts += 1;
    touched = true;
  }

  const before = html;
  html = html.replace(/<link\b[^>]*\brel="preload"[^>]*\bas="font"[^>]*>\s*/g, "");
  if (html !== before) {
    preloads += 1;
    touched = true;
  }

  if (html.includes('"/images/')) {
    html = html.replaceAll('"/images/', `"${IMAGE_BASE}/images/`);
    html = html.replaceAll("(/images/", `(${IMAGE_BASE}/images/`);
    html = html.replaceAll(", /images/", `, ${IMAGE_BASE}/images/`);
    images += 1;
    touched = true;
  }

  if (touched) {
    fs.writeFileSync(file, html);
    pages += 1;
  }
}

console.log(
  `inline-critical: ${pages} pages — ${styles} stylesheets, ${scripts} scripts, ${preloads} font preloads removed, ${images} pages with CDN images.`,
);
