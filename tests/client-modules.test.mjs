/**
 * Characterization tests for the four client modules that previously had
 * zero automated coverage (plan 011):
 *
 *  - src/scripts/analytics.ts — attribution capture (first-page-wins
 *    UTM/referrer), the event queue, and PII-free delivery (sendBeacon
 *    with fetch-keepalive fallback).
 *  - src/scripts/theme.ts — aria-pressed sync, localStorage persistence,
 *    and the system-change listener (follows the OS only while unset).
 *  - src/scripts/menu.ts — open/close state, Escape, focus return, and
 *    the bounded timeout fallback when transitionend never fires.
 *  - src/scripts/motion.ts — reduced-motion guards (no IntersectionObserver
 *    under `prefers-reduced-motion: reduce`), reveal observing, and the
 *    hero-parallax fine-pointer guards.
 *
 * The suite is self-contained (its own fake-DOM shims — nothing imported
 * from tests/audit-retry.test.mjs) and drives the REAL modules through
 * the same globals they touch in the browser. All tests pin observable
 * behavior (beacon bodies, aria-pressed, focus return, observed targets),
 * not internal calls.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  captureAttribution,
  readAttribution,
  track,
  initAnalytics,
} from "../src/scripts/analytics.ts";
import { initThemeToggle } from "../src/scripts/theme.ts";
import { initMobileMenu } from "../src/scripts/menu.ts";
import { initReveal, initHeroParallax } from "../src/scripts/motion.ts";
import { EVENT_NAMES, EVENT_PAYLOAD_KEYS } from "../functions/lib/contract.ts";

/* ------------------------------------------------------------------ */
/* Minimal fake DOM (attribute + tag selectors, comma unions)          */
/* ------------------------------------------------------------------ */

function matchesSelector(el, selector) {
  for (const raw of selector.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    if (part.startsWith("[")) {
      const parts = [];
      for (const m of part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        parts.push({ attr: m[1], value: m[2] ?? null });
      }
      if (parts.length === 0) continue;
      if (parts.every((p) => (p.value === null ? el.hasAttribute(p.attr) : el.getAttribute(p.attr) === p.value))) {
        return true;
      }
    } else if (/^[a-z][\w-]*$/i.test(part)) {
      if (el.tagName === part.toUpperCase()) return true;
    }
  }
  return false;
}

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
    this.innerHTML = "";
    this.id = this._attrs.get("id") ?? "";
    this._classes = new Set();
    this.style = {
      setProperty(key, value) {
        this[key] = value;
      },
    };
    this._rect = { top: 0, left: 0, width: 0, height: 0 };
    this.focused = false;
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

  removeEventListener(type, fn) {
    this._handlers[type] = (this._handlers[type] ?? []).filter((f) => f !== fn);
  }

  dispatchEvent(type, event = {}) {
    for (const fn of [...(this._handlers[type] ?? [])]) fn(event);
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesSelector(node, selector)) return node;
      node = node.parent;
    }
    return null;
  }

  focus() {
    this.focused = true;
  }

  getBoundingClientRect() {
    return this._rect;
  }

  get classList() {
    return {
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
      contains: (c) => this._classes.has(c),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Global stubs (reset per test via installClientGlobals)              */
/* ------------------------------------------------------------------ */

function makeMatchMedia({ reducedMotion = false, dark = false, finePointer = true, minWidth1024 = true } = {}) {
  const stubs = [];
  const impl = (query) => {
    const matches =
      query === "(prefers-reduced-motion: reduce)"
        ? reducedMotion
        : query === "(prefers-color-scheme: dark)"
          ? dark
          : query === "(pointer: fine)"
            ? finePointer
            : query === "(min-width: 1024px)"
              ? minWidth1024
              : false;
    const stub = {
      query,
      matches,
      listeners: {},
      addEventListener(type, fn) {
        (this.listeners[type] ??= []).push(fn);
      },
      removeEventListener(type, fn) {
        this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
      },
    };
    stubs.push(stub);
    return stub;
  };
  return { impl, stubs };
}

function makeDocument(referrer = "https://example.com/") {
  const documentElement = new FakeEl("html", { "data-theme": "light" });
  const handlers = {};
  return {
    referrer,
    visibilityState: "visible",
    documentElement,
    addEventListener(type, fn) {
      (handlers[type] ??= []).push(fn);
    },
    removeEventListener(type, fn) {
      handlers[type] = (handlers[type] ?? []).filter((f) => f !== fn);
    },
    dispatchEvent(type, event = {}) {
      for (const fn of [...(handlers[type] ?? [])]) fn(event);
    },
    handlers,
  };
}

function makeWindow(matchMediaImpl) {
  const handlers = {};
  return {
    innerHeight: 800,
    matchMedia: matchMediaImpl,
    setTimeout,
    clearTimeout,
    addEventListener(type, fn) {
      (handlers[type] ??= []).push(fn);
    },
    removeEventListener(type, fn) {
      handlers[type] = (handlers[type] ?? []).filter((f) => f !== fn);
    },
    dispatchEvent(type, event = {}) {
      for (const fn of [...(handlers[type] ?? [])]) fn(event);
    },
    handlers,
  };
}

class IntersectionObserverSpy {
  static instances = [];
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observed = [];
    IntersectionObserverSpy.instances.push(this);
  }
  observe(el) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {}
}

/** Install the full global surface the four modules touch. */
function installClientGlobals(options = {}) {
  const mm = makeMatchMedia(options.matchMedia ?? {});
  const session = new Map();
  const location = {
    pathname: options.pathname ?? "/",
    search: options.search ?? "",
    href: `https://noveno.test${options.pathname ?? "/"}${options.search ?? ""}`,
  };
  const sendBeacon = (url, body) => {
    sendBeacon.calls.push({ url, body });
    return true;
  };
  sendBeacon.calls = [];
  const fetchCalls = [];

  globalThis.sessionStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
  };
  globalThis.localStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
  };
  globalThis.location = location;
  globalThis.document = makeDocument(options.referrer ?? "https://example.com/");
  globalThis.window = makeWindow(mm.impl);
  Object.defineProperty(globalThis, "navigator", {
    value: { sendBeacon, onLine: true },
    configurable: true,
    writable: true,
  });
  globalThis.requestAnimationFrame = (cb) => {
    cb();
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.fetch = async (url, opts = {}) => {
    fetchCalls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  IntersectionObserverSpy.instances = [];
  globalThis.IntersectionObserver = IntersectionObserverSpy;

  return { mm, session, location, sendBeacon, fetchCalls, doc: globalThis.document, win: globalThis.window };
}

/** Real-time wait — the analytics flush timer is 800ms. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Drain the module-level analytics queue/timer left by earlier tests. */
async function drainAnalytics() {
  await sleep(900);
}

/* ================================================================== */
/* Analytics — attribution capture (first page wins)                   */
/* ================================================================== */

test("analytics: first page of the session wins — later UTMs never overwrite the capture", () => {
  installClientGlobals({ search: "?utm_source=ig&utm_medium=post" });
  captureAttribution();
  globalThis.location.search = "?utm_source=facebook&utm_campaign=c2";
  captureAttribution();
  const attribution = readAttribution();
  assert.ok(attribution, "a capture must exist after the first call");
  assert.equal(attribution.utm_source, "ig", "utm_source must keep the FIRST page's value");
  assert.equal(attribution.utm_medium, "post", "utm_medium must keep the FIRST page's value");
  assert.equal(attribution.utm_campaign, undefined, "a UTM absent on the first page must stay absent");
});

test("analytics: UTM + landing page + referrer + first_seen_at are captured", () => {
  installClientGlobals({
    pathname: "/audit",
    search: "?utm_source=ig&utm_medium=post&utm_campaign=launch",
    referrer: "https://instagram.com/",
  });
  captureAttribution();
  const attribution = readAttribution();
  assert.ok(attribution, "capture must exist");
  assert.equal(attribution.landing_page, "/audit?utm_source=ig&utm_medium=post&utm_campaign=launch", "landing_page is pathname + search");
  assert.equal(attribution.utm_source, "ig");
  assert.equal(attribution.utm_medium, "post");
  assert.equal(attribution.utm_campaign, "launch");
  assert.equal(attribution.referrer, "https://instagram.com/", "referrer comes from document.referrer");
  assert.ok(!Number.isNaN(Date.parse(attribution.first_seen_at)), "first_seen_at must be an ISO timestamp");
  assert.equal(attribution.first_seen_at, new Date(attribution.first_seen_at).toISOString());
});

test("analytics: corrupt stored attribution returns null instead of throwing", () => {
  const env = installClientGlobals();
  env.session.set("noveno:attribution", "not json");
  assert.equal(readAttribution(), null, "unparseable storage must read as null");
  env.session.set("noveno:attribution", "{}");
  assert.equal(readAttribution(), null, "a record without landing_page/first_seen_at must read as null");
});

test("analytics: track queues and flushes via sendBeacon on pagehide", async () => {
  await drainAnalytics();
  const env = installClientGlobals({ pathname: "/audit" });
  initAnalytics();
  track("audit_started", { section: "hero" });
  env.win.dispatchEvent("pagehide", {});
  assert.equal(env.sendBeacon.calls.length, 1, "one beacon after the pagehide flush");
  const [beacon] = env.sendBeacon.calls;
  assert.equal(beacon.url, "/api/events", "beacon must target the events endpoint");
  const event = JSON.parse(await beacon.body.text());
  assert.deepEqual(
    event,
    { name: "audit_started", payload: { section: "hero", page: "/audit" } },
    "the beacon body carries the event name and its payload with the page",
  );
});

test("analytics: falls back to fetch keepalive when sendBeacon is missing", async () => {
  await drainAnalytics();
  const env = installClientGlobals({ pathname: "/audit" });
  globalThis.navigator.sendBeacon = undefined;
  initAnalytics();
  track("phone_click");
  env.win.dispatchEvent("pagehide", {});
  assert.equal(env.fetchCalls.length, 1, "the fallback must use fetch exactly once");
  const [call] = env.fetchCalls;
  assert.equal(call.url, "/api/events");
  assert.equal(call.opts.method, "POST");
  assert.equal(call.opts.keepalive, true, "the fallback must keep the request alive across navigation");
  const event = JSON.parse(await call.opts.body.text());
  assert.equal(event.name, "phone_click");
  assert.deepEqual(event.payload, { page: "/audit" });
});

test("analytics: declarative data-event clicks are tracked through closest()", async () => {
  await drainAnalytics();
  const env = installClientGlobals({ pathname: "/audit" });
  initAnalytics();
  const link = new FakeEl("a", {
    "data-event": "phone_click",
    "data-event-payload": '{"section":"contact"}',
  });
  env.doc.dispatchEvent("click", { target: link });
  env.win.dispatchEvent("pagehide", {});
  assert.equal(env.sendBeacon.calls.length, 1, "the click must produce exactly one beacon");
  const event = JSON.parse(await env.sendBeacon.calls[0].body.text());
  assert.equal(event.name, "phone_click");
  assert.deepEqual(event.payload, { section: "contact", page: "/audit" });
});

test("analytics: PII-free payload contract — beacon keys stay within the whitelist", async () => {
  await drainAnalytics();
  const env = installClientGlobals({ pathname: "/audit" });
  initAnalytics();
  track("audit_started");
  track("audit_step_completed", { step: "2" });
  track("phone_click", { section: "hero" });
  track("service_opened", { service: "audit", slug: "growth" });
  env.win.dispatchEvent("pagehide", {});

  const events = [];
  for (const beacon of env.sendBeacon.calls) {
    events.push(JSON.parse(await beacon.body.text()));
  }
  assert.ok(events.length >= 4, "every tracked event must be delivered");
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), ["name", "payload"], "beacon bodies are exactly { name, payload }");
    assert.ok(EVENT_NAMES.includes(event.name), `event name ${event.name} must be a known event`);
    for (const key of Object.keys(event.payload)) {
      assert.ok(
        EVENT_PAYLOAD_KEYS.includes(key),
        `payload key "${key}" must be whitelisted (contract EVENT_PAYLOAD_KEYS)`,
      );
    }
    for (const banned of ["name", "phone", "email"]) {
      assert.ok(!(banned in event.payload), `payload must never carry "${banned}" (PII-free invariant)`);
    }
  }
});

/* ================================================================== */
/* Theme                                                               */
/* ================================================================== */

function makeThemeEnv({ initialTheme = "light", dark = false } = {}) {
  const env = installClientGlobals({ matchMedia: { dark } });
  env.doc.documentElement.setAttribute("data-theme", initialTheme);
  const button = new FakeEl("button", { "data-theme-label": "" });
  button.append(new FakeEl("svg", { "data-theme-icon-light": "" }));
  button.append(new FakeEl("svg", { "data-theme-icon-dark": "" }));
  return { env, button, docEl: env.doc.documentElement };
}

test("theme: initThemeToggle syncs aria-pressed, persists the override, and flips the icons", () => {
  const { env, button, docEl } = makeThemeEnv({ initialTheme: "light" });
  initThemeToggle(button);

  assert.equal(button.getAttribute("aria-pressed"), "false", "light theme → aria-pressed=false");
  assert.equal(button.getAttribute("aria-label"), "حالت روشن فعال است؛ تاریک کردن");
  assert.equal(env.session.has("noveno-theme"), false, "no override before the first click");

  button.dispatchEvent("click");
  assert.equal(docEl.getAttribute("data-theme"), "dark", "click applies the dark theme");
  assert.equal(env.session.get("noveno-theme"), "dark", "the override is persisted");
  assert.equal(button.getAttribute("aria-pressed"), "true", "aria-pressed flips with the theme");
  assert.equal(button.getAttribute("aria-label"), "حالت تاریک فعال است؛ روشن کردن");
  assert.equal(
    button.querySelector("[data-theme-icon-light]").style.display,
    "none",
    "the light icon hides when dark is active",
  );
  assert.equal(
    button.querySelector("[data-theme-icon-dark]").style.display,
    "block",
    "the dark icon shows when dark is active",
  );

  button.dispatchEvent("click");
  assert.equal(docEl.getAttribute("data-theme"), "light", "a second click returns to light");
  assert.equal(env.session.get("noveno-theme"), "light");
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("theme: system changes are followed only while no override exists", () => {
  const { env, button, docEl } = makeThemeEnv({ initialTheme: "light" });
  initThemeToggle(button);
  const change = env.mm.stubs.find((s) => s.query === "(prefers-color-scheme: dark)");
  assert.ok(change, "initThemeToggle must subscribe to the color-scheme media query");
  assert.equal(button.getAttribute("aria-pressed"), "false");

  // No stored override → the OS switch to dark is applied and announced.
  change.matches = true;
  for (const fn of change.listeners.change ?? []) fn();
  assert.equal(docEl.getAttribute("data-theme"), "dark", "no override → follows the system to dark");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(env.session.has("noveno-theme"), false, "following the system never persists an override");

  // OS back to light → the attribute override is cleared and the theme falls back to the system.
  change.matches = false;
  for (const fn of change.listeners.change ?? []) fn();
  assert.equal(docEl.getAttribute("data-theme"), null, "no override → clearOverride removes the attribute");
  assert.equal(button.getAttribute("aria-pressed"), "false", "effective theme is light again");
  assert.equal(env.session.has("noveno-theme"), false);

  // With an explicit override the system change must NOT win.
  env.session.set("noveno-theme", "light");
  docEl.setAttribute("data-theme", "light");
  change.matches = true;
  for (const fn of change.listeners.change ?? []) fn();
  assert.equal(docEl.getAttribute("data-theme"), "light", "an explicit override beats the system change");
  assert.equal(env.session.get("noveno-theme"), "light", "the stored override is untouched");
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("theme: unsubscribe detaches the click toggle", () => {
  const { env, button, docEl } = makeThemeEnv({ initialTheme: "light" });
  const unsubscribe = initThemeToggle(button);
  const mq = env.mm.stubs.find((s) => s.query === "(prefers-color-scheme: dark)");
  assert.ok(mq, "initThemeToggle must subscribe to the color-scheme media query");

  button.dispatchEvent("click");
  assert.equal(docEl.getAttribute("data-theme"), "dark", "the toggle works before unsubscribe");
  assert.equal(env.session.get("noveno-theme"), "dark");

  unsubscribe();
  assert.equal(mq.listeners.change?.length, 0, "the change listener is removed on unsubscribe");
  button.dispatchEvent("click");
  assert.equal(docEl.getAttribute("data-theme"), "dark", "after unsubscribe a click must no longer toggle");
});

/* ================================================================== */
/* Menu                                                                */
/* ================================================================== */

function makeMenuEnv() {
  const env = installClientGlobals();
  const trigger = new FakeEl("button");
  const firstFocusable = new FakeEl("button");
  const panel = new FakeEl("div", {}, [firstFocusable]);
  let closeCalls = 0;
  const unsubscribe = initMobileMenu(trigger, panel, () => {
    closeCalls += 1;
  });
  return { env, trigger, panel, firstFocusable, closeCount: () => closeCalls, unsubscribe };
}

test("menu: open sets state; Escape closes and returns focus to the trigger", () => {
  const { trigger, panel, firstFocusable } = makeMenuEnv();
  trigger.dispatchEvent("click");
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "opening sets aria-expanded=true");
  assert.equal(panel.hidden, false, "the panel is visible while open");
  assert.equal(panel.classList.contains("menu-open"), true, "the open transition class is applied");
  assert.equal(firstFocusable.focused, true, "focus moves into the panel");

  let prevented = false;
  globalThis.document.dispatchEvent("keydown", { key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true, "Escape must preventDefault");
  assert.equal(trigger.getAttribute("aria-expanded"), "false", "Escape closes the panel");
  assert.equal(panel.classList.contains("menu-open"), false);

  // transitionend arrives → hidden is re-applied and focus returns.
  panel.dispatchEvent("transitionend", { propertyName: "opacity" });
  assert.equal(panel.hidden, true, "hidden is re-applied after the close transition");
  assert.equal(trigger.focused, true, "focus returns to the trigger");
});

test("menu: bounded timeout fallback hides the panel when transitionend never fires; unsubscribe stops toggling", async () => {
  const { trigger, panel, closeCount } = makeMenuEnv();
  trigger.dispatchEvent("click");
  assert.equal(panel.hidden, false);

  globalThis.document.dispatchEvent("keydown", { key: "Escape", preventDefault: () => {} });
  assert.equal(panel.hidden, false, "panel stays visible until the close transition finishes");
  await sleep(350); // close fallback is 300ms
  assert.equal(panel.hidden, true, "the timeout fallback must hide the panel");
  assert.equal(trigger.focused, true, "focus returns via the fallback too");

  // A reopened panel survives the stale fallback, then unsubscribe stops toggling.
  trigger.dispatchEvent("click");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  const menuEnv = makeMenuEnv();
  menuEnv.trigger.dispatchEvent("click");
  assert.equal(menuEnv.trigger.getAttribute("aria-expanded"), "true");
  assert.equal(menuEnv.closeCount(), 0, "close() is only called on unsubscribe");
  menuEnv.unsubscribe();
  assert.equal(menuEnv.closeCount(), 1, "unsubscribe invokes the close callback");
  menuEnv.trigger.dispatchEvent("click");
  assert.equal(menuEnv.trigger.getAttribute("aria-expanded"), "true", "aria-expanded stays as-is after unsubscribe");
  assert.equal(menuEnv.panel.hidden, false, "the panel no longer reacts after unsubscribe");
});

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

test("motion: initReveal creates no IntersectionObserver under prefers-reduced-motion", () => {
  const env = installClientGlobals({ matchMedia: { reducedMotion: true } });
  const root = new FakeEl("div", {}, [new FakeEl("section", { "data-reveal": "" })]);
  initReveal(root);
  assert.equal(IntersectionObserverSpy.instances.length, 0, "reduced motion must skip the observer entirely");
  assert.equal(root.children[0].classList.contains("reveal-init"), false, "no hidden starting state under reduced motion");
});

test("motion: initReveal observes below-fold targets and reveals above-fold ones immediately", () => {
  const env = installClientGlobals({ matchMedia: { reducedMotion: false } });
  const belowA = new FakeEl("section", { "data-reveal": "" });
  belowA._rect = { top: 1500, left: 0, width: 300, height: 300 };
  const belowStagger = new FakeEl("section", { "data-reveal-stagger": "" });
  belowStagger._rect = { top: 1600, left: 0, width: 300, height: 300 };
  const above = new FakeEl("section", { "data-reveal": "" });
  above._rect = { top: 100, left: 0, width: 300, height: 300 };
  const root = new FakeEl("div", {}, [belowA, belowStagger, above]);

  initReveal(root);

  assert.equal(IntersectionObserverSpy.instances.length, 1, "exactly one shared observer");
  const observer = IntersectionObserverSpy.instances[0];
  assert.deepEqual(observer.options, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }, "observer options are pinned");
  assert.deepEqual(
    observer.observed.map((el) => el.tagName),
    ["SECTION", "SECTION"],
    "the below-fold [data-reveal] and [data-reveal-stagger] targets are observed",
  );
  assert.equal(belowA.classList.contains("reveal-init"), true, "below-fold targets get the hidden starting state");
  assert.equal(belowStagger.classList.contains("reveal-init"), true);
  assert.equal(above.classList.contains("reveal-in"), true, "already-visible targets render in their final state");
  assert.equal(above.classList.contains("reveal-init"), false);
});

test("motion: hero parallax is gated on reduced motion and fine pointer", () => {
  const env = installClientGlobals({ matchMedia: { reducedMotion: true, finePointer: true } });
  const hero = new FakeEl("div", { "data-hero-parallax": "" });
  initHeroParallax(new FakeEl("div", {}, [hero]));
  assert.equal(hero._handlers.pointermove, undefined, "reduced motion must skip parallax wiring");

  const env2 = installClientGlobals({ matchMedia: { reducedMotion: false, finePointer: false } });
  const hero2 = new FakeEl("div", { "data-hero-parallax": "" });
  initHeroParallax(new FakeEl("div", {}, [hero2]));
  assert.equal(hero2._handlers.pointermove, undefined, "non-fine pointers (touch) must skip parallax wiring");

  const env3 = installClientGlobals({ matchMedia: { reducedMotion: false, finePointer: true, minWidth1024: true } });
  const hero3 = new FakeEl("div", { "data-hero-parallax": "" });
  hero3._rect = { left: 0, top: 0, width: 100, height: 100 };
  initHeroParallax(new FakeEl("div", {}, [hero3]));
  assert.equal(hero3._handlers.pointermove?.length, 1, "fine-pointer desktop gets the parallax listener");
  hero3.dispatchEvent("pointermove", { clientX: 75, clientY: 50 });
  assert.equal(hero3.style["--par-x"], "0.500", "pointer move maps to the --par-x custom property");
  assert.equal(hero3.style["--par-y"], "0.000");
});
