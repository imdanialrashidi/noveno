/**
 * OG / social-card asset contract (regression for the Cloudflare Pages
 * `ModuleNotFoundError: No module named PIL` build failure).
 *
 * The production build no longer renders cards with Python/Pillow — cards
 * are committed under public/og/ and `scripts/validate-og-assets.mjs`
 * (Node, zero dependencies) gates them at prebuild. These tests prove the
 * gate is defect-sensitive: a missing or invalid required card must fail
 * the validator with a clear message, drafts must never require a card,
 * and the pinned `.node-version` must satisfy the package engine.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const validator = path.join(root, "scripts", "validate-og-assets.mjs");

function runValidator() {
  return spawnSync("node", [validator], { cwd: root, encoding: "utf8" });
}

/** Replace a card with arbitrary bytes; always restores the original. */
function withCardBytes(rel, bytes, fn) {
  const abs = path.join(root, "public", rel);
  const original = fs.readFileSync(abs);
  fs.writeFileSync(abs, bytes);
  try {
    fn();
  } finally {
    fs.writeFileSync(abs, original);
  }
}

/** Rename a card out of the way; always restores it. */
function withCardHidden(rel, fn) {
  const abs = path.join(root, "public", rel);
  const hidden = `${abs}.__hidden__`;
  fs.renameSync(abs, hidden);
  try {
    fn();
  } finally {
    fs.renameSync(hidden, abs);
  }
}

/** Write a temporary blog entry; always removes it. */
function withTempEntry(name, body, fn) {
  const abs = path.join(root, "src", "content", "blog", name);
  fs.writeFileSync(abs, body);
  try {
    fn();
  } finally {
    fs.rmSync(abs, { force: true });
  }
}

/** Replace a card that may not exist yet; restores/removes it afterwards. */
function withTempCard(rel, bytes, fn) {
  const abs = path.join(root, "public", rel);
  const existed = fs.existsSync(abs);
  const original = existed ? fs.readFileSync(abs) : null;
  fs.writeFileSync(abs, bytes);
  try {
    fn();
  } finally {
    if (existed) fs.writeFileSync(abs, original);
    else fs.rmSync(abs, { force: true });
  }
}

/** Bytes of a real committed card (valid PNG, exactly 1200×630). */
const validCardBytes = () => fs.readFileSync(path.join(root, "public", "og", "blog.png"));

test("validator passes on the committed asset set (drafts need no card)", () => {
  // draft-sample is a draft: it must NOT have a card and the validator
  // must still pass — drafts never require OG assets.
  assert.ok(
    !fs.existsSync(path.join(root, "public", "og", "blog", "draft-sample.png")),
    "draft article must not require/ship a social card",
  );
  const result = runValidator();
  assert.equal(result.status, 0, `validator failed on committed set:\n${result.stderr}`);
  assert.match(result.stdout, /social cards validated/);
  assert.match(result.stdout, /1200×630 PNG/);
});

test("missing required committed card fails the validator with a clear message", () => {
  // og/work/mobile-khorsandi.png is deliberately NOT a card the parallel
  // seo-contract suite reads — hiding it cannot race another test file.
  withCardHidden("og/work/mobile-khorsandi.png", () => {
    const result = runValidator();
    assert.notEqual(result.status, 0, "validator must fail when a required card is missing");
    assert.match(result.stderr, /missing required social card public\/og\/work\/mobile-khorsandi\.png/);
    assert.match(result.stderr, /generate:og/); // recovery hint must be actionable
  });
  // restored → green again
  assert.equal(runValidator().status, 0, "validator must pass again after restore");
});

test("non-PNG content in a card path fails the validator", () => {
  withCardBytes("og/work/isbatab.png", Buffer.from("definitely not a png", "utf8"), () => {
    const result = runValidator();
    assert.notEqual(result.status, 0, "validator must reject a non-PNG card");
    assert.match(result.stderr, /public\/og\/work\/isbatab\.png is not a PNG/);
  });
});

test("wrong PNG dimensions fail the validator (1200×630 contract)", () => {
  // Valid PNG signature + IHDR declaring 100×100 — validator must reject.
  const fake = Buffer.alloc(64);
  fake.writeUInt32BE(0x89504e47, 0); // PNG signature
  fake.write("PNG", 1);
  fake.writeUInt32BE(13, 8); // IHDR chunk length
  fake.write("IHDR", 12);
  fake.writeUInt32BE(100, 16); // width
  fake.writeUInt32BE(100, 20); // height
  withCardBytes("og/work/isbatab.png", fake, () => {
    const result = runValidator();
    assert.notEqual(result.status, 0, "validator must reject wrong dimensions");
    assert.match(result.stderr, /100×100, expected 1200×630/);
  });
});

test("repo-relative ogImage override is gated like a committed card", () => {
  // blog/[slug].astro resolves `ogImage: og/blog/tmp-relative.png` against
  // the site origin to https://<site>/og/blog/tmp-relative.png — a public
  // path that must exist and be 1200×630. The validator must require it
  // even though the frontmatter value has no leading slash.
  const rel = "og/blog/tmp-relative.png";
  withTempEntry(
    "tmp-relative.md",
    `---\ntitle: Tmp relative\ndate: 2026-01-01\nogImage: og/blog/tmp-relative.png\n---\n\nBody.\n`,
    () => {
      // RED: relative override without its card must fail the gate.
      const missing = runValidator();
      assert.notEqual(missing.status, 0, "relative override must require its card");
      assert.match(
        missing.stderr,
        /missing required social card public\/og\/blog\/tmp-relative\.png/,
      );

      // GREEN: with a real 1200×630 card in place, the gate passes.
      withTempCard(rel, validCardBytes(), () => {
        assert.equal(runValidator().status, 0, "gate must pass once the override card exists");

        // RED again: hiding the card must fail even though the override is
        // repo-relative (pre-fix, this override silently bypassed the gate).
        withCardHidden(rel, () => {
          const hidden = runValidator();
          assert.notEqual(hidden.status, 0, "hiding the override card must fail the gate");
          assert.match(
            hidden.stderr,
            /missing required social card public\/og\/blog\/tmp-relative\.png/,
          );
        });
      });
    },
  );
});

test("external https ogImage override needs no committed card", () => {
  withTempEntry(
    "tmp-external.md",
    `---\ntitle: Tmp external\ndate: 2026-01-01\nogImage: https://example.com/card.png\n---\n\nBody.\n`,
    () => {
      const result = runValidator();
      assert.equal(result.status, 0, `external override must not require a card:\n${result.stderr}`);
      assert.match(result.stdout, /social cards validated/);
    },
  );
});

test(".node-version satisfies the package engines requirement (>=22.19)", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const engines = pkg.engines?.node;
  assert.ok(engines, "package.json must declare engines.node");
  const version = fs.readFileSync(path.join(root, ".node-version"), "utf8").trim();
  assert.match(version, /^\d+\.\d+\.\d+$/, `.node-version must be an exact version, got ${version}`);

  const parseTriple = (v) => v.split(".").map((n) => Number(n));
  const match = /^(>=)\s*(\d+\.\d+(?:\.\d+)?)$/.exec(engines.trim());
  assert.ok(match, `engine contract must be a plain >= lower bound, got ${engines}`);
  const v = parseTriple(version);
  const required = parseTriple(match[2]);
  assert.ok(
    v[0] > required[0] ||
      (v[0] === required[0] && (v[1] > required[1] || (v[1] === required[1] && v[2] >= required[2]))),
    `${version} does not satisfy engines.node ${engines}`,
  );
});
