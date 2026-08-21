import { test } from "node:test";
import assert from "node:assert/strict";

import { initWorkFilter } from "../src/scripts/work-filter.ts";

class FakeEl {
  constructor(tag, attrs = {}) {
    this.tagName = tag;
    this._attrs = new Map(Object.entries(attrs));
    this.hidden = false;
    this.children = [];
    this._handlers = {};
  }
  getAttribute(k) {
    return this._attrs.get(k) ?? null;
  }
  setAttribute(k, v) {
    this._attrs.set(k, String(v));
  }
  hasAttribute(k) {
    return this._attrs.has(k);
  }
  addEventListener(type, fn) {
    (this._handlers[type] ??= []).push(fn);
  }
  dispatchEvent(type) {
    for (const fn of this._handlers[type] ?? []) fn({ target: this });
  }
  querySelectorAll(sel) {
    const m = sel.match(/\[data-industry-filter\]/)
      ? "filter"
      : sel.match(/\[data-industry\]/)
        ? "row"
        : null;
    if (m === "filter") return this._filterButtons ?? [];
    if (m === "row") return globalThis.__rows ?? [];
    return [];
  }
}

function makeEnv(initialUrl = "https://noveno.ir/work") {
  const historyCalls = [];
  globalThis.location = new URL(initialUrl);
  globalThis.history = {
    replaceState: (_a, _b, url) => {
      historyCalls.push(String(url));
      globalThis.location = new URL(String(url));
    },
  };
  globalThis.document = {
    querySelectorAll: (sel) => {
      if (sel === "[data-industry]") return globalThis.__rows;
      return [];
    },
    getElementById: (id) => {
      if (id === "work-empty") return globalThis.__empty;
      return null;
    },
  };
  return { historyCalls };
}

test("work industry filter hides non-matching rows and updates URL", () => {
  const btnAll = new FakeEl("button", { "data-industry-filter": "all", "aria-pressed": "true" });
  const btnA = new FakeEl("button", { "data-industry-filter": "رستوران و کافه", "aria-pressed": "false" });
  const btnB = new FakeEl("button", {
    "data-industry-filter": "آموزش زبان و آیلتس",
    "aria-pressed": "false",
  });
  const rowA = new FakeEl("div", { "data-industry": "رستوران و کافه" });
  const rowB = new FakeEl("div", { "data-industry": "آموزش زبان و آیلتس" });
  const rowC = new FakeEl("div", { "data-industry": "رستوران و کافه" });
  const empty = new FakeEl("div");
  empty.hidden = true;
  globalThis.__rows = [rowA, rowB, rowC];
  globalThis.__empty = empty;
  const root = new FakeEl("div");
  root._filterButtons = [btnAll, btnA, btnB];
  const env = makeEnv("https://noveno.ir/work");
  initWorkFilter(root);
  // initial all visible
  assert.equal(rowA.hidden, false);
  assert.equal(rowB.hidden, false);
  assert.equal(btnAll.getAttribute("aria-pressed"), "true");
  // click industry
  btnA.dispatchEvent("click");
  assert.equal(rowA.hidden, false);
  assert.equal(rowC.hidden, false);
  assert.equal(rowB.hidden, true);
  assert.equal(btnA.getAttribute("aria-pressed"), "true");
  assert.ok(env.historyCalls.some((u) => u.includes("industry=")));
  // invalid param falls back to all
  makeEnv("https://noveno.ir/work?industry=unknown");
  globalThis.__rows = [rowA, rowB, rowC];
  globalThis.__empty = empty;
  const root2 = new FakeEl("div");
  root2._filterButtons = [btnAll, btnA, btnB];
  initWorkFilter(root2);
  assert.equal(rowA.hidden, false);
  assert.equal(rowB.hidden, false);
});

test("work filter empty state shows when no rows match", () => {
  const btnAll = new FakeEl("button", { "data-industry-filter": "all" });
  const btnA = new FakeEl("button", { "data-industry-filter": "رستوران و کافه" });
  const row = new FakeEl("div", { "data-industry": "آموزش زبان و آیلتس" });
  const empty = new FakeEl("div");
  empty.hidden = true;
  globalThis.__rows = [row];
  globalThis.__empty = empty;
  const root = new FakeEl("div");
  root._filterButtons = [btnAll, btnA];
  makeEnv(
    "https://noveno.ir/work?industry=%D8%B1%D8%B3%D8%AA%D9%88%D8%B1%D8%A7%D9%86%20%D9%88%20%DA%A9%D8%A7%D9%81%D9%87",
  );
  initWorkFilter(root);
  assert.equal(empty.hidden, false, "empty should show when single row filtered out");
});
