#!/usr/bin/env node
/**
 * Build the image version manifest (content-addressed image URLs).
 *
 * Walks `public/images/**` and maps every logical image path to a
 * content-hashed URL, materializing a hashed copy next to the logical
 * file:  `public/images/photography/hero-1600.avif` →
 * `public/images/photography/hero-1600.<sha256-8>.avif`.
 *
 * Why: `public/_headers` serves `/images/*` with `immutable` caching.
 * That is only correct when the URL changes whenever the bytes change —
 * otherwise a founder replacing homepage photography (same filename)
 * would leave stale images in visitor caches for a year. Hashed copies
 * make replacement safe: regenerate images → rebuild → new hash → new
 * URL → `immutable` stays correct, with zero cache-busting guesses.
 *
 * The output module `src/generated/image-manifest.ts` is committed so
 * `astro dev` works without a build step; `npm run build` (prebuild
 * hook) regenerates it automatically. Any code that references a public
 * image MUST go through `imageUrl()` from that module — never through
 * a hard-coded `/images/...` path.
 *
 * Stale hashed copies (whose hash no longer matches any logical file)
 * are pruned only when their base name matches a logical file in the
 * same directory; founder-named files that merely look hashed are never
 * pruned.
 *
 * Usage: node scripts/build-image-manifest.mjs
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const IMAGES_DIR = join(ROOT, "public", "images");
const OUT = join(ROOT, "src", "generated", "image-manifest.ts");

const EXTS = new Set([".avif", ".webp", ".png", ".jpg", ".jpeg"]);
const HASHED_RE = /\.[0-9a-f]{8}\.(avif|webp|png|jpe?g)$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function shortHash(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);
}

/**
 * Decide which files may be pruned as stale generated variants.
 * A file is prunable ONLY when its name is `<basename>.<8-hex>.<ext>`
 * AND `<basename>` is a logical (source) file's basename in the SAME
 * directory — generated hashed copies are always created that way.
 * A founder-named file that merely looks hashed (e.g. hero-1234abcd.webp
 * with no logical hero-1234abcd source) is never pruned.
 * Trade-off: a stale variant whose logical source was deleted is kept
 * (bounded accumulation) rather than risking a wrong deletion.
 */
export function collectPrunableCandidates(allFiles, logicalFiles) {
  const logicalBasesByDir = new Map();
  for (const raw of logicalFiles) {
    const file = raw.replaceAll("\\", "/");
    const dir = file.slice(0, file.lastIndexOf("/") + 1);
    const base = file.slice(file.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
    if (!logicalBasesByDir.has(dir)) logicalBasesByDir.set(dir, new Set());
    logicalBasesByDir.get(dir).add(base);
  }
  return allFiles.filter((raw) => {
    const file = raw.replaceAll("\\", "/");
    if (!HASHED_RE.test(file)) return false;
    const slash = file.lastIndexOf("/");
    const dir = file.slice(0, slash + 1);
    const name = file.slice(slash + 1);
    const base = name.replace(HASHED_RE, "");
    return logicalBasesByDir.get(dir)?.has(base) === true;
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(import.meta.filename)) {
  /* Logical files = image files that are NOT already hashed copies. */
  const allFiles = walk(IMAGES_DIR).filter((f) => EXTS.has(f.slice(f.lastIndexOf("."))));
  const logical = allFiles.filter((f) => !HASHED_RE.test(f));
  logical.sort();

  const entries = [];
  const liveHashed = new Set();
  for (const file of logical) {
    const logicalPath = file.slice(IMAGES_DIR.length + 1).replaceAll("\\", "/");
    const ext = logicalPath.slice(logicalPath.lastIndexOf("."));
    const base = logicalPath.slice(0, -ext.length);
    const hashedName = `${base.slice(base.lastIndexOf("/") + 1)}.${shortHash(file)}${ext}`;
    const hashedRel = `${base.slice(0, base.lastIndexOf("/") + 1)}${hashedName}`;
    const hashedFile = join(IMAGES_DIR, ...hashedRel.split("/"));
    if (file !== hashedFile) {
      copyFileSync(file, hashedFile); // idempotent: same bytes → same name
    }
    liveHashed.add(hashedFile);
    entries.push([logicalPath, hashedRel]);
  }

  /* Prune stale hashed copies — conservatively (see collectPrunableCandidates). */
  for (const file of collectPrunableCandidates(allFiles, logical)) {
    if (!liveHashed.has(file)) {
      rmSync(file);
      console.log(`pruned stale variant: ${file.slice(IMAGES_DIR.length + 1)}`);
    }
  }

  const lines = [
    "// GENERATED FILE — do not edit by hand.",
    "// Regenerated by `node scripts/build-image-manifest.mjs` (npm prebuild).",
    "// Maps logical public image paths to content-hashed URLs so",
    "// `immutable` caching on /images/* stays correct across image",
    "// replacements (see docs/IMAGERY.md §replacement).",
    "",
    "export const imageManifest: Readonly<Record<string, string>> = {",
    ...entries.map(([logicalPath, hashedRel]) => `  ${JSON.stringify(logicalPath)}: ${JSON.stringify(`/images/${hashedRel}`)},`),
    "};",
    "",
    "/**",
    " * Resolve a logical image path (relative to public/images/, WITH",
    " * extension, e.g. \"photography/hero-1600.avif\") to its hashed URL.",
    " * Unknown keys fall back to the plain path so dev environments and",
    " * new assets never 404 — but built sites always use the manifest.",
    " */",
    "export function imageUrl(logical: string): string {",
    "  return imageManifest[logical] ?? `/images/${logical}`;",
    "}",
    "",
  ];

  mkdirSync(join(ROOT, "src", "generated"), { recursive: true });
  writeFileSync(OUT, lines.join("\n"));
  console.log(`image manifest: ${entries.length} logical files → ${OUT}`);
}
