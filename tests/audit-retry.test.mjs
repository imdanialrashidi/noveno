/**
 * Audit client journey tests (static GitHub Pages architecture, 2026-10).
 *
 * The site has no server boundary: the browser validates the values and
 * posts the sanitized lead straight to Web3Forms. Success is only ever
 * `{ success: true }` from Web3Forms — the visitor reaches thank-you, the
 * draft is cleared, and `audit_submitted` fires only then.
 *
 * Delivery failure (network/timeout/non-2xx/{ success: false }/429): stay
 * on /audit, keep the draft + stable submission_id, show a truthful
 * recoverable banner with direct-contact fallback, and allow retry.
 *
 * This suite drives the REAL client state machine (src/scripts/audit.ts)
 * through a deterministic fake DOM + scriptable fetch. Defect-sensitive:
 * the failure tests fail on any "thank-you anyway" behavior or a second
 * delivery path (/api/audit) creeping back in.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { initAudit } from "../src/scripts/audit.ts";
import { AUDIT_OPTIONS } from "../src/data/audit.ts";

/** Display label for a client enum id — source of truth in src/data/audit.ts. */
function labelFor(group, id) {
  return AUDIT_OPTIONS[group].find((option) => option.id === id).label;
}

function joinedLabels(group, ids) {
  return ids.map((id) => labelFor(group, id)).join("، ");
}

/* ------------------------------------------------------------------ */
/* Minimal deterministic fake DOM (attribute selectors only — the      */
/* exact selector grammar used by src/scripts/audit.ts)                */
/* ------------------------------------------------------------------ */

class FakeEl {
  constructor(tag, attrs = {}, children = []) {
    this.tagName = String(tag).toUpperCase();
    this._attrs = new Map(Object.entries(attrs).filter(([, v]) => v !== undefined));
    this._handlers = {};
    this.children = [];
    this.parent = null;
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.disabled = false;
    this.innerHTML = "";
    this.style = {};
    this.id = this._attrs.get("id") ?? "";
    for (const child of children) this.append(child);
  }

  append(child) {
    child.parent = this;
    this.children.push(child);
  }

  appendChild(child) {
    this.append(child);
  }

  setAttribute(key, value) {
    this._attrs.set(key, String(value));
  }

  getAttribute(key) {
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  hasAttribute(key) {
    return this._attrs.has(key);
  }

  removeAttribute(key) {
    this._attrs.delete(key);
  }

  addEventListener(type, fn) {
    (this._handlers[type] ??= []).push(fn);
  }

  dispatchEvent(type, event = {}) {
    for (const fn of this._handlers[type] ?? []) fn(event);
  }

  querySelectorAll(selector) {
    return matches(this, parseSelector(selector));
  }

  querySelector(selector) {
    return matches(this, parseSelector(selector))[0] ?? null;
  }

  closest(selector) {
    const parts = parseSelector(selector);
    let node = this;
    while (node) {
      if (
        parts.every((p) =>
          p.value === null ? node.hasAttribute(p.attr) : node.getAttribute(p.attr) === p.value,
        )
      ) {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  focus() {
    /* noop — the journey only calls focus() on headings/errors */
  }

  createElement(tag) {
    return new FakeEl(tag);
  }
}

/** `[a][b="v"]` → [{ attr, value }] (null value = presence-only). */
function parseSelector(selector) {
  const parts = [];
  for (const match of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    parts.push({ attr: match[1], value: match[2] ?? null });
  }
  return parts;
}

function matches(root, parts) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (
        parts.every((p) =>
          p.value === null ? child.hasAttribute(p.attr) : child.getAttribute(p.attr) === p.value,
        )
      ) {
        out.push(child);
      }
      walk(child);
    }
  };
  walk(root);
  return out;
}

/** Build the /audit page shell the state machine actually queries. */
function buildAuditDom() {
  const el = (tag, attrs = {}, children = []) => new FakeEl(tag, attrs, children);
  const doc = el("html", { "data-theme": "light" });
  const head = el("head");
  const body = el("body");
  doc.append(head);
  doc.append(body);

  // NOTE (2026-10 focus pass): the first-contact form is ONE screen.
  // The harness mirrors the real page — no step rail, no step counter,
  // no progress bar, no back button, no per-step review summary. The
  // state machine must therefore work with all of those handles absent.

  // Banner with all block kinds + retry buttons
  const banner = el("div", { id: "audit-banner", role: "alert", hidden: true });
  for (const kind of ["network", "offline", "rate", "validation", "unconfigured", "delivery"]) {
    const block = el("div", { "data-banner": kind, hidden: true });
    if (kind === "network" || kind === "offline" || kind === "delivery") {
      block.append(el("button", { type: "button", "data-retry": "" }));
    }
    banner.append(block);
  }
  body.append(banner);

  // Form card
  const form = el("form", { id: "audit-form", novalidate: true });
  form.append(el("input", { "data-honeypot": "", type: "text", name: "company_website" }));

  const field = (id, kind, options = []) => {
    const wrap = el("div", kind === "multiselect" ? { "data-save": id, "data-multiselect": "" } : {});
    if (kind === "multiselect") {
      const group = el("div", { "data-chip-group": "" });
      for (const option of options) {
        group.append(
          el("button", {
            type: "button",
            "data-chip": option,
            "data-group": id,
            "aria-checked": "false",
          }),
        );
      }
      wrap.append(group);
    } else {
      const input = el(kind === "select" ? "select" : "input", { id, "data-save": id });
      wrap.append(input);
    }
    const error = el("p", { id: `${id}-error`, hidden: true }, [el("span", { "data-error-text": "" })]);
    wrap.append(error);
    return wrap;
  };

  const steps = [
    {
      id: "lead",
      fields: [
        ["name", "text"],
        ["phone", "text"],
        ["industry", "select"],
        ["website", "text"],
        ["primary_problem", "select"],
      ],
    },
  ];

  steps.forEach((step, index) => {
    const section = el("section", { "data-step-section": step.id, hidden: index !== 0 });
    section.append(el("h2", { id: `step-${step.id}-title`, tabindex: "-1" }));
    for (const [id, kind, options] of step.fields) {
      section.append(field(id, kind, options ?? []));
    }
    form.append(section);
  });

  form.append(el("button", { type: "button", id: "audit-next", disabled: true }));
  body.append(form);

  body.append(el("p", { id: "step-announce", "aria-live": "polite" }));

  // id registry for getElementById
  const byId = new Map();
  const collect = (node) => {
    if (node.id) byId.set(node.id, node);
    for (const child of node.children) collect(child);
  };
  collect(doc);
  doc.documentElement = doc;
  doc.head = head;
  doc.getElementById = (id) => byId.get(id) ?? null;

  return {
    document: doc,
    head,
    byId,
    getElementById: (id) => byId.get(id) ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Environment shims                                                    */
/* ------------------------------------------------------------------ */

class FakeMutationObserver {
  constructor(_callback) {}
  observe() {}
  disconnect() {}
}

/**
 * Scriptable fetch: only the Web3Forms endpoint is expected. Its behavior
 * is driven by `web3formsMode` (mutable mid-test) so a retry can succeed:
 *   ok      → 200 { success: true }
 *   fail    → 500 { success: false }          (non-2xx)
 *   badbody → 200 { success: false }           (API-level rejection)
 *   rate    → 429 { success: false }           (rate limit)
 *   throw   → network TypeError (every attempt)
 *   silent  → 200 unreadable body
 * Any other request is recorded and answered with 200 so a stray server
 * hop is still visible in the assertions.
 */
function installGlobals({ onLine = true, web3formsMode = "ok" } = {}) {
  const session = new Map();
  const nav = [];
  const externalCalls = [];
  const beacons = [];
  const state = { web3formsMode };

  globalThis.location = { search: "", pathname: "/audit", assign: (url) => nav.push(url) };
  globalThis.sessionStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
  };
  Object.defineProperty(globalThis, "navigator", {
    value: {
      onLine,
      sendBeacon: (url, body) => {
        beacons.push({ url, body });
        return true;
      },
    },
    configurable: true,
    writable: true,
  });
  globalThis.MutationObserver = FakeMutationObserver;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.fetch = async (url, opts = {}) => {
    const parsed = typeof url === "string" ? url : url.url;
    externalCalls.push({ url: parsed, method: opts.method ?? "GET", body: String(opts.body ?? "") });
    if (parsed.startsWith("https://api.web3forms.com/")) {
      switch (state.web3formsMode) {
        case "fail":
          return { ok: false, status: 500, json: async () => ({ success: false }) };
        case "badbody":
          return { ok: true, status: 200, json: async () => ({ success: false }) };
        case "rate":
          return {
            ok: false,
            status: 429,
            json: async () => ({ success: false, message: "Too many requests. Please try later!" }),
          };
        case "throw":
          throw new TypeError("Failed to fetch");
        case "silent":
          return {
            ok: true,
            status: 200,
            json: async () => {
              throw new Error("unreadable");
            },
          };
        default:
          return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  globalThis.window = globalThis;
  window.addEventListener = () => {};
  window.clearTimeout = clearTimeout;
  window.setTimeout = setTimeout;

  return { externalCalls, beacons, nav, session, state };
}

/* ------------------------------------------------------------------ */
/* Journey helpers                                                      */
/* ------------------------------------------------------------------ */

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Real-time wait — needed for the 800ms analytics flush timer. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setField(dom, id, value) {
  const el = dom.getElementById(id);
  el.value = value;
  el.dispatchEvent("change", { target: el });
  dom.getElementById("audit-form").dispatchEvent("input", { target: el });
}

function selectChip(dom, id) {
  const chip = dom
    .getElementById("audit-form")
    .querySelector(`[data-chip][data-group="acquisition_channels"][data-chip="${id}"]`);
  chip.dispatchEvent("click");
  dom.getElementById("audit-form").dispatchEvent("input", { target: chip });
}

/**
 * Fill the single-screen lead form the way a visitor does: five fields,
 * one click on «ثبت درخواست بررسی». There are no intermediate steps.
 */
async function fillLeadForm(dom, overrides = {}) {
  const values = {
    name: "علی رضایی",
    phone: "۰۹۱۰۲۲۵۶۹۸۶",
    industry: "restaurant_cafe",
    website: "https://example.com",
    primary_problem: "scattered_lost",
    ...overrides,
  };
  for (const [id, value] of Object.entries(values)) {
    if (value === null) continue;
    setField(dom, id, value);
  }
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
}

/** Legacy alias — the journey helper name used by the delivery tests. */
const walkToContactStep = fillLeadForm;

function bannerBlock(dom, kind) {
  return [...dom.byId.get("audit-banner").children].find((c) => c.getAttribute("data-banner") === kind);
}

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

const OK_CONFIG = { web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" };

function web3Posts(env) {
  return env.externalCalls.filter((c) => c.url.startsWith("https://api.web3forms.com/"));
}

function draftOf(env) {
  const raw = env.session.get("noveno:audit:draft");
  return raw ? JSON.parse(raw) : null;
}

test("static submit: exactly one Web3Forms POST, no API hop, thank-you only on { success: true }", async () => {
  const env = installGlobals();
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ ...OK_CONFIG });

  await fillLeadForm(dom);
  await sleep(10);

  assert.equal(env.externalCalls.length, 1, "the only network call is the Web3Forms delivery");
  const [post] = web3Posts(env);
  const body = JSON.parse(post.body);
  assert.equal(body.access_key, "wf-test-key");
  assert.equal(body.name, "علی رضایی");
  assert.equal(body.phone, "09102256986", "the phone is normalized before it leaves the browser");
  assert.equal(body.industry, labelFor("industry", "restaurant_cafe"));
  assert.equal(body.primary_problem, labelFor("problems", "scattered_lost"));
  assert.ok(body.submission_id, "every lead carries a submission id");
  assert.ok(!("cf_turnstile_token" in body), "no Turnstile token may be sent anymore");
  assert.ok(!("validation_receipt" in body), "no server receipt exists on static hosting");
  assert.equal(body.botcheck, "");

  assert.deepEqual(env.nav, ["/audit/thank-you"], "success navigates to thank-you exactly once");
  assert.equal(env.session.has("noveno:audit:draft"), false, "draft clears only after confirmed success");
  assert.ok(env.session.has("noveno:audit:done"), "the done marker is recorded");
});

test("delivery failure keeps the visitor on /audit with values, then retry reuses submission_id", async () => {
  const env = installGlobals({ web3formsMode: "fail" });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ ...OK_CONFIG });

  await fillLeadForm(dom);
  await sleep(10);

  assert.equal(web3Posts(env).length, 2, "bounded delivery retry: two attempts, then stop");
  assert.equal(bannerBlock(dom, "delivery").hidden, false, "a truthful delivery banner is shown");
  assert.equal(dom.getElementById("audit-next").disabled, false, "the submit button is not left stuck");
  assert.equal(env.nav.length, 0, "no navigation without confirmed delivery");

  const draft = draftOf(env);
  assert.ok(draft, "the draft survives the failure");
  assert.equal(draft.values.name, "علی رضایی", "values are preserved");
  const submissionId = draft.submission_id;

  env.state.web3formsMode = "ok";
  bannerBlock(dom, "delivery").querySelector("[data-retry]").dispatchEvent("click");
  await sleep(10);

  assert.equal(web3Posts(env).length, 3, "retry issues one more delivery attempt");
  assert.equal(JSON.parse(web3Posts(env)[2].body).submission_id, submissionId, "submission_id stays stable");
  assert.deepEqual(env.nav, ["/audit/thank-you"]);
});

test("200 with { success: false } is a failure, never a success", async () => {
  const env = installGlobals({ web3formsMode: "badbody" });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ ...OK_CONFIG });

  await fillLeadForm(dom);
  await sleep(10);

  assert.equal(bannerBlock(dom, "delivery").hidden, false);
  assert.equal(env.nav.length, 0, "an API-level rejection must not navigate");
  assert.ok(env.session.has("noveno:audit:draft"));
});

test("rate limit shows the rate banner and keeps the lead recoverable", async () => {
  const env = installGlobals({ web3formsMode: "rate" });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ ...OK_CONFIG });

  await fillLeadForm(dom);
  await sleep(10);

  assert.equal(bannerBlock(dom, "rate").hidden, false);
  assert.equal(env.nav.length, 0);
  assert.ok(env.session.has("noveno:audit:draft"));
});

test("network failure is reported as a delivery failure after the bounded retry", async () => {
  const env = installGlobals({ web3formsMode: "throw" });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ ...OK_CONFIG });

  await fillLeadForm(dom);
  await sleep(10);

  assert.equal(web3Posts(env).length, 2, "one initial attempt plus one retry, never more");
  assert.equal(bannerBlock(dom, "delivery").hidden, false);
  assert.equal(env.nav.length, 0);
});

test("unconfigured build explains itself instead of pretending to send", async () => {
  const env = installGlobals();
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ web3formsKey: "", web3formsUrl: "https://api.web3forms.com/submit" });

  await fillLeadForm(dom);
  await sleep(10);

  assert.equal(env.externalCalls.length, 0, "no request without an access key");
  assert.equal(bannerBlock(dom, "unconfigured").hidden, false);
  assert.equal(env.nav.length, 0);
});

test("a filled honeypot is dropped silently: no delivery, no banner, no navigation", async () => {
  const env = installGlobals();
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ ...OK_CONFIG });
  dom.getElementById("audit-form").querySelector("[data-honeypot]").value = "https://spam.example";

  await fillLeadForm(dom);
  await sleep(10);

  assert.equal(env.externalCalls.length, 0, "bots get no delivery");
  assert.equal(env.nav.length, 0, "bots never reach thank-you");
  assert.equal(env.beacons.length, 0, "bots never fire audit_submitted");
});
