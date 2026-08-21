// Unit tests for the conservative prune classifier in
// scripts/build-image-manifest.mjs.
//
// Defect sensitivity: the classifier must NEVER mark a founder-named file
// that merely looks hashed (no logical source with the same basename in the
// same directory) as prunable — the pre-fix script deleted such files with
// rmSync during a routine build. Genuinely stale generated variants whose
// base name still matches a logical file in the same directory must remain
// prunable. Fixtures are temp dirs; real assets are never touched.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { collectPrunableCandidates } from "../scripts/build-image-manifest.mjs";

// Same pattern the script uses to recognize generated hash copies.
const HASHED_RE = /\.[0-9a-f]{8}\.(avif|webp|png|jpe?g)$/;

function makeFixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "noveno-images-"));
  const paths = new Map();
  for (const rel of files) {
    const abs = path.join(dir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `fixture bytes for ${rel}`);
    paths.set(rel, abs);
  }
  return { dir, paths };
}

test("founder-named file that merely looks hashed is never pruned", () => {
  const { dir, paths } = makeFixture(["work/hero-1234abcd.webp", "work/hero.webp"]);
  try {
    const prunable = collectPrunableCandidates(
      [paths.get("work/hero-1234abcd.webp")],
      [paths.get("work/hero.webp")],
    );
    assert.deepEqual(prunable, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("stale generated variant matching a logical base in the same dir is prunable", () => {
  const { dir, paths } = makeFixture(["work/hero.webp", "work/hero.5f2c9e7a.webp"]);
  try {
    const prunable = collectPrunableCandidates(
      [paths.get("work/hero.webp"), paths.get("work/hero.5f2c9e7a.webp")],
      [paths.get("work/hero.webp")],
    );
    assert.deepEqual(prunable, [paths.get("work/hero.5f2c9e7a.webp")]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("fresh generated variant is prunable by the classifier but the loop's liveHashed guard keeps it", () => {
  const { dir, paths } = makeFixture(["work/hero.webp", "work/hero.a1b2c3d4.webp"]);
  try {
    const prunable = collectPrunableCandidates(
      [paths.get("work/hero.webp"), paths.get("work/hero.a1b2c3d4.webp")],
      [paths.get("work/hero.webp")],
    );
    // The classifier sees it as a stale candidate; whether the script
    // actually deletes it is decided by the loop's liveHashed guard.
    assert.deepEqual(prunable, [paths.get("work/hero.a1b2c3d4.webp")]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // The prune loop only rmSyncs candidates NOT in liveHashed (the names this
  // run materialized next to their logical sources). Inspect the loop rather
  // than importing it.
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, "../scripts/build-image-manifest.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /if \(!liveHashed\.has\(file\)\) \{[\s\S]*?rmSync\(file\);/,
    "prune loop must skip candidates this run just materialized (liveHashed)",
  );
});

test("logical files themselves are never prunable, even when named photo-1a2b3c4d.png", () => {
  const { dir, paths } = makeFixture(["photo-1a2b3c4d.png", "photo.png"]);
  try {
    const prunable = collectPrunableCandidates(
      [paths.get("photo-1a2b3c4d.png"), paths.get("photo.png")],
      [paths.get("photo-1a2b3c4d.png"), paths.get("photo.png")],
    );
    assert.deepEqual(prunable, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("hex-ish slug next to a different logical base in the same dir is still not prunable", () => {
  const { dir, paths } = makeFixture(["work/hero-1234abcd.webp", "work/hero.webp"]);
  try {
    const prunable = collectPrunableCandidates(
      [paths.get("work/hero-1234abcd.webp"), paths.get("work/hero.webp")],
      [paths.get("work/hero.webp")],
    );
    assert.deepEqual(prunable, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("dot-named founder file with no matching logical base in the same dir is never pruned", () => {
  // The genuinely dangerous shape: the name DOES match the hash pattern
  // (`.<8-hex>.<ext>`), but no logical file shares its basename — so it must
  // be a founder-named file, not a generated copy.
  const { dir, paths } = makeFixture(["work/hero.webp", "work/photo.1a2b3c4d.webp"]);
  try {
    assert.ok(HASHED_RE.test(paths.get("work/photo.1a2b3c4d.webp")), "fixture must look hashed");
    const prunable = collectPrunableCandidates(
      [paths.get("work/hero.webp"), paths.get("work/photo.1a2b3c4d.webp")],
      [paths.get("work/hero.webp")],
    );
    assert.deepEqual(prunable, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("production public/images contains only hashed files (no logical copies deployed)", () => {
  const imagesDir = path.resolve(import.meta.dirname, "..", "public", "images");
  if (!fs.existsSync(imagesDir)) return;
  function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(p));
      else out.push(p);
    }
    return out;
  }
  const EXTS = new Set([".avif", ".webp", ".png", ".jpg", ".jpeg"]);
  const files = walk(imagesDir).filter((f) => EXTS.has(path.extname(f)));
  for (const file of files) {
    assert.ok(HASHED_RE.test(file), `unhashed file deployed: ${path.relative(imagesDir, file)}`);
  }
  assert.ok(files.length > 0, "at least one hashed image should exist");
});

test("two-directory layout: logical sources in assets/images do not appear in public/images", () => {
  const sourcesDir = path.resolve(import.meta.dirname, "..", "assets", "images");
  const imagesDir = path.resolve(import.meta.dirname, "..", "public", "images");
  if (!fs.existsSync(sourcesDir) || !fs.existsSync(imagesDir)) return;
  function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(p));
      else out.push(p);
    }
    return out;
  }
  const sources = new Set(walk(sourcesDir).map((p) => path.basename(p)));
  const hashedInPublic = walk(imagesDir).map((p) => path.basename(p));
  // Every logical source basename should NOT appear verbatim in public (only hashed variants)
  for (const src of sources) {
    if (src.includes(".") && !HASHED_RE.test(path.join(imagesDir, src))) {
      // src is logical like "hero.webp" — ensure no identical file in public
      assert.ok(!hashedInPublic.includes(src), `logical file ${src} must not be in public/images`);
    }
  }
});
