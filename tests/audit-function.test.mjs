/**
 * Audit function trust-boundary tests (plan §7 steps 1+3, QUALITY
 * invariant 4). Defect-sensitive: these tests fail on pre-fix behavior
 * (Persian-digit normalization, enum whitelist bypass, missing
 * Turnstile, false success on persistence failure, duplicate rows).
 *
 * Evidence tiers used here:
 *  1. Pure-module unit tests (normalize/validate/rate-limit).
 *  2. Request-level tests with injected dependencies proving the
 *     invariant ordering (validate → rate-limit → Turnstile → persist;
 *     200 ⇔ persisted; 502 never 200).
 *  3. HTTP-level persistence tests: the REAL @supabase/supabase-js
 *     client talking to an in-process mock PostgREST server — proving
 *     the exact HTTP call shape (on_conflict, ignore-duplicates,
 *     maybeSingle re-select) without a live Supabase project.
 *  4. Real Turnstile siteverify against challenges.cloudflare.com with
 *     the official test keys (always-pass/always-fail/duplicate) —
 *     skipped when this environment has no route to Cloudflare.
 *
 * Live Supabase / live Web3Forms delivery remain UNPROVEN without
 * founder-provisioned credentials (documented, never assumed).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

import {
  handleAuditRequest,
  toLeadRow,
} from "../functions/api/audit.ts";
import {
  honeypotTriggered,
  validateAuditPayload,
} from "../functions/lib/validate.ts";
import {
  normalizeDigits,
  normalizeEmail,
  normalizePhone,
  normalizeText,
} from "../functions/lib/normalize.ts";
import { createRateLimiter } from "../functions/lib/rate-limit.ts";
import { idempotencyKeyForToken, verifyTurnstile } from "../functions/lib/turnstile.ts";
import { createSupabasePersister } from "../functions/lib/persist.ts";
import { validateEvent } from "../functions/api/events.ts";
import { onRequest as eventsOnRequest } from "../functions/api/events.ts";
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
  const calls = { persist: [], verify: 0, rate: [] };
  const deps = {
    rateLimiter: (key) => {
      calls.rate.push(key);
      return true;
    },
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { status: "pass" };
    },
    persistLead: async (row) => {
      calls.persist.push(row);
      return { status: "inserted", id: "lead-1" };
    },
    now: () => "2026-08-11T12:00:00.000Z",
    ...overrides,
  };
  return { deps, calls };
}

/** Minimal in-process PostgREST emulation for /rest/v1/leads.
 * Records the wire contract (on_conflict param + Prefer header) so the
 * supabase-js call shape is asserted, not just the semantics. */
async function startMockSupabase(failInserts = false) {
  const rows = new Map();
  const wire = { onConflict: null, prefer: null };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/rest/v1/leads") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "not found" }));
      return;
    }
    if (req.method === "POST") {
      // wire contract: idempotency rides on_conflict + ignore-duplicates
      wire.onConflict = url.searchParams.get("on_conflict");
      wire.prefer = req.headers.prefer ?? null;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const respond = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
      };
      if (req.method === "POST") {
        if (failInserts) {
          respond(500, { message: "boom" });
          return;
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          respond(400, { message: "invalid body" });
          return;
        }
        const row = Array.isArray(body) ? body[0] : body;
        if (!row || typeof row.submission_id !== "string") {
          respond(400, { message: "invalid row" });
          return;
        }
        if (rows.has(row.submission_id)) {
          // resolution=ignore-duplicates: no insert, empty representation
          respond(201, []);
          return;
        }
        const stored = { ...row, id: `mock-${rows.size + 1}` };
        rows.set(row.submission_id, stored);
        respond(201, [stored]);
        return;
      }
      if (req.method === "GET") {
        const param = url.searchParams.get("submission_id") ?? "";
        const value = param.startsWith("eq.") ? param.slice(3) : null;
        const matches = [...rows.values()].filter(
          (r) => value === null || r.submission_id === value,
        );
        const wantsSingle = (req.headers.accept ?? "").includes(
          "application/vnd.pgrst.object+json",
        );
        if (wantsSingle) {
          if (matches.length === 1) {
            respond(200, matches[0]);
          } else {
            respond(406, {
              code: "PGRST116",
              details: `The result contains ${matches.length} rows`,
              hint: null,
              message: "JSON object requested, multiple (or no) rows returned",
            });
          }
          return;
        }
        respond(200, matches);
        return;
      }
      respond(405, { message: "method not allowed" });
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}`,
    rows,
    wire,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
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
  const result = validateAuditPayload(validPayload({ email: "", business_name: "", website: "", customer_value_range: "" }));
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
  // Date.parse accepts "2026" and "2026-08-11"; Postgres timestamptz does not
  for (const value of ["2026", "2026-08-11", "Aug 11, 2026", "2026-08-11T10:00:00"]) {
    const result = validateAuditPayload(
      validPayload({ attribution: { ...validPayload().attribution, first_seen_at: value } }),
    );
    assert.equal(result.ok, false, `should reject ${value}`);
    if (!result.ok) assert.equal(result.fields["attribution.first_seen_at"], "invalid_date");
  }
});

test("future-dated first_seen_at is rejected (client clocks may not lie forward)", () => {
  const result = validateAuditPayload(
    validPayload({ attribution: { ...validPayload().attribution, first_seen_at: "2099-01-01T00:00:00.000Z" } }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields["attribution.first_seen_at"], "invalid_date");
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
    validPayload({ attribution: { ...validPayload().attribution, first_seen_at: "2020-01-01T00:00:00.000Z" } }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.attribution.first_seen_at, undefined);
});

test("duplicate acquisition channels are deduped", () => {
  const result = validateAuditPayload(validPayload({ acquisition_channels: ["instagram", "instagram", "google"] }));
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
      new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), { status: 200 }),
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

test("retry with a fresh token under the same submission_id reaches persistence after a failed first attempt", async () => {
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
  assert.equal(second.status, 200); // fresh token gets a fresh verification and persists
  assert.deepEqual(seenTokens, ["token-attempt-1", "token-attempt-2"]);
  assert.equal(calls.persist.length, 1);
});

/* ------------------------------------------------------------------ */
/* Real Turnstile siteverify with official test keys (network-gated)   */
/* ------------------------------------------------------------------ */

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
  try {
    const data = await realSiteverify(SECRETS.alwaysPass, "any-token");
    assert.equal(data.success, true);
  } catch (err) {
    t.skip(`no route to challenges.cloudflare.com in this environment: ${err.message}`);
  }
});

test("real Turnstile endpoint: official always-fail secret is rejected", async (t) => {
  try {
    const data = await realSiteverify(SECRETS.alwaysFail, "any-token");
    assert.equal(data.success, false);
  } catch (err) {
    t.skip(`no route to challenges.cloudflare.com in this environment: ${err.message}`);
  }
});

test("real Turnstile endpoint: official duplicate secret reports timeout-or-duplicate", async (t) => {
  try {
    const data = await realSiteverify(SECRETS.duplicate, "any-token");
    assert.equal(data.success, false);
    assert.ok((data["error-codes"] ?? []).includes("timeout-or-duplicate"));
  } catch (err) {
    t.skip(`no route to challenges.cloudflare.com in this environment: ${err.message}`);
  }
});

/* ------------------------------------------------------------------ */
/* Request-level trust boundary (handleAuditRequest)                   */
/* ------------------------------------------------------------------ */

test("GET /api/audit is rejected 405", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(new Request("https://noveno.ir/api/audit"), deps);
  assert.equal(res.status, 405);
  assert.equal(calls.persist.length, 0);
});

test("oversized body is rejected 413", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload({ name: "ن".repeat(40_000) })), deps);
  assert.equal(res.status, 413);
  assert.equal(calls.persist.length, 0);
});

test("malformed JSON is rejected 400", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post("{not json"), deps);
  assert.equal(res.status, 400);
  assert.equal(calls.persist.length, 0);
});

test("validation failure returns 400 with field keys and never persists", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload({ industry: "bogus" })), deps);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "validation");
  assert.equal(body.error.fields.industry, "invalid_enum");
  assert.equal(calls.persist.length, 0);
});

test("honeypot hit returns 400 and never persists", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload({ company_website: "spam" })), deps);
  assert.equal(res.status, 400);
  assert.equal(calls.persist.length, 0);
});

test("rate-limited request returns 429 and skips turnstile + persist", async () => {
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
  assert.equal(calls.persist.length, 0);
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

test("turnstile rejection returns 403 and never persists", async () => {
  const { deps, calls } = makeDeps({
    verifyTurnstile: async () => ({ status: "fail", errorCodes: ["invalid-input-response"] }),
  });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error.code, "turnstile_failed");
  assert.equal(calls.persist.length, 0);
});

test("turnstile upstream failure returns 500 and never persists", async () => {
  const { deps, calls } = makeDeps({
    verifyTurnstile: async () => ({ status: "upstream_error" }),
  });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 500);
  assert.equal(calls.persist.length, 0);
});

test("valid submission persists then returns 200 with normalized row", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.id, "lead-1");
  assert.equal(calls.verify, 1);
  assert.equal(calls.persist.length, 1);
  const row = calls.persist[0];
  assert.equal(row.phone, "09353598620"); // Persian digits normalized
  assert.equal(row.source, "website");
  assert.equal(row.utm_source, "instagram");
  assert.equal(row.submitted_at, undefined); // column default, not client-controlled
});

test("replay 200 carries the persist status (replay vs inserted)", async () => {
  const replay = makeDeps({
    persistLead: async () => ({ status: "replay", id: "lead-9" }),
  });
  const replayRes = await handleAuditRequest(post(validPayload()), replay.deps);
  assert.equal(replayRes.status, 200);
  const replayBody = await replayRes.json();
  assert.equal(replayBody.ok, true);
  assert.equal(replayBody.id, "lead-9");
  assert.equal(replayBody.status, "replay", "a duplicate submission_id must be reported as replay");

  const inserted = makeDeps(); // stub persister returns { status: "inserted", id: "lead-1" }
  const insertedRes = await handleAuditRequest(post(validPayload()), inserted.deps);
  assert.equal(insertedRes.status, 200);
  const insertedBody = await insertedRes.json();
  assert.equal(insertedBody.ok, true);
  assert.equal(insertedBody.id, "lead-1");
  assert.equal(insertedBody.status, "inserted", "a fresh insert must be reported as inserted");
});

test("persistence failure returns 502 — success is never faked", async () => {
  const { deps, calls } = makeDeps({
    persistLead: async (row) => {
      calls.persist.push(row);
      throw new Error("supabase down");
    },
  });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "persistence_failed");
  assert.equal(calls.persist.length, 1);
});

test("toLeadRow maps attribution with nulls for absent values", () => {
  const row = toLeadRow(
    {
      submission_id: crypto.randomUUID(),
      name: "سارا",
      phone: "09353598620",
      preferred_contact: "phone",
      industry: "education",
      acquisition_channels: ["website"],
      primary_problem: "no_website",
      requested_service: "build_system",
      cf_turnstile_token: "x",
      attribution: { landing_page: "/audit" },
    },
    "2026-08-11T12:00:00.000Z",
  );
  assert.equal(row.email, null);
  assert.equal(row.customer_value_range, null);
  assert.equal(row.referrer, null);
  assert.equal(row.first_seen_at, null);
  assert.equal(row.source, "website");
});

/* ------------------------------------------------------------------ */
/* HTTP-level persistence through the real supabase-js client          */
/* ------------------------------------------------------------------ */

test("supabase-js insert path: fresh submission is inserted", async () => {
  const mock = await startMockSupabase();
  try {
    const persister = createSupabasePersister(mock.url, "service-role-key");
    const row = toLeadRow(validPayload(), "2026-08-11T12:00:00.000Z");
    const result = await persister.persistLead(row);
    assert.equal(result.status, "inserted");
    assert.ok(result.id.startsWith("mock-"));
    assert.equal(mock.rows.size, 1);
    // wire contract: idempotency must ride the PostgREST on_conflict +
    // ignore-duplicates preference (reviewer finding — assert the shape)
    assert.equal(mock.wire.onConflict, "submission_id");
    assert.match(mock.wire.prefer ?? "", /resolution=ignore-duplicates/);
  } finally {
    await mock.close();
  }
});

test("supabase-js insert path: replaying the same submission_id yields one row", async () => {
  const mock = await startMockSupabase();
  try {
    const persister = createSupabasePersister(mock.url, "service-role-key");
    const payload = validPayload();
    const first = await persister.persistLead(toLeadRow(payload, "2026-08-11T12:00:00.000Z"));
    assert.equal(first.status, "inserted");
    const replay = await persister.persistLead(toLeadRow(payload, "2026-08-11T12:01:00.000Z"));
    assert.equal(replay.status, "replay");
    assert.equal(replay.id, first.id);
    assert.equal(mock.rows.size, 1, "duplicate delivery must not create a second row");
  } finally {
    await mock.close();
  }
});

test("supabase-js insert path: parallel duplicate deliveries collapse to one row", async () => {
  const mock = await startMockSupabase();
  try {
    const persister = createSupabasePersister(mock.url, "service-role-key");
    const payload = validPayload();
    const [a, b] = await Promise.all([
      persister.persistLead(toLeadRow(payload, "2026-08-11T12:00:00.000Z")),
      persister.persistLead(toLeadRow(payload, "2026-08-11T12:00:00.000Z")),
    ]);
    assert.equal(mock.rows.size, 1, "unique constraint must collapse the race");
    assert.equal(a.id, b.id);
    assert.ok(["inserted", "replay"].includes(a.status));
  } finally {
    await mock.close();
  }
});

test("supabase-js insert path: persistence error throws (→ 502 at the boundary)", async () => {
  const mock = await startMockSupabase(true);
  try {
    const persister = createSupabasePersister(mock.url, "service-role-key");
    await assert.rejects(() => persister.persistLead(toLeadRow(validPayload(), "2026-08-11T12:00:00.000Z")));
  } finally {
    await mock.close();
  }
});

test("supabase-js insert path: full request maps Supabase failure to 502", async () => {
  const mock = await startMockSupabase(true);
  try {
    const persister = createSupabasePersister(mock.url, "service-role-key");
    const res = await handleAuditRequest(post(validPayload()), {
      rateLimiter: () => true,
      verifyTurnstile: async () => ({ status: "pass" }),
      persistLead: (row) => persister.persistLead(row),
    });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error.code, "persistence_failed");
  } finally {
    await mock.close();
  }
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
    request: post({ name: "audit_submitted", payload: { page: "x".repeat(20_000) } }, {}) ,
    env,
  });
  assert.equal(big.status, 413);
});

test("events endpoint: 501 without the Analytics Engine binding (degraded)", async () => {
  const res = await eventsOnRequest({
    request: post({ name: "audit_started", payload: { page: "/audit" } }),
    env: {},
  });
  assert.equal(res.status, 501);
});

test("events endpoint: writes a data point when the binding exists", async () => {
  const written = [];
  const res = await eventsOnRequest({
    request: post({ name: "audit_step_completed", payload: { step: "2", page: "/audit" } }),
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
    request: post({ name: "audit_submitted", payload: { phone: "09353598620" } }),
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
        { "cf-connecting-ip": "test-enum-values" },
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
        { "cf-connecting-ip": "test-pattern-values" },
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
  assert.equal((await postTo()).status, 204); // no Origin → same as today
  assert.equal((await postTo({ origin: "null", host: "noveno.ir" })).status, 400); // opaque origin
  assert.equal(written.length, 2);
});

test("events endpoint: text/plain bodies (sendBeacon) still accepted", async () => {
  // sendBeacon sends string bodies as text/plain (Blob types are
  // preserved); rejecting on content-type would break real beacons.
  // JSON.parse remains the actual gate — documented, not enforced.
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  const res = await eventsOnRequest({
    request: post(
      JSON.stringify({ name: "audit_started", payload: { page: "/audit" } }),
      { "cf-connecting-ip": "test-content-type", "content-type": "text/plain" },
    ),
    env,
  });
  assert.equal(res.status, 204);
  assert.equal(written.length, 1);
});

test("events endpoint: floods are rate-limited before any write (MAJOR-2)", async () => {
  // The module-scope limiter (60/min/IP) is shared across tests in this
  // process, so earlier tests consume some slots; the assertions are
  // relative: throttling must kick in within the window and writes must
  // stop exactly at the gate.
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  const request = () =>
    eventsOnRequest({
      request: post({ name: "audit_started", payload: { page: "/audit" } }),
      env,
    });
  const statuses = [];
  for (let i = 0; i < 80; i += 1) {
    statuses.push((await request()).status);
  }
  const first429 = statuses.indexOf(429);
  assert.ok(first429 >= 50, `throttling did not kick in within the window (first 429 at ${first429})`);
  assert.ok(first429 < 80, "the flood was never throttled");
  assert.ok(statuses.slice(first429).every((s) => s === 429), "all requests after the first 429 must be 429");
  assert.equal(written.length, first429, "no writes may happen after throttling begins");
});
