#!/usr/bin/env node
/**
 * Lab static server for performance measurement.
 *
 * Serves `dist/` with:
 *  - Brotli/gzip compression (like Cloudflare Pages production delivery),
 *    chosen by Accept-Encoding, on the fly;
 *  - `Cache-Control` applied from `public/_headers` so lab caching
 *    semantics match production semantics where it matters;
 *  - SPA-fallback-free, plain static file serving (no HTML rewriting).
 *
 * Usage: node scripts/lab-server.mjs [port] [distDir]
 * Defaults: port 4173, distDir ./dist
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, extname, normalize, sep } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

const port = Number(process.argv[2] ?? 4173);
const distDir = process.argv[3] ?? "dist";

/* ------------------------------------------------------------------ */
/* _headers parsing (Cloudflare Pages format, single-segment rules)    */
/* ------------------------------------------------------------------ */

const headersFile = join(distDir, "_headers");
const headerRules = [];
if (existsSync(headersFile)) {
  let currentPath = null;
  for (const line of readFileSync(headersFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (!line.startsWith(" ") && !line.startsWith("\t") && trimmed.includes(" ")) {
      const [p, ...rest] = trimmed.split(/\s+/);
      if (rest.length > 0) currentPath = p;
      else currentPath = null;
    } else if (currentPath && trimmed.includes(":")) {
      const idx = trimmed.indexOf(":");
      headerRules.push({
        path: currentPath,
        name: trimmed.slice(0, idx).trim().toLowerCase(),
        value: trimmed.slice(idx + 1).trim(),
      });
    }
  }
}

function cacheHeadersFor(urlPath) {
  const out = {};
  for (const rule of headerRules) {
    if (
      rule.path === "*" ||
      rule.path === urlPath ||
      (rule.path.endsWith("*") && urlPath.startsWith(rule.path.slice(0, -1)))
    ) {
      out[rule.name] = rule.value;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Static serving with compression                                     */
/* ------------------------------------------------------------------ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg", ".txt", ".xml"]);

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  let file = join(distDir, safe);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  return file;
}

const server = createServer((req, res) => {
  const urlPath = (req.url ?? "/").split("?")[0];
  const file = resolveFile(urlPath);
  if (!existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  const ext = extname(file).toLowerCase();
  const raw = readFileSync(file);
  const cache = cacheHeadersFor(urlPath);
  const headers = {
    "content-type": MIME[ext] ?? "application/octet-stream",
    ...cache,
    "access-control-allow-origin": "*",
  };
  if (COMPRESSIBLE.has(ext)) {
    const accept = (req.headers["accept-encoding"] ?? "").toLowerCase();
    if (accept.includes("br")) {
      headers["content-encoding"] = "br";
      res.writeHead(200, headers);
      res.end(brotliCompressSync(raw));
      return;
    }
    if (accept.includes("gzip")) {
      headers["content-encoding"] = "gzip";
      res.writeHead(200, headers);
      res.end(gzipSync(raw));
      return;
    }
  }
  res.writeHead(200, headers);
  res.end(raw);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`lab server: http://127.0.0.1:${port}  (dist: ${distDir}, brotli+gzip enabled)`);
});
