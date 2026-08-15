/**
 * Client↔server validation equivalence (plan 014, tech-debt).
 *
 * The client (src/data/audit.ts) and the server
 * (functions/lib/normalize.ts + functions/lib/validate.ts) each implement
 * phone digit-normalization and an email pattern. They cannot share a
 * module (the browser bundle must not entangle with the function's module
 * graph), so this suite pins the equivalence with tests: representative
 * inputs must produce identical outcomes on both sides, and the single
 * documented divergence (client ≤15-digit UX cap vs server ≤24 limit)
 * is asserted explicitly so nobody changes one side unnoticed.
 *
 * The only place the two sides are allowed to differ is the divergence
 * test (test 4) — any other failure here is a real desync bug.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { normalizePhoneClient, validateFieldClient } from "../src/data/audit.ts";
import { normalizePhone, normalizeEmail } from "../functions/lib/normalize.ts";
import { validateAuditPayload } from "../functions/lib/validate.ts";

/** Minimal valid payload (mirrors tests/audit-function.test.mjs). */
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

test("phone normalization equivalence: client and server agree on the corpus", () => {
  // Persian (۰-۹), Arabic-Indic (٠-٩), mixed-script, separators, whitespace,
  // international prefixes — every input must normalize identically on both
  // sides. Server normalizePhone additionally collapses multiple '+' to a
  // single leading '+' (see report note); the corpus below contains at most
  // one '+', where the two sides are defined to agree.
  const corpus = [
    "۰۹۳۵۳۵۹۸۶۲۰",
    "٠٩٣٥٣٥٩٨٦٢٠",
    "0935 359 8620",
    "0935-359-8620",
    "+98 935 359 8620",
    "00989353598620",
    "۰۹۳۵-۳۵۹-۸۶۲۰",
    " 09353598620 ",
    "۰۹35۳۵۹۸۶20", // mixed Persian + Latin digits
  ];
  for (const input of corpus) {
    assert.equal(
      normalizePhoneClient(input),
      normalizePhone(input),
      `phone normalization mismatch for ${JSON.stringify(input)}`,
    );
  }
});

test("email pattern equivalence: client acceptance matches the server", () => {
  const corpus = [
    "a@b.co",
    "user@example.com",
    "user+tag@example.com",
    "no-at-sign",
    "a@b",
    "a@b.c", // 1-char TLD — rejected by both (pattern needs a ≥2-char TLD)
    "a b@c.d",
    "a@b.c.d.e",
  ];
  for (const email of corpus) {
    const clientOk = validateFieldClient("email", email) === "";
    const serverOk = validateAuditPayload(validPayload({ email })).ok;
    assert.equal(clientOk, serverOk, `email acceptance mismatch for ${JSON.stringify(email)}`);
  }

  // The server pattern-tests the normalized form (trim + lowercase via
  // normalizeEmail); the client pattern-tests the trimmed raw value. Both
  // accept the same case/whitespace variant — pinned here via normalizeEmail.
  assert.equal(normalizeEmail("  User+Tag@Example.COM  "), "user+tag@example.com");
  assert.equal(validateFieldClient("email", "  User+Tag@Example.COM  "), "");
  assert.equal(validateAuditPayload(validPayload({ email: "  User+Tag@Example.COM  " })).ok, true);
});

test("phone validity agreement: client and server accept exactly the same phones", () => {
  // Valid on both sides.
  for (const phone of ["09353598620", "۰۹۳۵۳۵۹۸۶۲۰", "+989353598620"]) {
    assert.equal(validateFieldClient("phone", phone), "", `client rejected ${JSON.stringify(phone)}`);
    assert.equal(
      validateAuditPayload(validPayload({ phone })).ok,
      true,
      `server rejected ${JSON.stringify(phone)}`,
    );
  }
  // Invalid on both sides (too short / not digits / empty).
  for (const phone of ["12345", "abc", ""]) {
    assert.notEqual(validateFieldClient("phone", phone), "", `client accepted ${JSON.stringify(phone)}`);
    assert.equal(
      validateAuditPayload(validPayload({ phone })).ok,
      false,
      `server accepted ${JSON.stringify(phone)}`,
    );
  }
});

test("documented divergence pinned: client ≤15-digit cap vs server ≤24 limit", () => {
  // This is the ONE deliberate divergence (documented in
  // src/data/audit.ts: "Client cap (≤15 digits) is deliberately stricter
  // than the server length cap (≤24, contract.ts)"). The client validates
  // for UX only; the server remains authoritative.
  //
  // 16 digits: the client rejects (>15), the server accepts (≤24).
  const p16 = "0935359862012345";
  assert.equal(p16.length, 16);
  assert.equal(validateFieldClient("phone", p16), "invalid");
  assert.equal(validateAuditPayload(validPayload({ phone: p16 })).ok, true);

  // 15 digits: both accept.
  const p15 = "093535986201234";
  assert.equal(p15.length, 15);
  assert.equal(validateFieldClient("phone", p15), "");
  assert.equal(validateAuditPayload(validPayload({ phone: p15 })).ok, true);
});
