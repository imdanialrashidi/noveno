// Content honesty tests (QUALITY invariant 3, plan §5.2/§10).
// Parse the work collection frontmatter directly (no Astro runtime) and
// assert the proof-semantics contract: metrics require verified+source,
// concepts never carry metrics, projects carry an honest outcome, and
// no fabricated entry shapes can pass.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const contentDir = path.resolve(import.meta.dirname, "..", "src", "content", "work");

function parseFrontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  assert.ok(match, `${file}: missing frontmatter`);
  const body = match[1];
  const data = {};
  const lines = body.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "") { i += 1; continue; }
    const keyMatch = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!keyMatch) { i += 1; continue; }
    const [, key, rest] = keyMatch;
    if (rest.startsWith("{")) {
      // inline map: { name: "...", public: false }
      const obj = {};
      for (const pair of rest.slice(1, -1).split(",")) {
        const [k, ...v] = pair.split(":");
        const value = v.join(":").trim().replace(/^"|"$/g, "");
        obj[k.trim()] = value === "true" ? true : value === "false" ? false : value;
      }
      data[key] = obj;
    } else if (rest.startsWith("[")) {
      // inline array
      data[key] = rest
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    } else if (rest === "") {
      // block scalar: either a list ("- item") or a map ("key: value")
      const values = [];
      const obj = {};
      let isMap = false;
      i += 1;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
        const raw = lines[i].trim();
        const mapMatch = /^([a-z_]+):\s*(.*)$/.exec(raw);
        if (mapMatch && !raw.startsWith("-")) {
          isMap = true;
          const [, k, v] = mapMatch;
          obj[k] = v === "true" ? true : v === "false" ? false : v.replace(/^"|"$/g, "");
        } else {
          values.push(raw.replace(/^-\s*/, ""));
        }
        i += 1;
      }
      data[key] = isMap ? obj : values;
    } else {
      data[key] = rest.replace(/^"|"$/g, "");
      i += 1;
    }
  }
  return data;
}

const entries = fs
  .readdirSync(contentDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ file: f, data: parseFrontmatter(path.join(contentDir, f)) }));

test("work collection has at least one entry", () => {
  assert.ok(entries.length >= 1, "no content entries found");
});

test("every entry has a valid proof type", () => {
  for (const { file, data } of entries) {
    assert.ok(["case-study", "project", "concept"].includes(data.type), `${file}: invalid type`);
  }
});

test("metrics are evidence-bound: verified=true + source required", () => {
  for (const { file, data } of entries) {
    for (const metric of data.metrics ?? []) {
      assert.ok(metric.source, `${file}: metric without source`);
      assert.ok(metric.verified === true, `${file}: metric missing verified: true`);
    }
  }
});

test("concepts never carry measured metrics", () => {
  for (const { file, data } of entries) {
    if (data.type === "concept") {
      assert.ok(!data.metrics || data.metrics.length === 0, `${file}: concept has metrics`);
      assert.ok(Array.isArray(data.goals) && data.goals.length > 0, `${file}: concept needs design goals`);
      assert.ok(Array.isArray(data.kpis) && data.kpis.length > 0, `${file}: concept needs proposed KPIs`);
      if (data.client) assert.equal(data.client.public, false, `${file}: concept client must be non-public`);
    }
  }
});

test("projects declare an honest outcome marker", () => {
  for (const { file, data } of entries) {
    if (data.type === "project") {
      assert.ok(["measuring", "unknown"].includes(data.outcome), `${file}: invalid project outcome`);
    }
  }
});

test("case studies require a public real client", () => {
  for (const { file, data } of entries) {
    if (data.type === "case-study") {
      assert.ok(data.client, `${file}: case study needs a client`);
      assert.equal(data.client.public, true, `${file}: case study client must be public`);
    }
  }
});

test("required fields are present on every entry", () => {
  for (const { file, data } of entries) {
    for (const field of ["title", "industry", "summary", "published_at"]) {
      assert.ok(data[field], `${file}: missing ${field}`);
    }
  }
});

test("no sales-guarantee or hype language in copy (Spec §52.1)", () => {
  const banned = [
    "تضمین فروش",
    "رشد انفجاری",
    "چند برابر کردن فروش",
    "بهترین آژانس",
    "متحول کردن",
    "انقلابی",
    "جادویی",
  ];
  for (const { file } of entries) {
    const raw = fs.readFileSync(path.join(contentDir, file), "utf8");
    for (const phrase of banned) {
      assert.ok(!raw.includes(phrase), `${file}: banned hype phrase "${phrase}"`);
    }
  }
});
