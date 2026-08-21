/**
 * Audit function trust-boundary tests (plan §7 steps 1+3, QUALITY
 * invariant 4, email-only architecture 2026-10). Defect-sensitive:
 * these tests fail on pre-fix behavior (Persian-digit normalization,
 * enum whitelist bypass, missing Turnstile, false success on upstream
 * failure, persistence-era response semantics).
 *
 * The function VALIDATES a submission; it does not persist and does not
 * send email. Success is a validation-success response
 * ({ ok: true, status: "validated" }) — it must NOT imply the lead was
 * stored or the email delivered (delivery is Web3Forms-only, client-side).
 *
 * Evidence tiers used here:
 *  1. Pure-module unit tests (normalize/validate/rate-limit).
 *  2. Request-level tests with injected dependencies proving the
 *     invariant ordering (validate → rate-limit → Turnstile; 200 ⇔
 *     validated; upstream failures are never 200).
 *  3. Real Turnstile siteverify against challenges.cloudflare.com with
 *     the official test keys (always-pass/always-fail/duplicate) —
 *     skipped when this environment has no route to Cloudflare.
 *
 * Live Web3Forms email delivery remains UNPROVEN without founder-
 * provisioned credentials (documented, never assumed); the client-side
 * delivery semantics are covered by tests/audit-retry.test.mjs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { handleAuditRequest, onRequest as auditOnRequest } from "../functions/api/audit.ts";
import { honeypotTriggered, validateAuditPayload } from "../functions/lib/validate.ts";
import {
  normalizeDigits,
  normalizeEmail,
  normalizePhone,
  normalizeText,
} from "../functions/lib/normalize.ts";
import { createRateLimiter } from "../functions/lib/rate-limit.ts";
import { idempotencyKeyForToken, verifyTurnstile } from "../functions/lib/turnstile.ts";
import { handleEventRequest, onRequest as eventsOnRequest, validateEvent } from "../functions/api/events.ts";
import {
  ACQUISITION_CHANNELS,
  CUSTOMER_VALUE_RANGES,
  EVENT_STEP_VALUES,
  INDUSTRIES,
  PREFERRED_CONTACTS,
  PRIMARY_PROBLEMS,
  REQUESTED_SERVICES,
} from "../functions/lib/contract.ts";
import { AUDIT_OPTIONS, AUDIT_STEPS } from "../src/data/audit.ts";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function validPayload(overrides = {}) {
  return {
    submission_id: crypto.randomUUID(),
    name: "علی رضایی",
    phone: "۰۹۳۵۳۵۹۸۶۲۰",
    email: "ali@example.com",
    preferred_contact: "whatsapp",
    business_name: "کافه نمونه",
    industry: "restaurant_cafe",
    website: "https://example.com",
    acquisition_channels: ["instagram", "referral"],
    primary_problem: "scattered_lost",
    requested_service: "audit_analysis",
    customer_value_range: "5m_20m",
    cf_turnstile_token: "test-token",
    attribution: {
      landing_page: "/audit?utm_source=instagram",
      referrer: "https://instagram.com/noveno.ir",
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "launch",
      first_seen_at: "2026-08-11T10:00:00.000Z",
    },
    ...overrides,
  };
}

function post(body, headers = {}) {
  return new Request("https://noveno.ir/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeDeps(overrides = {}) {
  const calls = { verify: 0, rate: [] };
  const deps = {
    rateLimiter: (key) => {
      calls.rate.push(key);
      return true;
    },
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { status: "pass" };
    },
    ...overrides,
  };
  return { deps, calls };
}

/* ------------------------------------------------------------------ */
/* Normalization (risk R9)                                             */
/* ------------------------------------------------------------------ */

test("normalizePhone converts Persian digits to Latin", () => {
  assert.equal(normalizePhone("۰۹۳۵۳۵۹۸۶۲۰"), "09353598620");
});

test("normalizePhone converts Arabic-Indic digits to Latin", () => {
  assert.equal(normalizePhone("٠٩٣٥٣٥٩٨٦٢٠"), "09353598620");
});

test("normalizePhone strips formatting junk", () => {
  assert.equal(normalizePhone("0935-359 8620"), "09353598620");
  assert.equal(normalizePhone("(0935) 359-8620"), "09353598620");
});

test("normalizePhone keeps a single leading plus", () => {
  assert.equal(normalizePhone("+989353598620"), "+989353598620");
  assert.equal(normalizePhone("++98 935 359 8620"), "+989353598620");
});

test("normalizeDigits handles mixed digit scripts", () => {
  assert.equal(normalizeDigits("۰12٣۴۵"), "012345");
});

test("normalizeText trims and collapses whitespace", () => {
  assert.equal(normalizeText("  علی   رضایی "), "علی رضایی");
});

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  Ali@Example.COM "), "ali@example.com");
});

/* ------------------------------------------------------------------ */
/* Validation (server is authoritative)                                */
/* ------------------------------------------------------------------ */

test("valid payload passes and phone is normalized to Latin digits", () => {
  const result = validateAuditPayload(validPayload());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.phone, "09353598620");
    assert.equal(result.value.name, "علی رضایی");
    assert.equal(result.value.attribution.utm_source, "instagram");
  }
});

test("optional fields may be omitted", () => {
  const result = validateAuditPayload(
    validPayload({ email: "", business_name: "", website: "", customer_value_range: "" }),
  );
  assert.equal(result.ok, true);
});

test("missing name is rejected", () => {
  const result = validateAuditPayload(validPayload({ name: "   " }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.name, "required");
});

test("non-whitelisted industry is rejected", () => {
  const result = validateAuditPayload(validPayload({ industry: "hacking" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.industry, "invalid_enum");
});

test("implausibly short phone is rejected", () => {
  const result = validateAuditPayload(validPayload({ phone: "۱۲۳" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.phone, "invalid");
});

test("malformed email is rejected", () => {
  const result = validateAuditPayload(validPayload({ email: "not-an-email" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.email, "invalid");
});

test("non-UUID submission_id is rejected", () => {
  const result = validateAuditPayload(validPayload({ submission_id: "not-a-uuid" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.submission_id, "invalid_uuid");
});

test("unknown acquisition channel is rejected", () => {
  const result = validateAuditPayload(validPayload({ acquisition_channels: ["instagram", "telegram-ads"] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.acquisition_channels, "invalid_enum");
});

test("empty acquisition_channels is rejected", () => {
  const result = validateAuditPayload(validPayload({ acquisition_channels: [] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.acquisition_channels, "required");
});

test("all 7 distinct channels is accepted (maxChannels == enum size)", () => {
  const allChannels = [...ACQUISITION_CHANNELS];
  assert.equal(allChannels.length, 7);
  const result = validateAuditPayload(validPayload({ acquisition_channels: allChannels }));
  assert.equal(result.ok, true, "selecting all channels must be valid");
});

test("8th injected channel is rejected as too_long (whitelist still binds for invalid ids)", () => {
  const allChannels = [...ACQUISITION_CHANNELS, "injected_ch"];
  const result = validateAuditPayload(validPayload({ acquisition_channels: allChannels }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.acquisition_channels, "too_long");
  // Pure whitelist check with valid length
  const invalid = validateAuditPayload(
    validPayload({ acquisition_channels: ["instagram", "bogus_channel"] }),
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.fields.acquisition_channels, "invalid_enum");
});

test("over-long name is rejected", () => {
  const result = validateAuditPayload(validPayload({ name: "ن".repeat(100) }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.name, "too_long");
});

test("unparseable first_seen_at is rejected", () => {
  const result = validateAuditPayload(
    validPayload({ attribution: { ...validPayload().attribution, first_seen_at: "not-a-date" } }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields["attribution.first_seen_at"], "invalid_date");
});

test("JS-parseable but non-ISO first_seen_at is rejected (MINOR-1: Postgres timestamptz)", () => {
  // Date.parse accepts "2026" and "2026-08-11"; the strict ISO contract does not
  for (const value of ["2026", "2026-08-11", "Aug 11, 2026", "2026-08-11T10:00:00"]) {
    const result = validateAuditPayload(
      validPayload({ attribution: { ...validPayload().attribution, first_seen_at: value } }),
    );
    assert.equal(result.ok, false, `should reject ${value}`);
    if (!result.ok) assert.equal(result.fields["attribution.first_seen_at"], "invalid_date");
  }
});

test("future-dated first_seen_at is dropped, not stored (clock skew tolerance)", () => {
  const result = validateAuditPayload(
    validPayload({
      attribution: { ...validPayload().attribution, first_seen_at: "2099-01-01T00:00:00.000Z" },
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.attribution.first_seen_at, undefined);
});

test("first_seen_at within 4min skew is kept, beyond 6min is dropped (soft-drop window)", () => {
  const within = new Date(Date.now() + 4 * 60_000).toISOString();
  const beyond = new Date(Date.now() + 6 * 60_000).toISOString();
  const kept = validateAuditPayload(
    validPayload({ attribution: { ...validPayload().attribution, first_seen_at: within } }),
  );
  assert.equal(kept.ok, true);
  if (kept.ok) assert.equal(kept.value.attribution.first_seen_at, within);
  const dropped = validateAuditPayload(
    validPayload({ attribution: { ...validPayload().attribution, first_seen_at: beyond } }),
  );
  assert.equal(dropped.ok, true);
  if (dropped.ok) assert.equal(dropped.value.attribution.first_seen_at, undefined);
});

test("just-now first_seen_at is accepted and kept", () => {
  const justNow = new Date().toISOString();
  const result = validateAuditPayload(
    validPayload({ attribution: { ...validPayload().attribution, first_seen_at: justNow } }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.attribution.first_seen_at, justNow);
});

test("ancient first_seen_at is dropped, not stored", () => {
  const result = validateAuditPayload(
    validPayload({
      attribution: { ...validPayload().attribution, first_seen_at: "2020-01-01T00:00:00.000Z" },
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.attribution.first_seen_at, undefined);
});

test("duplicate acquisition channels are deduped", () => {
  const result = validateAuditPayload(
    validPayload({ acquisition_channels: ["instagram", "instagram", "google"] }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.acquisition_channels, ["instagram", "google"]);
});

test("over-long attribution value is rejected", () => {
  const result = validateAuditPayload(
    validPayload({ attribution: { ...validPayload().attribution, referrer: "r".repeat(600) } }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields["attribution.referrer"], "too_long");
});

test("missing turnstile token is rejected", () => {
  const result = validateAuditPayload(validPayload({ cf_turnstile_token: "" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields.cf_turnstile_token, "required");
});

test("honeypot: non-empty hidden field marks automation", () => {
  assert.equal(honeypotTriggered({ company_website: "https://spam.example" }), true);
  assert.equal(honeypotTriggered({ company_website: "  " }), false);
  assert.equal(honeypotTriggered({}), false);
});

/* ------------------------------------------------------------------ */
/* Rate limiter                                                        */
/* ------------------------------------------------------------------ */

test("rate limiter rejects bursts beyond the window and recovers", () => {
  let t = 0;
  const allow = createRateLimiter({ max: 3, windowMs: 1000, now: () => t });
  assert.equal(allow("1.2.3.4"), true);
  assert.equal(allow("1.2.3.4"), true);
  assert.equal(allow("1.2.3.4"), true);
  assert.equal(allow("1.2.3.4"), false);
  // other keys unaffected
  assert.equal(allow("5.6.7.8"), true);
  // window slides
  t = 1001;
  assert.equal(allow("1.2.3.4"), true);
});

/* ------------------------------------------------------------------ */
/* Turnstile verification (injected fetch)                             */
/* ------------------------------------------------------------------ */

test("turnstile pass outcome", async () => {
  const outcome = await verifyTurnstile({
    secret: "s",
    token: "t",
    remoteIp: null,
    idempotencyKey: "k",
    fetchImpl: async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
  });
  assert.deepEqual(outcome, { status: "pass" });
});

test("turnstile fail outcome carries error codes", async () => {
  const outcome = await verifyTurnstile({
    secret: "s",
    token: "t",
    remoteIp: null,
    idempotencyKey: "k",
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), {
        status: 200,
      }),
  });
  assert.deepEqual(outcome, { status: "fail", errorCodes: ["timeout-or-duplicate"] });
});

test("turnstile network failure is an upstream error, never a pass", async () => {
  const outcome = await verifyTurnstile({
    secret: "s",
    token: "t",
    remoteIp: null,
    idempotencyKey: "k",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.deepEqual(outcome, { status: "upstream_error" });
});

test("turnstile non-2xx response is an upstream error", async () => {
  const outcome = await verifyTurnstile({
    secret: "s",
    token: "t",
    remoteIp: null,
    idempotencyKey: "k",
    fetchImpl: async () => new Response("nope", { status: 502 }),
  });
  assert.deepEqual(outcome, { status: "upstream_error" });
});

test("idempotencyKeyForToken is deterministic, token-distinct, and a 64-char hex string", async () => {
  const a1 = await idempotencyKeyForToken("tok-A");
  const a2 = await idempotencyKeyForToken("tok-A");
  const b = await idempotencyKeyForToken("tok-B");
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.match(a1, /^[0-9a-f]{64}$/);
  assert.match(b, /^[0-9a-f]{64}$/);
});

test("siteverify idempotency_key is the token's hash, distinct per token (never the submission_id)", async () => {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    seen.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  for (const token of ["tok-1", "tok-2"]) {
    await verifyTurnstile({
      secret: "s",
      token,
      remoteIp: null,
      idempotencyKey: await idempotencyKeyForToken(token),
      fetchImpl,
    });
  }
  assert.equal(seen.length, 2);
  assert.equal(seen[0].idempotency_key, await idempotencyKeyForToken("tok-1"));
  assert.equal(seen[1].idempotency_key, await idempotencyKeyForToken("tok-2"));
  assert.notEqual(seen[0].idempotency_key, seen[1].idempotency_key);
  assert.notEqual(seen[0].idempotency_key, seen[0].response);
});

test("retry with a fresh token under the same submission_id reaches validation after a failed first attempt", async () => {
  const submissionId = crypto.randomUUID();
  const firstAttempt = validPayload({ submission_id: submissionId, cf_turnstile_token: "token-attempt-1" });
  const retryAttempt = validPayload({ submission_id: submissionId, cf_turnstile_token: "token-attempt-2" });
  const seenTokens = [];
  const { deps, calls } = makeDeps({
    verifyTurnstile: async (submission) => {
      seenTokens.push(submission.cf_turnstile_token);
      if (submission.cf_turnstile_token === "token-attempt-1") {
        return { status: "fail", errorCodes: ["timeout-or-duplicate"] };
      }
      return { status: "pass" };
    },
  });
  const first = await handleAuditRequest(post(firstAttempt), deps);
  assert.equal(first.status, 403); // expired first token is rejected
  const second = await handleAuditRequest(post(retryAttempt), deps);
  assert.equal(second.status, 200); // fresh token gets a fresh verification and validates
  assert.deepEqual(seenTokens, ["token-attempt-1", "token-attempt-2"]);
  assert.equal(seenTokens.length, 2);
});

test("onRequest wires the siteverify idempotency key to the token hash (never the submission_id)", async () => {
  // Pins the plan-001 boundary wiring: a regression reverting onRequest to
  // `idempotencyKey: submission.submission_id` must fail this test (the
  // helper-level tests above would stay green — they never see the wiring).
  const seenBodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("siteverify")) {
      seenBodies.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "mock" }), { status: 500 });
  };
  try {
    const submission = validPayload({ cf_turnstile_token: "wiring-token-1" });
    const env = { TURNSTILE_SECRET_KEY: "test-secret" };
    const res = await auditOnRequest({
      request: post(submission, { "cf-connecting-ip": "wiring-test-ip" }),
      env,
    });
    assert.equal(seenBodies.length, 1, "siteverify must be called exactly once");
    assert.equal(
      seenBodies[0].idempotency_key,
      await idempotencyKeyForToken("wiring-token-1"),
      "idempotency_key must be the token's SHA-256",
    );
    assert.notEqual(seenBodies[0].idempotency_key, submission.submission_id);
    assert.equal(res.status, 200, "validated submission must return 200");
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* ------------------------------------------------------------------ */
/* Real Turnstile siteverify with official test keys (network-gated)   */
/* ------------------------------------------------------------------ */

// Network-gated: these hit the real Cloudflare endpoint. Run with
// RUN_NETWORK_TESTS=1 to exercise them; otherwise they skip so the
// suite's result is identical in sandboxed and networked environments.
const NETWORK_TESTS_ENABLED = process.env.RUN_NETWORK_TESTS === "1";

const REAL_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SECRETS = {
  alwaysPass: "1x0000000000000000000000000000000AA",
  alwaysFail: "2x0000000000000000000000000000000AA",
  duplicate: "3x0000000000000000000000000000000AA",
};

async function realSiteverify(secret, token) {
  const res = await fetch(REAL_SITEVERIFY, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, response: token, idempotency_key: crypto.randomUUID() }),
    signal: AbortSignal.timeout(8000),
  });
  return res.json();
}

test("real Turnstile endpoint: official always-pass secret verifies", async (t) => {
  if (!NETWORK_TESTS_ENABLED) {
    t.skip("network-gated: set RUN_NETWORK_TESTS=1 to run");
    return;
  }
  const data = await realSiteverify(SECRETS.alwaysPass, "any-token");
  assert.equal(data.success, true);
});

test("real Turnstile endpoint: official always-fail secret is rejected", async (t) => {
  if (!NETWORK_TESTS_ENABLED) {
    t.skip("network-gated: set RUN_NETWORK_TESTS=1 to run");
    return;
  }
  const data = await realSiteverify(SECRETS.alwaysFail, "any-token");
  assert.equal(data.success, false);
});

test("real Turnstile endpoint: official duplicate secret reports timeout-or-duplicate", async (t) => {
  if (!NETWORK_TESTS_ENABLED) {
    t.skip("network-gated: set RUN_NETWORK_TESTS=1 to run");
    return;
  }
  const data = await realSiteverify(SECRETS.duplicate, "any-token");
  assert.equal(data.success, false);
  assert.ok((data["error-codes"] ?? []).includes("timeout-or-duplicate"));
});

/* ------------------------------------------------------------------ */
/* Request-level trust boundary (handleAuditRequest)                   */
/* ------------------------------------------------------------------ */

test("GET /api/audit is rejected 405", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(new Request("https://noveno.ir/api/audit"), deps);
  assert.equal(res.status, 405);
  assert.equal(calls.verify, 0);
});

test("oversized body is rejected 413", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload({ name: "ن".repeat(40_000) })), deps);
  assert.equal(res.status, 413);
  assert.equal(calls.verify, 0);
});

test("malformed JSON is rejected 400", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post("{not json"), deps);
  assert.equal(res.status, 400);
  assert.equal(calls.verify, 0);
});

test("validation failure returns 400 with field keys and never verifies", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload({ industry: "bogus" })), deps);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "validation");
  assert.equal(body.error.fields.industry, "invalid_enum");
  assert.equal(calls.verify, 0);
});

test("honeypot hit returns 400 and never verifies", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload({ company_website: "spam" })), deps);
  assert.equal(res.status, 400);
  assert.equal(calls.verify, 0);
});

test("rate-limited request returns 429 and skips turnstile", async () => {
  const { deps, calls } = makeDeps({
    rateLimiter: () => false,
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { status: "pass" };
    },
  });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 429);
  assert.equal(calls.verify, 0);
});

test("rate gate runs before parsing — malformed floods are throttled (MINOR-2)", async () => {
  let allowed = 2;
  const { deps, calls } = makeDeps({
    rateLimiter: () => {
      allowed -= 1;
      return allowed >= 0;
    },
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { status: "pass" };
    },
  });
  const bad = post("{not json");
  assert.equal((await handleAuditRequest(bad, deps)).status, 400);
  assert.equal((await handleAuditRequest(bad, deps)).status, 400);
  // third request from the same IP is throttled before any parse work
  const res = await handleAuditRequest(bad, deps);
  assert.equal(res.status, 429);
  assert.equal(calls.verify, 0);
});

test("turnstile rejection returns 403 and is never a success", async () => {
  const { deps, calls } = makeDeps({
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { status: "fail", errorCodes: ["invalid-input-response"] };
    },
  });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error.code, "turnstile_failed");
  assert.equal(calls.verify, 1);
});

test("turnstile upstream failure returns 500 and is never a success", async () => {
  const { deps, calls } = makeDeps({
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { status: "upstream_error" };
    },
  });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 500);
  assert.equal(calls.verify, 1);
});

test("valid submission returns 200 with the validation-success response", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "validated", "200 must mean validated — never persisted/inserted/replay");
  assert.ok(typeof body.validated_at === "string", "validated_at must be present");
  assert.ok(!Number.isNaN(Date.parse(body.validated_at)), "validated_at must be ISO date");
  // No persistence-era semantics may leak into the response.
  assert.equal("id" in body, false, "no database id in a validate-only response");
  assert.ok(
    !["inserted", "replay", "persistence_failed"].some((term) => JSON.stringify(body).includes(term)),
    "response must not carry persistence result semantics",
  );
  assert.equal(calls.verify, 1, "turnstile must be verified exactly once");
});

test("duplicate submission_id still validates — no replay/dedupe machinery (email-only trade-off)", async () => {
  // Without durable storage, exact-once dedupe is impossible by design; the
  // server validates each attempt and the client keeps submission_id stable
  // so duplicates are recognizable in the email. This test pins that the
  // boundary no longer returns replay/persistence semantics for a repeated id.
  const submissionId = crypto.randomUUID();
  const { deps } = makeDeps();
  const first = await handleAuditRequest(post(validPayload({ submission_id: submissionId })), deps);
  const second = await handleAuditRequest(post(validPayload({ submission_id: submissionId })), deps);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal((await second.json()).status, "validated");
});

test("audit validation receipt is issued when secret provided (plan 021)", async () => {
  const submissionId = crypto.randomUUID();
  const deps = makeDeps({ receiptSecret: "test-secret-key-for-hmac" }).deps;
  const res = await handleAuditRequest(post(validPayload({ submission_id: submissionId })), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "validated");
  assert.ok(typeof body.receipt === "string", "receipt must be present");
  assert.match(
    body.receipt,
    /^[0-9a-f-]{36}\.\d{4}-\d{2}-\d{2}T.*\.[0-9a-f]{64}$/,
    "receipt format: submissionId.issuedAt.hmac",
  );
  assert.ok(body.receipt.startsWith(submissionId), "receipt must start with submission_id");
  assert.ok(typeof body.validated_at === "string", "validated_at must be present");
  assert.ok(!Number.isNaN(Date.parse(body.validated_at)), "validated_at ISO");
  assert.ok(body.receipt.includes(body.validated_at), "receipt must embed validated_at");
});

test("audit validation receipt absent without secret (graceful fallback)", async () => {
  const deps = makeDeps().deps;
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "validated");
  assert.equal("receipt" in body, false, "no receipt without secret");
  assert.ok(typeof body.validated_at === "string", "validated_at present even without receipt");
  assert.ok(!Number.isNaN(Date.parse(body.validated_at)), "validated_at ISO");
});

test("sent path with receipt returns sent + receipt + validated_at", async () => {
  const submissionId = crypto.randomUUID();
  const deps = makeDeps({
    receiptSecret: "test-secret-key-for-hmac",
    sendEmail: async () => ({ ok: true }),
  }).deps;
  const res = await handleAuditRequest(post(validPayload({ submission_id: submissionId })), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "sent");
  assert.ok(typeof body.receipt === "string", "receipt must be present on sent path");
  assert.match(body.receipt, /^[0-9a-f-]{36}\.\d{4}-\d{2}-\d{2}T.*\.[0-9a-f]{64}$/);
  assert.ok(body.receipt.startsWith(submissionId));
  assert.ok(typeof body.validated_at === "string", "validated_at must be present on sent path");
  assert.ok(!Number.isNaN(Date.parse(body.validated_at)), "validated_at ISO");
  assert.ok(body.receipt.includes(body.validated_at), "receipt must embed validated_at");
});

test("sent path without receiptSecret still returns validated_at", async () => {
  const deps = makeDeps({ sendEmail: async () => ({ ok: true }) }).deps;
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "sent");
  assert.equal("receipt" in body, false, "no receipt without secret");
  assert.ok(typeof body.validated_at === "string", "validated_at present");
  assert.ok(!Number.isNaN(Date.parse(body.validated_at)));
});

test("sent path email failure returns 500", async () => {
  const deps = makeDeps({ sendEmail: async () => ({ ok: false }) }).deps;
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, "server_error");
});

test("audit validation receipt not issued on failure responses", async () => {
  const deps = makeDeps({
    receiptSecret: "test-secret",
    verifyTurnstile: async () => ({ status: "fail", errorCodes: ["invalid"] }),
  }).deps;
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal("receipt" in body, false, "no receipt on turnstile failure");
});

test("client option ids are exactly the server enum whitelists (no drift)", () => {
  const pairs = [
    [AUDIT_OPTIONS.industry.map((o) => o.id), INDUSTRIES],
    [AUDIT_OPTIONS.channels.map((o) => o.id), ACQUISITION_CHANNELS],
    [AUDIT_OPTIONS.problems.map((o) => o.id), PRIMARY_PROBLEMS],
    [AUDIT_OPTIONS.needs.map((o) => o.id), REQUESTED_SERVICES],
    [AUDIT_OPTIONS.valueRanges.map((o) => o.id), CUSTOMER_VALUE_RANGES],
    [AUDIT_OPTIONS.preferredContact.map((o) => o.id), PREFERRED_CONTACTS],
  ];
  for (const [clientIds, serverIds] of pairs) {
    assert.deepEqual(
      [...clientIds].sort(),
      [...serverIds].sort(),
      `client options ${clientIds.join(",")} drifted from server whitelist ${serverIds.join(",")}`,
    );
  }
  // Events step values: the client fires the 1-based positional step
  // index (String(draft.step)), not the AUDIT_STEPS ids — the events
  // whitelist must cover exactly 1..AUDIT_STEPS.length or real events
  // get rejected at the endpoint (plan 010).
  assert.deepEqual(
    EVENT_STEP_VALUES,
    AUDIT_STEPS.map((_, i) => String(i + 1)),
    "EVENT_STEP_VALUES drifted from the audit form's step count",
  );
});

/* ------------------------------------------------------------------ */
/* Events endpoint                                                     */
/* ------------------------------------------------------------------ */

test("validateEvent accepts whitelisted events and rejects the rest", () => {
  assert.equal(validateEvent({ name: "audit_submitted" }).ok, true);
  assert.equal(validateEvent({ name: "audit_submitted", payload: { step: "6", page: "/audit" } }).ok, true);
  assert.equal(validateEvent({ name: "not_an_event" }).ok, false);
  assert.equal(validateEvent({ name: "audit_submitted", payload: { phone: "09353598620" } }).ok, false);
  assert.equal(validateEvent({ name: "audit_submitted", payload: { name: "علی" } }).ok, false);
  assert.equal(validateEvent({ name: "audit_submitted", payload: { note: "x".repeat(500) } }).ok, false);
  assert.equal(validateEvent(null).ok, false);
  assert.equal(validateEvent([]).ok, false);
});

test("events endpoint: 405 for GET, 413 for oversized body", async () => {
  const env = {};
  const get = await eventsOnRequest({ request: new Request("https://noveno.ir/api/events"), env });
  assert.equal(get.status, 405);
  const big = await eventsOnRequest({
    request: post(
      { name: "audit_submitted", payload: { page: "x".repeat(20_000) } },
      { origin: "https://noveno.ir", host: "noveno.ir" },
    ),
    env,
  });
  assert.equal(big.status, 413);
});

test("events endpoint: 501 without the Analytics Engine binding (degraded)", async () => {
  const res = await eventsOnRequest({
    request: post(
      { name: "audit_started", payload: { page: "/audit" } },
      { origin: "https://noveno.ir", host: "noveno.ir" },
    ),
    env: {},
  });
  assert.equal(res.status, 501);
});

test("events endpoint: writes a data point when the binding exists", async () => {
  const written = [];
  const res = await eventsOnRequest({
    request: post(
      { name: "audit_step_completed", payload: { step: "2", page: "/audit" } },
      { origin: "https://noveno.ir", host: "noveno.ir" },
    ),
    env: {
      NOVENO_EVENTS: {
        writeDataPoint: (data) => written.push(data),
      },
    },
  });
  assert.equal(res.status, 204);
  assert.equal(written.length, 1);
  assert.equal(written[0].indexes[0], "audit_step_completed");
  assert.equal(typeof written[0].doubles[0], "number");
  const blobs = JSON.parse(written[0].blobs[2]);
  assert.equal(blobs.step, "2");
});

test("events endpoint: invalid payload returns 400 without writing", async () => {
  const written = [];
  const res = await eventsOnRequest({
    request: post(
      { name: "audit_submitted", payload: { phone: "09353598620" } },
      { origin: "https://noveno.ir", host: "noveno.ir" },
    ),
    env: { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } },
  });
  assert.equal(res.status, 400);
  assert.equal(written.length, 0);
});

test("events endpoint: enum payload values are whitelisted (step/service/channel)", async () => {
  // Distinct cf-connecting-ip: the module-scope limiter (60/min/IP) is
  // shared across tests, and the flood test below asserts throttling
  // kicks in within a window — new requests must not eat that bucket.
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  const postTo = (payload) =>
    eventsOnRequest({
      request: post(
        { name: "audit_submitted", payload },
        { "cf-connecting-ip": "test-enum-values", origin: "https://noveno.ir", host: "noveno.ir" },
      ),
      env,
    });
  assert.equal((await postTo({ step: "not_a_step" })).status, 400);
  assert.equal((await postTo({ step: "3" })).status, 204);
  assert.equal((await postTo({ step: 3 })).status, 400); // numbers rejected
  assert.equal((await postTo({ service: "system" })).status, 204);
  assert.equal((await postTo({ service: "audit_analysis" })).status, 204);
  assert.equal((await postTo({ channel: "whatsapp" })).status, 204);
  assert.equal(written.length, 4);
});

test("events endpoint: pattern payload values are enforced (page/slug/section)", async () => {
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  const postTo = (payload) =>
    eventsOnRequest({
      request: post(
        { name: "audit_submitted", payload },
        { "cf-connecting-ip": "test-pattern-values", origin: "https://noveno.ir", host: "noveno.ir" },
      ),
      env,
    });
  assert.equal((await postTo({ page: "not-a-path" })).status, 400);
  assert.equal((await postTo({ page: "/" })).status, 204); // homepage fires real events
  assert.equal((await postTo({ page: "/audit" })).status, 204);
  assert.equal((await postTo({ slug: "Bad Slug!" })).status, 400);
  assert.equal((await postTo({ section: "hero" })).status, 204);
  assert.equal((await postTo({ section: "bad section!" })).status, 400);
  assert.equal(written.length, 3);
});

test("events endpoint: cross-site Origin is rejected, same-site passes (beacon guard)", async () => {
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  // The post() helper builds a Request without a Host header (undici does
  // not synthesize one), so the legit case must pass host explicitly or
  // the guard's originHost !== host comparison would 400 it.
  const postTo = (headers = {}) =>
    eventsOnRequest({
      request: post(
        { name: "audit_started", payload: { page: "/audit" } },
        { "cf-connecting-ip": "test-cross-site", ...headers },
      ),
      env,
    });
  assert.equal((await postTo({ origin: "https://evil.example", host: "noveno.ir" })).status, 400);
  assert.equal((await postTo({ origin: "https://noveno.ir", host: "noveno.ir" })).status, 204);
  assert.equal((await postTo({ referer: "https://noveno.ir/audit", host: "noveno.ir" })).status, 204); // no Origin but valid Referer → 204
  assert.equal((await postTo()).status, 400); // no Origin and no Referer → 400 (curl)
  assert.equal((await postTo({ origin: "null", host: "noveno.ir" })).status, 400); // opaque origin
  assert.equal(written.length, 2);
});

test("events endpoint: no-Origin without Referer is rejected (curl guard)", async () => {
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  const res = await eventsOnRequest({
    request: post({ name: "audit_started", payload: { page: "/audit" } }),
    env: { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } },
  });
  assert.equal(res.status, 400);
  assert.equal(written.length, 0);
});

test("events endpoint: text/plain bodies (sendBeacon) still accepted", async () => {
  // sendBeacon sends string bodies as text/plain (Blob types are
  // preserved); rejecting on content-type would break real beacons.
  // JSON.parse remains the actual gate — documented, not enforced.
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  const res = await eventsOnRequest({
    request: post(JSON.stringify({ name: "audit_started", payload: { page: "/audit" } }), {
      "cf-connecting-ip": "test-content-type",
      "content-type": "text/plain",
      origin: "https://noveno.ir",
      host: "noveno.ir",
    }),
    env,
  });
  assert.equal(res.status, 204);
  assert.equal(written.length, 1);
});

test("events endpoint: floods are rate-limited before any write (MAJOR-2)", async () => {
  // Injected limiter (60/min) so this test is exact and order-independent:
  // the module-scope limiter is shared across tests in this process, but
  // this one owns its own bucket and must see throttling at exactly max.
  const written = [];
  const limiter = createRateLimiter({ max: 60, windowMs: 60_000 });
  const request = () =>
    handleEventRequest(
      post(
        { name: "audit_started", payload: { page: "/audit" } },
        { origin: "https://noveno.ir", host: "noveno.ir" },
      ),
      {
        env: { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } },
        limiter,
      },
    );
  const statuses = [];
  for (let i = 0; i < 80; i += 1) {
    statuses.push((await request()).status);
  }
  const first429 = statuses.indexOf(429);
  assert.equal(first429, 60, "throttling must begin exactly at the limiter max");
  assert.ok(statuses.slice(first429).every((s) => s === 429));
  assert.equal(written.length, 60, "no writes may happen after throttling begins");
});

test("honeypot triggers on any meaningful value shape, not only non-empty strings", () => {
  assert.equal(honeypotTriggered({}), false, "absent field not triggered");
  assert.equal(honeypotTriggered({ company_website: "" }), false);
  assert.equal(honeypotTriggered({ company_website: "   " }), false);
  assert.equal(honeypotTriggered({ company_website: "spam" }), true);
  assert.equal(honeypotTriggered({ company_website: true }), true);
  assert.equal(honeypotTriggered({ company_website: 42 }), true);
  assert.equal(honeypotTriggered({ company_website: ["x"] }), true);
  assert.equal(honeypotTriggered({ company_website: {} }), true);
  assert.equal(honeypotTriggered({ company_website: null }), false);
  assert.equal(honeypotTriggered({ company_website: undefined }), false);
});

test("API responses carry no-store and nosniff headers (audit)", async () => {
  const { deps } = makeDeps();
  const res = await handleAuditRequest(post(validPayload({ name: "   " })), deps); // validation 400
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
});

test("events 204 carries no-store and nosniff", async () => {
  const written = [];
  const res = await eventsOnRequest({
    request: post(
      { name: "audit_started", payload: { page: "/audit" } },
      { origin: "https://noveno.ir", host: "noveno.ir" },
    ),
    env: { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("limiter sweeps expired keys beyond the tracking bound", () => {
  let t = 0;
  const rl = createRateLimiter({ max: 1, windowMs: 1_000, now: () => t });
  for (let i = 0; i < 10_001; i++) rl(`ip-${i}`);
  assert.ok(rl.size > 10_000, "exceeds bound before sweep");
  // Next call triggers sweep (size > MAX)
  t = 2_000; // advance beyond window so all old keys are expired
  rl("ip-new");
  // After sweep, size should have shrunk dramatically (only keys within window remain)
  assert.ok(rl.size <= 2, `after sweep size should be small, got ${rl.size}`);
});

test("limiter size getter reflects tracked keys", () => {
  const rl = createRateLimiter({ max: 10, windowMs: 60_000, now: () => 0 });
  assert.equal(rl.size, 0);
  rl("a");
  assert.equal(rl.size, 1);
  rl("b");
  assert.equal(rl.size, 2);
});
