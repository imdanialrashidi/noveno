/**
 * Audit client retry regression — the production path that escaped the
 * independent /design-review.
 *
 * Confirmed defect: on /audit, after a recoverable submission/network
 * failure with Turnstile configured, the banner «تلاش دوباره» threw
 * `TypeError: bridge.retry is not a function` (TurnstileBridge exposed
 * no `retry` capability), so the retry control performed no recovery.
 *
 * This suite drives the REAL client state machine (src/scripts/audit.ts)
 * through a deterministic fake DOM + mock Turnstile widget + scriptable
 * fetch, with Turnstile configured — not the bridge-null or local-empty
 * key path. It proves the full recovery journey:
 *
 *   recoverable failure → retry → fresh anti-bot state → same
 *   submission_id + preserved values → new /api/audit request →
 *   success → /audit/thank-you
 *
 * Defect sensitivity: the first test fails on the pre-fix behavior with the
 * exact TypeError the design review reproduced (the retry click handler
 * throws synchronously because TurnstileBridge exposes no `retry`). Red
 * evidence was captured against the defective module (imports/constructor
 * already converted to the node-loadable form below — behavior-neutral
 * prerequisites — with `retry()` absent). The second test pins the
 * script-load-failure "fresh chance" half of the retry contract.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { initAudit } from "../src/scripts/audit.ts";

/* ------------------------------------------------------------------ */
/* Minimal deterministic fake DOM (attribute selectors only — the      */
/* exact selector grammar used by src/scripts/audit.ts)                */
/* ------------------------------------------------------------------ */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

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
      if (parts.every((p) => p.value === null ? node.hasAttribute(p.attr) : node.getAttribute(p.attr) === p.value)) {
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
      if (parts.every((p) => p.value === null ? child.hasAttribute(p.attr) : child.getAttribute(p.attr) === p.value)) {
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

  // Stepper rail (StepperLine + explainer on surface-soft)
  const rail = el("aside", { "aria-label": "راهنمای بررسی" });
  const railSoft = el("div", { class: "bg-surface-soft" });
  railSoft.append(
    ...[1, 2, 3, 4, 5, 6].map((n) =>
      el("li", { "data-stepper-station": String(n), "data-state": n === 1 ? "current" : "upcoming" },
        [el("span", { class: "stepper-label" }, [el("span", { "data-stepper-label": String(n) })])]),
    ),
  );
  const mobileBar = el("div", { class: "lg:hidden" });
  mobileBar.append(
    el("span", { "data-stepper-counter": "" }),
    el("span", { "data-stepper-current": "" }),
    el("span", { "data-stepper-bar": "" }),
  );
  rail.append(railSoft, mobileBar);
  body.append(rail);

  // Banner with the six block kinds + retry buttons
  const banner = el("div", { id: "audit-banner", role: "alert", hidden: true });
  for (const kind of ["network", "offline", "turnstile", "rate", "validation", "unconfigured"]) {
    const block = el("div", { "data-banner": kind, hidden: true });
    if (kind === "network" || kind === "offline" || kind === "turnstile") {
      block.append(el("button", { type: "button", "data-retry": "" }));
    }
    banner.append(block);
  }
  body.append(banner);

  // Form card
  const form = el("form", { id: "audit-form", novalidate: true });
  form.append(el("input", { "data-honeypot": "", type: "text", name: "company_website" }));

  const field = (id, kind, options = []) => {
    const wrap = el("div");
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
    const error = el("p", { id: `${id}-error`, hidden: true }, [
      el("span", { "data-error-text": "" }),
    ]);
    wrap.append(error);
    return wrap;
  };

  const steps = [
    { id: "business", fields: [
      ["business_name", "text"], ["industry", "select"], ["website", "text"],
    ] },
    { id: "channels", fields: [
      ["acquisition_channels", "multiselect", ["instagram", "google", "advertising", "referral", "in_person", "website", "other"]],
    ] },
    { id: "problem", fields: [["primary_problem", "select"]] },
    { id: "value", fields: [["customer_value_range", "select"]] },
    { id: "need", fields: [["requested_service", "select"]] },
    { id: "contact", fields: [
      ["name", "text"], ["phone", "text"], ["preferred_contact", "select"], ["email", "text"],
    ] },
  ];

  steps.forEach((step, index) => {
    const section = el("section", { "data-step-section": step.id, hidden: index !== 0 });
    section.append(el("h2", { id: `step-${step.id}-title`, tabindex: "-1" }));
    for (const [id, kind, options] of step.fields) {
      section.append(field(id, kind, options ?? []));
    }
    form.append(section);
  });

  form.append(el("div", { id: "turnstile-container", class: "mt-6" }));
  form.append(el("button", { type: "button", id: "audit-back", hidden: true }));
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

function makeTurnstileMock() {
  const mock = {
    renders: 0,
    resets: 0,
    removes: 0,
    options: null,
    widgetId: "w-1",
    render(_container, options) {
      this.renders += 1;
      this.options = options;
      return this.widgetId;
    },
    reset() {
      this.resets += 1;
    },
    remove() {
      this.removes += 1;
    },
    emitToken(value) {
      this.options.callback(value);
    },
  };
  return mock;
}

class FakeMutationObserver {
  constructor(_callback) {}
  observe() {}
  disconnect() {}
}

function installGlobals({ turnstile, fetchImpl, onLine = true }) {
  const session = new Map();
  const nav = [];
  const auditCalls = [];

  globalThis.location = { search: "", pathname: "/audit", assign: (url) => nav.push(url) };
  globalThis.sessionStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
  };
  // node 22 defines a global navigator; replace it defensively.
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine, sendBeacon: () => true },
    configurable: true,
    writable: true,
  });
  globalThis.MutationObserver = FakeMutationObserver;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.fetch = async (url, opts = {}) => {
    const parsed = typeof url === "string" ? url : url.url;
    if (parsed === "/api/audit") {
      auditCalls.push(JSON.parse(String(opts.body)));
      return fetchImpl.shift()();
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  globalThis.window = globalThis;
  window.turnstile = turnstile;
  window.addEventListener = () => {};
  window.clearTimeout = clearTimeout;
  window.setTimeout = setTimeout;

  return { auditCalls, nav, session };
}

function okResponse() {
  return { ok: true, status: 200, json: async () => ({}) };
}

/** The audit script's Turnstile loader appends <script> to document.head;
 *  tests fire its onload/onerror to simulate script availability. */
function captureScripts() {
  const scripts = [];
  const originalCreate = document.createElement.bind(document);
  document.createElement = (tag) => {
    if (tag !== "script") return originalCreate(tag);
    const script = new FakeEl("script");
    scripts.push(script);
    return script;
  };
  return scripts;
}

/* ------------------------------------------------------------------ */
/* Journey helpers                                                      */
/* ------------------------------------------------------------------ */

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setField(dom, id, value) {
  const el = dom.getElementById(id);
  el.value = value;
  el.dispatchEvent("change", { target: el });
  dom.getElementById("audit-form").dispatchEvent("input", { target: el });
}

function selectChip(dom, id) {
  const chip = dom.getElementById("audit-form")
    .querySelector(`[data-chip][data-group="acquisition_channels"][data-chip="${id}"]`);
  chip.dispatchEvent("click"); // the chip handler toggles aria-checked and saves
  dom.getElementById("audit-form").dispatchEvent("input", { target: chip });
}

async function walkToContactStep(dom) {
  const form = dom.getElementById("audit-form");
  const next = dom.getElementById("audit-next");

  // Step 1 — business
  setField(dom, "business_name", "کافه نو");
  setField(dom, "industry", "restaurant_cafe");
  setField(dom, "website", "https://example.com");
  next.dispatchEvent("click");

  // Step 2 — channels (multiselect)
  selectChip(dom, "instagram");
  selectChip(dom, "referral");
  next.dispatchEvent("click");

  // Step 3 — problem
  setField(dom, "primary_problem", "scattered_lost");
  next.dispatchEvent("click");

  // Step 4 — value (optional) — skip
  next.dispatchEvent("click");

  // Step 5 — need
  setField(dom, "requested_service", "audit_analysis");
  next.dispatchEvent("click");

  // Step 6 — contact (bridge renders here)
  setField(dom, "name", "علی رضایی");
  setField(dom, "phone", "۰۹۳۵۳۵۹۸۶۲۰");
  setField(dom, "preferred_contact", "whatsapp");
  setField(dom, "email", "ali@example.com");

  await tick();
}

function bannerState(dom) {
  const banner = dom.getElementById("audit-banner");
  return {
    bannerHidden: banner.hidden,
    networkHidden: dom.byId.get("audit-banner").children.find(
      (c) => c.getAttribute("data-banner") === "network",
    ).hidden,
    turnstileHidden: dom.byId.get("audit-banner").children.find(
      (c) => c.getAttribute("data-banner") === "turnstile",
    ).hidden,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

test("retry after a recoverable network failure with Turnstile configured: same submission_id, preserved values, fresh token, new /api/audit request, thank-you", async () => {
  const turnstile = makeTurnstileMock();
  const fetchImpl = [
    () => {
      throw new TypeError("Failed to fetch"); // recoverable network failure
    },
    okResponse, // retry succeeds (shift()() invokes the function)
  ];
  const env = installGlobals({ turnstile, fetchImpl });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "", web3formsUrl: "" });

  await walkToContactStep(dom);
  assert.equal(turnstile.renders, 1, "widget must render once when the contact step becomes current");

  // First submission → recoverable network failure
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();

  assert.equal(env.auditCalls.length, 1, "first submission must issue exactly one /api/audit request");
  assert.equal(env.auditCalls[0].cf_turnstile_token, "token-1");
  const submissionId = env.auditCalls[0].submission_id;
  assert.ok(submissionId, "submission_id must be present");
  const failedState = bannerState(dom);
  assert.equal(failedState.bannerHidden, false, "error banner must be visible after failure");
  assert.equal(failedState.networkHidden, false, "network banner block must be shown for a network failure");
  assert.equal(dom.getElementById("audit-next").disabled, false, "submit must not stay stuck busy");
  assert.equal(env.session.has("noveno:audit:draft"), true, "values must be persisted in the draft after the failure");

  // Retry: must NOT throw, must not reuse the consumed token, must not
  // change submission_id, must preserve values, and must reach thank-you.
  const retryButton = dom.document.querySelector("[data-retry]");
  assert.ok(retryButton, "retry control must exist");
  let retryError = null;
  try {
    retryButton.dispatchEvent("click");
  } catch (error) {
    retryError = error;
  }
  assert.equal(retryError, null, "«تلاش دوباره» must not throw (pre-fix: TypeError bridge.retry is not a function)");
  await tick();
  turnstile.emitToken("token-2"); // fresh challenge for the retry
  await tick();

  assert.equal(env.auditCalls.length, 2, "retry must issue a new /api/audit request");
  assert.equal(env.auditCalls[1].submission_id, submissionId, "submission_id must stay stable across retry");
  assert.notEqual(
    env.auditCalls[1].cf_turnstile_token,
    env.auditCalls[0].cf_turnstile_token,
    "a consumed/invalid Turnstile token must never be reused",
  );
  assert.equal(env.auditCalls[1].cf_turnstile_token, "token-2", "retry must use the fresh token");
  assert.deepEqual(
    { ...env.auditCalls[1], cf_turnstile_token: undefined },
    { ...env.auditCalls[0], cf_turnstile_token: undefined },
    "all field values must remain intact across retry",
  );
  assert.equal(turnstile.resets, 2, "a fresh challenge must be obtained for the retry");

  assert.equal(env.nav.length, 1, "success must navigate exactly once");
  assert.equal(env.nav[0], "/audit/thank-you");
  assert.equal(env.session.has("noveno:audit:draft"), false, "draft must be cleared after confirmed success");
  assert.equal(env.session.get("noveno:audit:done"), submissionId, "done marker must record the submission");
  const successState = bannerState(dom);
  assert.equal(successState.bannerHidden, true, "banner must clear when retry recovery starts");
});

test("retry after a Turnstile script-load failure gets a fresh chance (script re-injected, fresh token, recovery)", async () => {
  // First attempt: widget script cannot load (window.turnstile absent,
  // script.onerror fires) → turnstile banner, no request.
  const turnstile = makeTurnstileMock();
  const fetchImpl = [okResponse];
  const env = installGlobals({ turnstile: undefined, fetchImpl });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  const scripts = captureScripts();

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "", web3formsUrl: "" });

  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  assert.ok(scripts.length >= 1, "Turnstile script must be injected");
  for (const script of scripts) script.onerror(); // script blocked/unreachable
  await tick();

  assert.equal(env.auditCalls.length, 0, "no request may be sent without a token");
  assert.equal(bannerState(dom).turnstileHidden, false, "turnstile failure banner must be shown");

  // Retry with the script STILL unreachable: the bridge must re-inject the
  // script (retry() unlatches scriptFailed) instead of giving up silently.
  const retryButton = dom.document.querySelector("[data-retry]");
  let retryError = null;
  try {
    retryButton.dispatchEvent("click");
  } catch (error) {
    retryError = error;
  }
  assert.equal(retryError, null, "retry must not throw on the script-failure path either");
  await tick();
  const injected = scripts.length;
  assert.ok(injected >= 2, "retry must re-inject the Turnstile script for a fresh chance");
  for (const script of scripts.slice(1)) script.onerror(); // still unreachable → still no request
  await tick();
  assert.equal(env.auditCalls.length, 0, "no request without a token, even after a re-injected script fails");
  assert.equal(bannerState(dom).turnstileHidden, false, "banner must persist while the script is unreachable");

  // Script becomes reachable: another retry must recover end-to-end.
  window.turnstile = turnstile;
  try {
    retryButton.dispatchEvent("click");
  } catch (error) {
    retryError = error;
  }
  assert.equal(retryError, null, "retry must not throw when recovery is possible");
  await tick();
  turnstile.emitToken("token-fresh");
  await tick();

  assert.equal(env.auditCalls.length, 1, "retry must recover with a fresh token and submit");
  assert.equal(env.auditCalls[0].cf_turnstile_token, "token-fresh");
  assert.equal(env.nav[0], "/audit/thank-you");
});
