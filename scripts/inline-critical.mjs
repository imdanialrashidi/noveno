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
 *   - the webfont <link rel=preload> is dropped so a stalling font can never
 *     compete with the document; the font itself stays progressive through
 *     `font-display: swap` in the CSS
 *
 * The original files stay on disk: they are the source for the inlining and
 * the structural tests read them from `dist/_astro`.
 */

import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const DIST = path.resolve(import.meta.dirname, "..", "dist");

function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
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
    const css = fs.readFileSync(cssPath, "utf8").replaceAll("</style", "<\\/style");
    html = html.replace(tag, `<style>${css}</style>`);
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

  if (touched) {
    fs.writeFileSync(file, html);
    pages += 1;
  }
}

console.log(
  `inline-critical: ${pages} pages — ${styles} stylesheets, ${scripts} scripts, ${preloads} font preloads removed.`,
);
