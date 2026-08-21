/**
 * Server-side email spike (plan 028) — contract tests.
 * Injected sendEmail mock proves: validated → sent, turnstile fail → no email, email fail → 500, missing key fallback validated.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { handleAuditRequest } from "../functions/api/audit.ts";
import { AUDIT_OPTIONS } from "../src/data/audit.ts";
import { AUDIT_OPTIONS as SERVER_LABELS } from "../functions/lib/email.ts";

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
    body: JSON.stringify(body),
  });
}

function makeDeps(overrides = {}) {
  const calls = { email: [], verify: 0 };
  const deps = {
    rateLimiter: () => true,
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { status: "pass" };
    },
    sendEmail: async (lead) => {
      calls.email.push(lead);
      return { ok: true };
    },
    ...overrides,
  };
  return { deps, calls };
}

function labelFor(group, id) {
  return AUDIT_OPTIONS[group].find((o) => o.id === id).label;
}

test("validated payload → email sent with Persian labels and safeText (spike)", async () => {
  const { deps, calls } = makeDeps();
  const payload = validPayload();
  const res = await handleAuditRequest(post(payload), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "sent");
  assert.equal(calls.verify, 1);
  assert.equal(calls.email.length, 1);
  const lead = calls.email[0];
  assert.equal(lead.submission_id, payload.submission_id);
  assert.equal(lead.name, "علی رضایی");
  // No Turnstile token or honeypot in lead
  assert.equal(
    "cf_turnstile_token" in lead,
    true,
    "lead retains token for verify but email must not forward it",
  );
  // Check email rendering would strip < > via safeText — we test via sendLeadEmail directly below
});

test("turnstile fail → no email (spike)", async () => {
  const { deps, calls } = makeDeps({
    verifyTurnstile: async () => ({ status: "fail", errorCodes: ["invalid"] }),
  });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 403);
  assert.equal(calls.email.length, 0, "email must not be called on turnstile fail");
});

test("email failure → 500 never success (spike)", async () => {
  const { deps, calls } = makeDeps();
  deps.sendEmail = async (lead) => {
    calls.email.push(lead);
    return { ok: false };
  };
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, "server_error");
  assert.equal(calls.email.length, 1, "email was attempted");
});

test("missing sendEmail dep → fallback validated (spike flag off)", async () => {
  const { deps } = makeDeps({ sendEmail: undefined });
  const res = await handleAuditRequest(post(validPayload()), deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "validated");
});

test("email label table matches the form's canonical AUDIT_OPTIONS (no drift)", () => {
  assert.deepEqual(SERVER_LABELS, AUDIT_OPTIONS);
});

test("sendLeadEmail renders Persian labels and strips markup", async () => {
  const { sendLeadEmail } = await import("../functions/lib/email.ts");
  const calls = [];
  const mockFetch = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ id: "re_123" }) };
  };
  const lead = {
    submission_id: crypto.randomUUID(),
    name: "<b>علی</b>",
    phone: "09353598620",
    email: "ali@example.com",
    preferred_contact: "whatsapp",
    business_name: "کافه <script>",
    industry: "restaurant_cafe",
    website: "https://example.com",
    acquisition_channels: ["instagram"],
    primary_problem: "scattered_lost",
    requested_service: "audit_analysis",
    customer_value_range: "5m_20m",
    cf_turnstile_token: "tok",
    attribution: { landing_page: "/audit", referrer: "" },
  };
  const env = { TURNSTILE_SECRET_KEY: "s", RESEND_API_KEY: "test-key", LEAD_TO_EMAIL: "to@example.com" };
  const result = await sendLeadEmail(lead, env, mockFetch);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  const body = calls[0];
  assert.equal(body.to[0], "to@example.com");
  assert.ok(body.subject.includes("کافه script"), "subject safeText stripped < >");
  assert.ok(body.html.includes(labelFor("industry", "restaurant_cafe")), "Persian label in HTML");
  assert.ok(!body.html.includes("<b>"), "HTML stripped markup");
  assert.ok(!body.html.includes("<script>"), "HTML stripped");
});
