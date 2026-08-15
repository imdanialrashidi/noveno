/**
 * Sitemap frontmatter parser (plan 016).
 * Defect-sensitive: the old regex mini-parser mis-read quoted values with
 * colons; real YAML (the `yaml` package) must parse them correctly and
 * match the zod schema semantics used by the content layer.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseFrontmatter } from "../scripts/generate-sitemap.mjs";

test("parseFrontmatter handles quoted colons and arrays (real YAML)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "noveno-sitemap-"));
  try {
    const file = path.join(dir, "x.md");
    fs.writeFileSync(
      file,
      '---\ntitle: "A: quoted title"\ncanonical: https://example.com/a:b\ndraft: false\ntags:\n  - one\n  - two\n---\n',
    );
    const data = parseFrontmatter(file);
    assert.equal(data.title, "A: quoted title");
    assert.equal(data.canonical, "https://example.com/a:b");
    assert.equal(data.draft, false);
    assert.deepEqual(data.tags, ["one", "two"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("parseFrontmatter returns {} for missing frontmatter", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "noveno-sitemap-"));
  try {
    const file = path.join(dir, "x.md");
    fs.writeFileSync(file, "no frontmatter here\n");
    assert.deepEqual(parseFrontmatter(file), {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
