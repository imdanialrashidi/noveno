// Insights content honesty + publishing-gate tests (product-led pass).
// The insights collection is a publishing surface: metadata must be
// complete enough for SEO (title/description/date/category), drafts
// must be gated consistently (this mirrors the same frontmatter the
// build, index, article pages, sitemap and OG generator read), and no
// fabricated authority signals (fake authors, fake dates, keyword
// stuffing) may enter.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const contentDir = path.resolve(import.meta.dirname, "..", "src", "content", "insights");

function parseFrontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  assert.ok(match, `${file}: missing frontmatter`);
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim().replace(/^"|"$/g, "");
    data[key] = value === "true" ? true : value === "false" ? false : value;
  }
  return data;
}

const entries = fs
  .readdirSync(contentDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ file: f, data: parseFrontmatter(path.join(contentDir, f)) }));

const published = entries.filter((e) => !e.data.draft);

test("insights collection exists with the draft fixture in place", () => {
  assert.ok(entries.length >= 1, "no insights entries found");
  const draftFixture = entries.find((e) => e.file === "draft-sample.md");
  assert.ok(draftFixture, "draft-sample.md fixture must exist (draft-exclusion regression)");
  assert.equal(draftFixture.data.draft, true, "draft-sample.md must stay a draft");
});

test("every published article carries the SEO-critical metadata", () => {
  assert.ok(published.length >= 1, "at least one published article expected");
  for (const { file, data } of published) {
    assert.ok(typeof data.title === "string" && data.title.length >= 3, `${file}: title`);
    assert.ok(
      typeof data.description === "string" && data.description.length >= 20,
      `${file}: description too short (SEO surface)`,
    );
    assert.ok(data.published_at && !Number.isNaN(new Date(data.published_at).valueOf()), `${file}: published_at`);
    assert.ok(typeof data.category === "string" && data.category.length >= 2, `${file}: category`);
    assert.ok(typeof data.author === "string" && data.author.length >= 2, `${file}: author`);
  }
});

test("no published article carries a future publication date", () => {
  const now = Date.now();
  for (const { file, data } of published) {
    assert.ok(
      new Date(data.published_at).valueOf() <= now + 86_400_000,
      `${file}: published_at is in the future`,
    );
  }
});

test("no keyword-stuffed or duplicate titles/descriptions", () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const { file, data } of published) {
    assert.ok(!titles.has(data.title), `duplicate title in ${file}`);
    assert.ok(!descriptions.has(data.description), `duplicate description in ${file}`);
    titles.add(data.title);
    descriptions.add(data.description);
    // crude stuffing signal: the phrase must not repeat itself
    const words = data.title.split(/\s+/);
    assert.ok(
      new Set(words).size >= words.length * 0.6,
      `${file}: title looks keyword-stuffed (repetitive words)`,
    );
  }
});

test("article body is real Markdown content, not a placeholder", () => {
  for (const { file } of published) {
    const raw = fs.readFileSync(path.join(contentDir, file), "utf8");
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
    assert.ok(body.split(/\s+/).filter(Boolean).length >= 150, `${file}: body too thin (content-farm guard)`);
  }
});
