// Blog content honesty + publishing-gate tests (product-led pass).
// The blog collection is a publishing surface: metadata must be
// complete enough for SEO (title/description/date/category), drafts
// must be gated consistently (this mirrors the same frontmatter the
// build, index, article pages, sitemap and OG generator read), and no
// fabricated authority signals (fake authors, fake dates, keyword
// stuffing) may enter.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import YAML from "yaml";

const contentDir = path.resolve(import.meta.dirname, "..", "src", "content", "blog");

function parseFrontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  assert.ok(match, `${file}: missing frontmatter`);
  const data = YAML.parse(match[1]);
  assert.ok(data && typeof data === "object", `${file}: frontmatter is not a YAML mapping`);
  return data;
}

const entries = fs
  .readdirSync(contentDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ file: f, data: parseFrontmatter(path.join(contentDir, f)) }));

const published = entries.filter((e) => !e.data.draft);

test("blog collection exists with the draft fixture in place", () => {
  assert.ok(entries.length >= 1, "no blog entries found");
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

test("frontmatter parser handles YAML arrays and quoted colons", () => {
  // defect-sensitivity probe: the old regex parser could not represent YAML
  // arrays or quoted values containing colons; this test fails against it.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "noveno-blog-"));
  const file = path.join(tmpDir, "probe.md");
  try {
    fs.writeFileSync(
      file,
      "---\ntitle: \"A: quoted title\"\ntags:\n  - one\n  - two\n---\n",
      "utf8",
    );
    const parsed = parseFrontmatter(file);
    assert.deepEqual(parsed.tags, ["one", "two"]);
    assert.equal(parsed.title, "A: quoted title");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("rss feed exists, is valid RSS 2.0, and excludes drafts (plan 029)", () => {
  const distRss = path.resolve(import.meta.dirname, "..", "dist", "rss.xml");
  if (!fs.existsSync(distRss)) {
    // Allow test to be skipped when dist not built (e.g. verify-affected without full gate)
    // but in full gate it must exist.
    if (process.env.CI || fs.existsSync(path.resolve(import.meta.dirname, "..", "dist", "blog", "index.html"))) {
      assert.fail("dist/rss.xml missing — run npm run build");
    }
    return;
  }
  const feed = fs.readFileSync(distRss, "utf8");
  assert.match(feed, /<rss[^>]*version="2.0"/, "must be RSS 2.0");
  assert.match(feed, /<language>fa<\/language>/, "must have fa language");
  for (const p of published) {
    const slug = p.file.replace(/\.md$/, "");
    assert.ok(feed.includes(`/blog/${slug}/`), `published ${slug} must be in feed`);
  }
  const drafts = entries.filter((e) => e.data.draft);
  for (const d of drafts) {
    const slug = d.file.replace(/\.md$/, "");
    assert.ok(!feed.includes(`/blog/${slug}/`), `draft ${slug} must not be in feed`);
  }
  // discovery link
  const blogHtml = fs.readFileSync(path.resolve(import.meta.dirname, "..", "dist", "blog", "index.html"), "utf8");
  assert.ok(blogHtml.includes('href="/rss.xml"') && blogHtml.includes('application/rss+xml'), "blog must expose RSS discovery link");
});
