/**
 * Audit client journey tests (email-only architecture, 2026-10).
 *
 * The success invariant: the visitor must NOT reach a success/thank-you
 * state merely because /api/audit validation succeeded. Success now means
 * Web3Forms accepted the lead ({ success: true }). The draft is cleared,
 * `audit_submitted` fires, the done marker is recorded, and the journey
 * navigates to /audit/thank-you ONLY after confirmed Web3Forms success.
 *
 * On Web3Forms failure (network/timeout/non-2xx/{ success: false }/429):
 * stay on /audit, preserve the draft + stable submission_id, show a
 * truthful recoverable banner with direct-contact fallback, and allow a
 * retry that mints a FRESH Turnstile token (the previous one may already
 * be consumed by siteverify).
 *
 * This suite drives the REAL client state machine (src/scripts/audit.ts)
 * through a deterministic fake DOM + mock Turnstile widget + scriptable
 * fetch. Defect-sensitive: the Web3Forms-failure tests fail on the old
 * "best-effort notify then thank-you anyway" behavior.
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

  // Audit progress («مرحله X از ۶» counter + current-step label + bar)
  const rail = el("aside", { "aria-label": "راهنمای بررسی" });
  const progress = el("div");
  for (const attr of ["data-stepper-counter", "data-stepper-current", "data-stepper-bar"]) {
    progress.append(el("span", { [attr]: "" }));
  }
  rail.append(progress);
  body.append(rail);

  // Compact in-card mobile progress (same hooks, -mobile)
  const mobileProgress = el("div");
  for (const attr of ["data-stepper-counter-mobile", "data-stepper-current-mobile", "data-stepper-bar-mobile"]) {
    mobileProgress.append(el("span", { [attr]: "" }));
  }
  body.append(mobileProgress);

  // Banner with all block kinds + retry buttons
  const banner = el("div", { id: "audit-banner", role: "alert", hidden: true });
  for (const kind of ["network", "offline", "turnstile", "rate", "validation", "unconfigured", "delivery"]) {
    const block = el("div", { "data-banner": kind, hidden: true });
    if (kind === "network" || kind === "offline" || kind === "turnstile" || kind === "delivery") {
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

  // Last-step review summary
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

/**
 * Scriptable fetch: /api/audit consumes response factories from
 * `fetchImpl` in order; the Web3Forms endpoint is recorded and its
 * behavior is driven by `web3formsMode` (mutable mid-test):
 *   ok     → 200 { success: true }
 *   fail   → 500 { success: false }          (non-2xx)
 *   badbody→ 200 { success: false }           (API-level rejection)
 *   rate   → 429 { success: false }           (rate limit)
 *   throw  → network TypeError (every attempt)
 *   silent → 200 unreadable body
 */
function installGlobals({ turnstile, fetchImpl, onLine = true, web3formsMode = "ok" }) {
  const session = new Map();
  const nav = [];
  const auditCalls = [];
  const externalCalls = [];
  const beacons = [];
  const auditSignals = [];
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
    if (parsed === "/api/audit") {
      auditCalls.push(JSON.parse(String(opts.body)));
      auditSignals.push(opts.signal);
      const next = fetchImpl.shift();
      if (!next) throw new Error("test: unexpected /api/audit call");
      return next();
    }
    // Non-audit requests are observed, not stubbed: the Web3Forms
    // delivery must be provable (POST count + lead body).
    externalCalls.push({ url: parsed, method: opts.method ?? "GET", body: String(opts.body ?? "") });
    if (parsed.startsWith("https://api.web3forms.com/")) {
      switch (state.web3formsMode) {
        case "fail":
          return { ok: false, status: 500, json: async () => ({ success: false }) };
        case "badbody":
          return { ok: true, status: 200, json: async () => ({ success: false }) };
        case "rate":
          return { ok: false, status: 429, json: async () => ({ success: false, message: "Too many requests. Please try later!" }) };
        case "throw":
          throw new TypeError("Failed to fetch");
        case "silent":
          return { ok: true, status: 200, json: async () => { throw new Error("unreadable"); } };
        default:
          return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  globalThis.window = globalThis;
  window.turnstile = turnstile;
  window.addEventListener = () => {};
  window.clearTimeout = clearTimeout;
  window.setTimeout = setTimeout;

  return { auditCalls, externalCalls, beacons, nav, session, state, auditSignals };
}

/** Validation-success mock: /api/audit 200 with status "validated". */
function okResponse() {
  return { ok: true, status: 200, json: async () => ({ ok: true, status: "validated" }) };
}

/** The audit script's Turnstile loader appends <script> to document.head. */
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
  chip.dispatchEvent("click");
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

function bannerBlock(dom, kind) {
  return [...dom.byId.get("audit-banner").children].find(
    (c) => c.getAttribute("data-banner") === kind,
  );
}

async function submittedEvents(env) {
  const submitted = [];
  for (const beacon of env.beacons) {
    const raw = typeof beacon.body.text === "function" ? await beacon.body.text() : beacon.body;
    const event = JSON.parse(raw);
    if (event.name === "audit_submitted") submitted.push(event);
  }
  return submitted;
}

function web3Posts(env) {
  return env.externalCalls.filter((c) => c.url.startsWith("https://api.web3forms.com/"));
}

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

test("retry after a recoverable /api/audit network failure: same submission_id, preserved values, fresh token, new /api/audit request, Web3Forms success, thank-you", async () => {
  const turnstile = makeTurnstileMock();
  const fetchImpl = [
    () => {
      throw new TypeError("Failed to fetch"); // recoverable network failure
    },
    okResponse, // retry validates
  ];
  const env = installGlobals({ turnstile, fetchImpl });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });

  await walkToContactStep(dom);
  assert.equal(turnstile.renders, 1, "widget must render once when the contact step becomes current");
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
  assert.equal(bannerBlock(dom, "network").hidden, false, "network banner block must be shown for a network failure");
  assert.equal(dom.getElementById("audit-next").disabled, false, "submit must not stay stuck busy");
  assert.equal(env.session.has("noveno:audit:draft"), true, "values must be persisted in the draft after the failure");
  assert.equal(env.nav.length, 0, "no navigation after a failed validation attempt");

  // Retry: must NOT throw, must not reuse the consumed token, must not
  // change submission_id, must preserve values, and must reach thank-you
  // only once Web3Forms confirms the delivery.
  const retryButton = dom.document.querySelector("[data-retry]");
  assert.ok(retryButton, "retry control must exist");
  let retryError = null;
  try {
    retryButton.dispatchEvent("click");
  } catch (error) {
    retryError = error;
  }
  assert.equal(retryError, null, "«تلاش دوباره» must not throw");
  await tick();
  turnstile.emitToken("token-2"); // fresh challenge for the retry
  await tick();
  await sleep(10); // let the Web3Forms delivery settle

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
  assert.equal(env.session.has("noveno:audit:draft"), false, "draft must be cleared after confirmed Web3Forms success");
  assert.equal(env.session.get("noveno:audit:done"), submissionId, "done marker must record the submission");
  assert.equal(bannerBlock(dom, "network").hidden, true, "banner must clear when retry recovery starts");
  assert.equal(web3Posts(env).length, 1, "one Web3Forms delivery after the successful retry");
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

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });

  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  assert.ok(scripts.length >= 1, "Turnstile script must be injected");
  for (const script of scripts) script.onerror(); // script blocked/unreachable
  await tick();

  assert.equal(env.auditCalls.length, 0, "no request may be sent without a token");
  assert.equal(bannerBlock(dom, "turnstile").hidden, false, "turnstile failure banner must be shown");

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
  assert.equal(bannerBlock(dom, "turnstile").hidden, false, "banner must persist while the script is unreachable");

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
  await sleep(10);

  assert.equal(env.auditCalls.length, 1, "retry must recover with a fresh token and submit");
  assert.equal(env.auditCalls[0].cf_turnstile_token, "token-fresh");
  assert.equal(env.nav[0], "/audit/thank-you");
  assert.equal(web3Posts(env).length, 1, "recovered journey must complete the Web3Forms delivery");
});

test("in-card mobile progress stays in sync and the last-step review summary fills from the draft", async () => {
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
  dom.getElementById("audit-next").dispatchEvent("click"); // value step optional
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

  dom.getElementById("audit-back").dispatchEvent("click");
  await tick();
  assert.equal(summary.hidden, true, "summary hides when leaving the contact step");
  assert.equal(mobileCounter.textContent, "مرحله ۵ از ۶", "mobile counter follows Back");
});

/* ------------------------------------------------------------------ */
/* Web3Forms = the completion gate (email-only architecture)           */
/* ------------------------------------------------------------------ */

test("Web3Forms success: exactly one delivery POST (no Turnstile token, Persian labels), one audit_submitted beacon, draft cleared, done marker, thank-you", async () => {
  await sleep(900); // drain the shared analytics flush timer

  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [okResponse],
    web3formsMode: "ok",
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
  await sleep(900); // let the delivery + analytics flush settle

  assert.equal(env.auditCalls.length, 1, "exactly one /api/audit request");
  const submissionId = env.auditCalls[0].submission_id;

  const posts = web3Posts(env);
  assert.equal(posts.length, 1, "a confirmed success must deliver to Web3Forms exactly once");
  const notify = JSON.parse(posts[0].body);
  assert.equal(notify.access_key, "wf-test-key");
  assert.equal(notify.submission_id, submissionId);
  assert.equal(notify.name, "علی رضایی");
  assert.equal(notify.phone, "09353598620");
  assert.equal(notify.email, "ali@example.com");
  assert.equal(notify.business_name, "کافه نو");
  assert.equal(notify.industry, labelFor("industry", "restaurant_cafe"), "enum ids must reach the email as readable Persian labels");
  assert.equal(notify.acquisition_channels, joinedLabels("channels", ["instagram", "referral"]), "multiselect must be readable Persian labels");
  assert.equal(notify.primary_problem, labelFor("problems", "scattered_lost"));
  assert.equal(notify.requested_service, labelFor("needs", "audit_analysis"));
  assert.ok("cf_turnstile_token" in notify === false, "the Turnstile token must never reach Web3Forms");
  assert.ok("company_website" in notify === false, "the internal honeypot value must not reach Web3Forms");

  const submitted = await submittedEvents(env);
  assert.equal(submitted.length, 1, "audit_submitted must fire exactly once — only after email success");
  assert.equal(submitted[0].payload.page, "/audit");

  assert.deepEqual(env.nav, ["/audit/thank-you"], "thank-you must open only after confirmed email success");
  assert.equal(env.session.has("noveno:audit:draft"), false, "draft cleared after confirmed email success");
  assert.equal(env.session.get("noveno:audit:done"), submissionId, "done marker recorded after confirmed email success");
});

test("Web3Forms failure (network): server validation success alone does NOT complete the journey — banner, values preserved, no navigation, no beacon, bounded retry", async () => {
  await sleep(900); // drain the shared analytics flush timer

  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [okResponse, okResponse], // first submit validates; retry re-validates
    web3formsMode: "throw", // every Web3Forms attempt throws
  });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();
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
  await sleep(50); // let the bounded delivery attempts settle

  assert.equal(env.auditCalls.length, 1, "/api/audit succeeded (validated)");
  assert.equal(web3Posts(env).length, 2, "exactly two bounded delivery attempts (one automatic retry), never infinite");
  assert.equal(env.nav.length, 0, "server validation success alone must NOT navigate to thank-you");
  assert.equal(env.session.has("noveno:audit:draft"), true, "draft must remain intact until confirmed email success");
  assert.equal(env.session.has("noveno:audit:done"), false, "no completion marker without email success");
  assert.equal((await submittedEvents(env)).length, 0, "audit_submitted must NOT fire without email success");
  assert.equal(bannerBlock(dom, "delivery").hidden, false, "a truthful recoverable delivery banner must be shown");
  assert.equal(dom.getElementById("audit-next").disabled, false, "submit must not stay stuck busy");

  // Retry: same submission_id, preserved values, fresh Turnstile token,
  // and — with Web3Forms now reachable — a full recovery to thank-you.
  env.state.web3formsMode = "ok";
  const retryButton = dom.document.querySelector("[data-retry]");
  retryButton.dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-2");
  await tick();
  await sleep(50);

  assert.equal(env.auditCalls.length, 2, "retry issues a new /api/audit request");
  assert.equal(env.auditCalls[1].submission_id, env.auditCalls[0].submission_id, "submission_id stable across delivery retry");
  assert.deepEqual(
    { ...env.auditCalls[1], cf_turnstile_token: undefined },
    { ...env.auditCalls[0], cf_turnstile_token: undefined },
    "all field values preserved across the delivery retry",
  );
  assert.equal(env.auditCalls[1].cf_turnstile_token, "token-2", "fresh Turnstile token minted for the retry");
  assert.equal(turnstile.resets, 2, "the retry must obtain a fresh challenge");
  assert.deepEqual(env.nav, ["/audit/thank-you"], "retry recovers to thank-you once delivery succeeds");
  assert.equal(env.session.has("noveno:audit:draft"), false, "draft cleared after the recovered success");
  assert.equal(env.session.get("noveno:audit:done"), env.auditCalls[0].submission_id);
});

test("Web3Forms non-2xx and API { success: false } are delivery failures (no false success); 429 surfaces the rate banner", async () => {
  await sleep(900); // drain the shared analytics flush timer

  // non-2xx (500 + { success: false })
  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [okResponse], web3formsMode: "fail" });
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
  await sleep(50);
  assert.equal(env.nav.length, 0, "non-2xx Web3Forms response must never complete the journey");
  assert.equal(bannerBlock(dom, "delivery").hidden, false, "delivery banner for a non-2xx response");

  // API-level { success: false } on a 200 status is still a failure
  const env2 = installGlobals({ turnstile: makeTurnstileMock(), fetchImpl: [okResponse], web3formsMode: "badbody" });
  const dom2 = buildAuditDom();
  globalThis.document = dom2.document;
  initAudit({
    turnstileSiteKey: "test-site-key",
    web3formsKey: "wf-test-key",
    web3formsUrl: "https://api.web3forms.com/submit",
  });
  await walkToContactStep(dom2);
  dom2.getElementById("audit-next").dispatchEvent("click");
  await tick();
  emitTokenOn(dom2);
  await tick();
  await sleep(50);
  assert.equal(env2.nav.length, 0, "200 with { success: false } must never complete the journey");
  assert.equal(bannerBlock(dom2, "delivery").hidden, false);

  // 429 rate limit → the dedicated rate banner
  const env3 = installGlobals({ turnstile: makeTurnstileMock(), fetchImpl: [okResponse], web3formsMode: "rate" });
  const dom3 = buildAuditDom();
  globalThis.document = dom3.document;
  initAudit({
    turnstileSiteKey: "test-site-key",
    web3formsKey: "wf-test-key",
    web3formsUrl: "https://api.web3forms.com/submit",
  });
  await walkToContactStep(dom3);
  dom3.getElementById("audit-next").dispatchEvent("click");
  await tick();
  emitTokenOn(dom3);
  await tick();
  await sleep(50);
  assert.equal(env3.nav.length, 0, "Web3Forms 429 must never complete the journey");
  assert.equal(bannerBlock(dom3, "rate").hidden, false, "rate banner for a Web3Forms 429");
});

function emitTokenOn(dom) {
  // The bridge widget's callback was captured at render time by the mock;
  // a late token emission drives the token promise to resolution.
  window.turnstile.emitToken("token-x");
}

test("unconfigured (missing Web3Forms key): honest «not available» fallback, no request, no navigation", async () => {
  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [] });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "", web3formsUrl: "" });

  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();

  assert.equal(env.auditCalls.length, 0, "no /api/audit request without a Web3Forms key");
  assert.equal(bannerBlock(dom, "unconfigured").hidden, false, "the honest fallback banner must be shown");
  assert.equal(env.nav.length, 0, "no navigation without a delivery destination");
  assert.equal(env.session.has("noveno:audit:draft"), true, "draft preserved");
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
  const windowListeners = {};
  window.addEventListener = (type, fn) => {
    (windowListeners[type] ??= []).push(fn);
  };

  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });

  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();

  assert.equal(env.auditCalls.length, 1, "the submission attempt is recorded even though fetch threw");
  assert.equal(bannerBlock(dom, "offline").hidden, false, "the offline block must be shown when navigator.onLine=false");
  assert.equal(dom.getElementById("audit-next").disabled, false, "submit must not stay stuck busy");

  navigator.onLine = true;
  for (const fn of windowListeners.online ?? []) fn();
  assert.equal(dom.byId.get("audit-banner").hidden, true, "the online event must clear the offline banner");
  assert.equal(bannerBlock(dom, "offline").hidden, true);
});

test("server validation rejection surfaces the rejected field (no silent generic loop)", async () => {
  await sleep(900); // drain the shared analytics flush timer

  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [
      () => ({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: { code: "validation", fields: { email: "too_long" } } }),
      }),
    ],
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
  await sleep(10);

  assert.equal(env.auditCalls.length, 1, "the request reached /api/audit");
  assert.equal(env.nav.length, 0, "a server rejection must never navigate");
  assert.equal(env.session.has("noveno:audit:draft"), true, "draft preserved on rejection");
  assert.equal(web3Posts(env).length, 0, "no delivery after a rejected submission");
  const emailError = dom.byId.get("email-error");
  assert.equal(emailError.hidden, false, "the rejected field's error must be surfaced");
  assert.equal(
    emailError.querySelector("[data-error-text]").textContent,
    "ایمیل خیلی طولانی است",
    "the server message key maps to the Persian copy",
  );
  assert.equal(bannerBlock(dom, "validation").hidden, false, "the validation banner must be shown");
  assert.equal(dom.getElementById("audit-next").disabled, false, "submit must not stay stuck busy");
});

test("a /api/audit 2xx without status 'validated' is NOT treated as success (contract drift guard)", async () => {
  await sleep(900);

  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [
      () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: "inserted", id: "lead-1" }) }),
    ],
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
  await sleep(10);

  assert.equal(env.nav.length, 0, "a non-validated 2xx must never complete the journey");
  assert.equal(web3Posts(env).length, 0, "no delivery without a validated response");
  assert.equal(bannerBlock(dom, "network").hidden, false, "a truthful recoverable banner is shown");
  assert.equal(env.session.has("noveno:audit:draft"), true, "draft preserved");
});

test("the /api/audit request carries an abort timeout signal (never stuck submitting)", async () => {
  await sleep(900);

  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [okResponse] });
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
  await sleep(10);

  assert.equal(env.auditSignals.length, 1, "one /api/audit request observed");
  assert.ok(
    env.auditSignals[0] instanceof AbortSignal,
    "a timeout abort signal must be attached to the validation request",
  );
  assert.deepEqual(env.nav, ["/audit/thank-you"]);
});

test("draft restore: a saved draft renders at its step with values applied and keeps its submission_id", async () => {
  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [] });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();

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

test("audit validation receipt is echoed in Web3Forms body (plan 021)", async () => {
  await sleep(900);
  const turnstile = makeTurnstileMock();
  const receipt = "11111111-1111-1111-1111-111111111111.2026-08-21T10:00:00.000Z." + "a".repeat(64);
  const env = installGlobals({
    turnstile,
    fetchImpl: [() => ({ ok: true, status: 200, json: async () => ({ ok: true, status: "validated", receipt }) })],
  });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });
  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  await sleep(50);
  assert.equal(web3Posts(env).length, 1, "one delivery with receipt");
  const body = JSON.parse(web3Posts(env)[0].body);
  assert.equal(body.validation_receipt, receipt, "receipt echoed");
  assert.ok(body.validated_at, "validated_at present");
  assert.equal(body.delivery_attempt, "1", "first attempt marker");
});

test("delivery without server receipt sends validation_receipt none (bypass guard)", async () => {
  await sleep(900);
  const turnstile = makeTurnstileMock();
  const env = installGlobals({
    turnstile,
    fetchImpl: [okResponse],
  });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });
  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  await sleep(50);
  const body = JSON.parse(web3Posts(env)[0].body);
  assert.equal(body.validation_receipt, "none", "missing receipt falls back to none");
});

test("Web3Forms success: delivery_attempt is 1 and submission_id stable (plan 025)", async () => {
  await sleep(900);
  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [okResponse] });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });
  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  await sleep(50);
  const posts = web3Posts(env);
  assert.equal(posts.length, 1);
  const body = JSON.parse(posts[0].body);
  assert.equal(body.delivery_attempt, "1");
  assert.equal(body.submission_id, env.auditCalls[0].submission_id);
  assert.equal(body.delivery_attempt, "1");
});

test("Web3Forms bounded retry: second attempt has delivery_attempt 2", async () => {
  await sleep(900);
  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [okResponse], web3formsMode: "throw" });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });
  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  await sleep(50);
  assert.equal(web3Posts(env).length, 2, "two attempts");
  const second = JSON.parse(web3Posts(env)[1].body);
  assert.equal(second.delivery_attempt, "2");
});

test("rapid double-click does not double-deliver (plan 025 submitting guard)", async () => {
  await sleep(900);
  const turnstile = makeTurnstileMock();
  let resolveAudit;
  const env = installGlobals({
    turnstile,
    fetchImpl: [() => new Promise((resolve) => { resolveAudit = () => resolve(okResponse()); })],
  });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });
  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();
  // While audit fetch is still pending (submitting = true), click again
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  // Now resolve the first audit call
  resolveAudit();
  await tick();
  await sleep(50);
  assert.equal(env.auditCalls.length, 1, "guard holds — only one /api/audit request");
  assert.equal(web3Posts(env).length, 1, "only one Web3Forms delivery");
});

test("createDraft falls back when crypto.randomUUID is unavailable (getRandomValues path)", async () => {
  await sleep(900);
  const orig = globalThis.crypto.randomUUID;
  try {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true, writable: true });
    const turnstile = makeTurnstileMock();
    const env = installGlobals({ turnstile, fetchImpl: [okResponse] });
    const dom = buildAuditDom();
    globalThis.document = dom.document;
    initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });
    await walkToContactStep(dom);
    dom.getElementById("audit-next").dispatchEvent("click");
    await tick();
    turnstile.emitToken("token-fallback");
    await tick();
    await sleep(50);
    const sid = env.auditCalls[0].submission_id;
    assert.match(sid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "fallback UUID must match pattern");
    assert.match(sid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "v4 variant");
  } finally {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: orig, configurable: true, writable: true });
  }
});

test("createDraft falls back to Math.random when getRandomValues unavailable", async () => {
  await sleep(900);
  const origRandom = globalThis.crypto.randomUUID;
  const origGetRandom = globalThis.crypto.getRandomValues;
  try {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true, writable: true });
    Object.defineProperty(globalThis.crypto, "getRandomValues", { value: undefined, configurable: true, writable: true });
    const turnstile = makeTurnstileMock();
    const env = installGlobals({ turnstile, fetchImpl: [okResponse] });
    const dom = buildAuditDom();
    globalThis.document = dom.document;
    initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "wf-test-key", web3formsUrl: "https://api.web3forms.com/submit" });
    await walkToContactStep(dom);
    dom.getElementById("audit-next").dispatchEvent("click");
    await tick();
    turnstile.emitToken("token-math");
    await tick();
    await sleep(50);
    const sid = env.auditCalls[0].submission_id;
    assert.match(sid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Math.random fallback must be UUID-shaped");
  } finally {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: origRandom, configurable: true, writable: true });
    Object.defineProperty(globalThis.crypto, "getRandomValues", { value: origGetRandom, configurable: true, writable: true });
  }
});
