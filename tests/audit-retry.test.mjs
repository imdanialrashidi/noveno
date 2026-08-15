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

  // Audit progress (AuditProgress/StepperLine — 2026-08-14 redesign:
  // «مرحله X از ۶» counter + current-step label + progress bar; the
  // station rail was removed with the flowchart grammar).
  const rail = el("aside", { "aria-label": "راهنمای بررسی" });
  const progress = el("div");
  for (const attr of ["data-stepper-counter", "data-stepper-current", "data-stepper-bar"]) {
    progress.append(el("span", { [attr]: "" }));
  }
  rail.append(progress);
  body.append(rail);

  // Compact in-card mobile progress (2026-09 pass — same hooks, -mobile)
  const mobileProgress = el("div");
  for (const attr of ["data-stepper-counter-mobile", "data-stepper-current-mobile", "data-stepper-bar-mobile"]) {
    mobileProgress.append(el("span", { [attr]: "" }));
  }
  body.append(mobileProgress);

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

  // Last-step review summary (2026-09 pass) — rows for the answered fields.
  const summary = el("div", { id: "audit-summary", hidden: true });
  for (const row of ["industry", "channels", "problem", "need"]) {
    summary.append(
      el("div", { "data-summary-row": row, hidden: true }, [
        el("span", { ["data-summary-" + row]: "" }),
      ]),
    );
  }
  form.append(summary);

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
  const externalCalls = [];
  const beacons = [];

  globalThis.location = { search: "", pathname: "/audit", assign: (url) => nav.push(url) };
  globalThis.sessionStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
  };
  // node 22 defines a global navigator; replace it defensively. The beacon
  // shim records analytics deliveries so tests can count tracked events.
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
    if (parsed === "/api/audit") {
      auditCalls.push(JSON.parse(String(opts.body)));
      return fetchImpl.shift()();
    }
    // Non-audit requests are observed, not stubbed: the Web3Forms
    // notification must be provable (POST count + lead body).
    externalCalls.push({ url: parsed, method: opts.method ?? "GET", body: String(opts.body ?? "") });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  globalThis.window = globalThis;
  window.turnstile = turnstile;
  window.addEventListener = () => {};
  window.clearTimeout = clearTimeout;
  window.setTimeout = setTimeout;

  return { auditCalls, externalCalls, beacons, nav, session };
}

/** Success mock for the fresh-insert journey: 200 reports status "inserted". */
function okResponse() {
  return { ok: true, status: 200, json: async () => ({ ok: true, id: "lead-1", status: "inserted" }) };
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
  // Progress contract (2026-08-14 redesign): the counter shows the live
  // step, the bar width reflects completed steps.
  assert.equal(
    dom.document.querySelector("[data-stepper-counter]").textContent,
    "مرحله ۶ از ۶",
    "progress counter must announce the current step (۶ از ۶ at contact)",
  );
  assert.equal(
    dom.document.querySelector("[data-stepper-current]").textContent,
    "تماس",
    "progress must show the current step name",
  );

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

test("2026-09 pass: in-card mobile progress stays in sync and the last-step review summary fills from the draft", async () => {
  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [] });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "", web3formsUrl: "" });

  const mobileCounter = dom.document.querySelector("[data-stepper-counter-mobile]");
  const mobileCurrent = dom.document.querySelector("[data-stepper-current-mobile]");
  const mobileBar = dom.document.querySelector("[data-stepper-bar-mobile]");
  assert.ok(mobileCounter && mobileCurrent && mobileBar, "mobile progress hooks must exist");

  // Boot: mobile progress mirrors the desktop rail; summary is hidden;
  // the step heading is NOT focused on a fresh visit (reviewer finding).
  const heading = dom.getElementById("step-business-title");
  let headingFocuses = 0;
  heading.focus = () => { headingFocuses += 1; };
  const channelsHeading = dom.getElementById("step-channels-title");
  let channelsFocuses = 0;
  channelsHeading.focus = () => { channelsFocuses += 1; };
  assert.equal(mobileCounter.textContent, "مرحله ۱ از ۶", "mobile counter at boot");
  assert.equal(mobileCurrent.textContent, "کسب‌وکار", "mobile current label at boot");
  assert.equal(dom.getElementById("audit-summary").hidden, true, "summary hidden before the contact step");
  assert.equal(headingFocuses, 0, "boot must not focus the step heading");

  // Fill step 1 (industry) and advance — heading focus happens on the
  // user-driven step change only.
  dom.getElementById("industry").value = "salon_beauty";
  dom.getElementById("industry").dispatchEvent("change");
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  assert.equal(mobileCounter.textContent, "مرحله ۲ از ۶", "mobile counter follows the step change");
  assert.equal(mobileCurrent.textContent, "کانال‌ها", "mobile current label follows the step change");
  assert.equal(headingFocuses, 0, "boot-time focus must never happen");
  assert.equal(channelsFocuses, 1, "user-driven step change focuses the new heading once");

  // Walk to the contact step with answers everywhere.
  selectChip(dom, "instagram");
  selectChip(dom, "google");
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  setField(dom, "primary_problem", "scattered_lost");
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  // value step is optional — advance without answering
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  setField(dom, "requested_service", "build_system");
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();

  assert.equal(mobileCounter.textContent, "مرحله ۶ از ۶", "mobile counter at the contact step");
  assert.equal(mobileBar.style.width, "83.33333333333334%", "mobile bar reflects 5/6 completed");

  const summary = dom.getElementById("audit-summary");
  assert.equal(summary.hidden, false, "review summary appears on the contact step");
  const row = (name) =>
    [...summary.children].find((c) => c.getAttribute("data-summary-row") === name);
  assert.equal(row("industry").hidden, false, "industry row shown");
  assert.equal(
    row("industry").querySelector("[data-summary-industry]").textContent,
    "آرایشگاه و زیبایی",
    "industry label filled from the client enum",
  );
  assert.equal(
    row("channels").querySelector("[data-summary-channels]").textContent,
    "اینستاگرام، گوگل",
    "channels labels joined from the client enum",
  );
  assert.equal(
    row("problem").querySelector("[data-summary-problem]").textContent,
    "درخواست‌ها پراکنده‌اند یا گم می‌شوند",
    "problem label filled",
  );
  assert.equal(
    row("need").querySelector("[data-summary-need]").textContent,
    "ساخت سیستم جذب",
    "need label filled",
  );

  // Back: summary hides again, mobile progress follows.
  dom.getElementById("audit-back").dispatchEvent("click");
  await tick();
  assert.equal(summary.hidden, true, "summary hides when leaving the contact step");
  assert.equal(mobileCounter.textContent, "مرحله ۵ از ۶", "mobile counter follows Back");
});

/* ------------------------------------------------------------------ */
/* Replay-200 dedupe (plan 002): the retry-success 200 may report       */
/* status "replay" — the lead row already exists, so the client must    */
/* NOT send the duplicate PII email or fire audit_submitted again.      */
/* ------------------------------------------------------------------ */

test("fresh insert 200: exactly one Web3Forms POST with the lead body and one audit_submitted beacon", async () => {
  // The analytics track() queue and its 800ms flush timer are module-level
  // and shared across tests — drain any timer left by earlier tests BEFORE
  // this test installs its own shims, so a stale beacon can never land in
  // this test's recording.
  await sleep(900);

  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [() => ({ ok: true, status: 200, json: async () => ({ ok: true, id: "lead-1", status: "inserted" }) })],
  });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({
    turnstileSiteKey: "test-site-key",
    web3formsKey: "wf-test-key",
    web3formsUrl: "https://api.web3forms.com/submit",
  });

  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  // Give the fire-and-forget Web3Forms POST and the 800ms analytics flush
  // time to land before asserting.
  await sleep(900);

  assert.equal(env.auditCalls.length, 1, "exactly one /api/audit request");
  const submissionId = env.auditCalls[0].submission_id;

  const posts = env.externalCalls.filter((c) => c.url === "https://api.web3forms.com/submit");
  assert.equal(posts.length, 1, "a fresh insert must notify Web3Forms exactly once");
  const notify = JSON.parse(posts[0].body);
  assert.equal(notify.access_key, "wf-test-key");
  assert.equal(notify.submission_id, submissionId);
  assert.equal(notify.name, "علی رضایی");
  assert.equal(notify.phone, "09353598620");
  assert.equal(notify.email, "ali@example.com");
  assert.equal(notify.business_name, "کافه نو");

  const submitted = [];
  for (const beacon of env.beacons) {
    const event = JSON.parse(await beacon.body.text());
    if (event.name === "audit_submitted") submitted.push(event);
  }
  assert.equal(submitted.length, 1, "a fresh insert must fire audit_submitted exactly once");
  assert.equal(submitted[0].payload.page, "/audit");
});

test("replay 200: zero Web3Forms POSTs and zero audit_submitted beacons, still navigates to thank-you", async () => {
  await sleep(900); // drain the shared analytics flush timer from earlier tests

  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [() => ({ ok: true, status: 200, json: async () => ({ ok: true, id: "lead-1", status: "replay" }) })],
  });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({
    turnstileSiteKey: "test-site-key",
    web3formsKey: "wf-test-key",
    web3formsUrl: "https://api.web3forms.com/submit",
  });

  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  await sleep(900);

  assert.equal(env.auditCalls.length, 1, "exactly one /api/audit request");
  const posts = env.externalCalls.filter((c) => c.url === "https://api.web3forms.com/submit");
  assert.equal(posts.length, 0, "a replay must not send the lead PII to Web3Forms (duplicate email)");

  const submitted = [];
  for (const beacon of env.beacons) {
    const event = JSON.parse(await beacon.body.text());
    if (event.name === "audit_submitted") submitted.push(event);
  }
  assert.equal(submitted.length, 0, "a replay must not fire audit_submitted (double-counted conversion)");

  assert.deepEqual(env.nav, ["/audit/thank-you"], "thank-you must still open on replay");
  assert.equal(env.session.has("noveno:audit:draft"), false, "draft cleared after confirmed persistence");
  assert.equal(env.session.get("noveno:audit:done"), env.auditCalls[0].submission_id, "done marker still recorded on replay");
});

/* ------------------------------------------------------------------ */
/* Plan 011: Web3Forms best-effort failure, offline banner, draft      */
/* restore — the three journeys the retry suite never touched.         */
/* ------------------------------------------------------------------ */

test("Web3Forms notification is best-effort: a rejected POST never blocks thank-you, and lead fields are sanitized", async () => {
  await sleep(900); // drain the shared analytics flush timer

  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [okResponse] });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();
  initAudit({
    turnstileSiteKey: "test-site-key",
    web3formsKey: "wf-test-key",
    web3formsUrl: "https://api.web3forms.com/test",
  });

  await walkToContactStep(dom);
  // Free-text field carrying markup — the notification email renders as
  // HTML, so safeText must strip tags before the POST (security MINOR-3).
  dom.getElementById("business_name").value = "کافه <b>نو</b>";
  dom.getElementById("business_name").dispatchEvent("change");
  dom.getElementById("audit-form").dispatchEvent("input", { target: dom.getElementById("business_name") });

  // Web3Forms unreachable: every notify attempt rejects (first try + the
  // single automatic retry) while /api/audit still goes through the shim.
  const web3Attempts = [];
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const parsed = typeof url === "string" ? url : url.url;
    if (parsed === "https://api.web3forms.com/test") {
      web3Attempts.push({ url: parsed, body: String(opts.body ?? "") });
      throw new TypeError("Failed to fetch");
    }
    return baseFetch(url, opts);
  };

  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  await sleep(900); // let the bounded fire-and-forget notify attempts run

  assert.equal(env.auditCalls.length, 1, "exactly one /api/audit request");
  assert.equal(web3Attempts.length, 2, "a rejected notify makes exactly one automatic retry, then gives up");
  assert.deepEqual(env.nav, ["/audit/thank-you"], "thank-you navigation must never be blocked by the web3forms failure");
  assert.equal(env.session.has("noveno:audit:draft"), false, "draft cleared on confirmed success regardless of the notification");

  for (const attempt of web3Attempts) {
    const body = JSON.parse(attempt.body);
    assert.equal(body.access_key, "wf-test-key");
    assert.equal(body.submission_id, env.auditCalls[0].submission_id);
    assert.equal(body.name, "علی رضایی");
    assert.equal(body.business_name, "کافه bنو/b", "markup must be stripped from free-text fields before the notification");
  }
});

test("offline: a network failure with navigator.onLine=false shows the offline banner; the online event clears it", async () => {
  await sleep(900); // drain the shared analytics flush timer

  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [() => {
      throw new TypeError("Failed to fetch");
    }],
    onLine: false,
  });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();
  // The module registers its offline/online listeners on window; capture
  // them so the test can drive the recovery event.
  const windowListeners = {};
  window.addEventListener = (type, fn) => {
    (windowListeners[type] ??= []).push(fn);
  };

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "", web3formsUrl: "" });

  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();

  const banner = dom.getElementById("audit-banner");
  const offlineBlock = [...banner.children].find((c) => c.getAttribute("data-banner") === "offline");
  assert.equal(env.auditCalls.length, 1, "the submission attempt is recorded even though fetch threw");
  assert.equal(banner.hidden, false, "error banner must be visible after the failure");
  assert.equal(offlineBlock.hidden, false, "the offline block must be shown when navigator.onLine=false");
  assert.equal(dom.getElementById("audit-next").disabled, false, "submit must not stay stuck busy");

  // Connection returns → the offline banner clears.
  navigator.onLine = true;
  for (const fn of windowListeners.online ?? []) fn();
  assert.equal(banner.hidden, true, "the online event must clear the offline banner");
  assert.equal(offlineBlock.hidden, true);
});

test("draft restore: a saved draft renders at its step with values applied and keeps its submission_id", async () => {
  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [] });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();

  // Pre-seed the draft exactly as writeDraft would (Draft shape in
  // src/scripts/audit.ts) — a reload mid-journey must resume, not restart.
  const submissionId = "draft-11111111-2222-3333-4444-555555555555";
  env.session.set(
    "noveno:audit:draft",
    JSON.stringify({
      submission_id: submissionId,
      step: 3,
      values: {
        business_name: "کافه نو",
        industry: "restaurant_cafe",
        website: "https://example.com",
        acquisition_channels: ["instagram", "referral"],
        primary_problem: "scattered_lost",
      },
      attribution: null,
    }),
  );

  const heading = dom.getElementById("step-problem-title");
  let headingFocuses = 0;
  heading.focus = () => { headingFocuses += 1; };

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "", web3formsUrl: "" });

  assert.equal(
    dom.document.querySelector("[data-stepper-counter]").textContent,
    "مرحله ۳ از ۶",
    "the counter must render at the saved step",
  );
  assert.equal(
    dom.document.querySelector("[data-stepper-current]").textContent,
    "مشکل اصلی",
    "the current-step label must render at the saved step",
  );
  assert.equal(
    dom.document.querySelector('[data-step-section="problem"]').hidden,
    false,
    "the saved step section must be visible",
  );
  assert.equal(
    dom.document.querySelector('[data-step-section="business"]').hidden,
    true,
    "earlier sections stay hidden",
  );
  assert.equal(dom.getElementById("business_name").value, "کافه نو", "text field restored");
  assert.equal(dom.getElementById("industry").value, "restaurant_cafe", "select restored");
  assert.equal(
    dom.document
      .querySelector('[data-chip][data-group="acquisition_channels"][data-chip="instagram"]')
      .getAttribute("aria-checked"),
    "true",
    "multiselect chip restored",
  );
  assert.equal(dom.getElementById("audit-summary").hidden, true, "review summary hidden before the contact step");
  assert.equal(headingFocuses, 0, "boot must not focus the heading on restore");
  assert.equal(dom.getElementById("audit-next").disabled, false, "the journey resumes, next is enabled");

  // Advancing from a restored draft keeps the same submission_id and writes the next step.
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  const persisted = JSON.parse(env.session.get("noveno:audit:draft"));
  assert.equal(persisted.step, 4, "advancing from the restore writes the next step");
  assert.equal(persisted.submission_id, submissionId, "submission_id must survive the restore");
  assert.equal(
    dom.document.querySelector("[data-stepper-counter]").textContent,
    "مرحله ۴ از ۶",
    "the counter follows the resumed journey",
  );
});
