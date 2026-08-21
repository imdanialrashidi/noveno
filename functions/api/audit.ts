/**
 * Shared response helpers + the audit request core (plan §5.5, email-only
 * architecture 2026-10).
 *
 * `handleAuditRequest` is the testable trust boundary: it takes explicit
 * dependencies (turnstile verification) so the request handling, error
 * mapping, and invariant ordering can be proven without external services.
 * `onRequest` wires the real implementations from Pages environment secrets.
 *
 * This function VALIDATES a submission; it does not persist it and does
 * not send email. Lead delivery is Web3Forms-only and happens client-side
 * after this function returns 200 `validated` — a 200 here never means
 * the email has been delivered (see src/scripts/audit.ts for the true
 * success semantics).
 *
 * The rate limiter lives at module scope: a Pages isolate instantiates
 * this module once and reuses it across requests, so the in-memory
 * window accumulates per isolate. Limiters are per-isolate by design —
 * Turnstile remains the primary abuse gate (plan §5.5).
 *
 * Mitigation 021: on validated responses the server issues a short-lived
 * HMAC receipt (validation_receipt) that the client echoes to Web3Forms —
 * see createValidationReceipt and the delivered validation_receipt field.
 */

import { LIMITS, type AuditEnv } from "../lib/contract.ts";
import { honeypotTriggered, validateAuditPayload } from "../lib/validate.ts";
import { createRateLimiter, type RateLimiter } from "../lib/rate-limit.ts";
import { idempotencyKeyForToken, verifyTurnstile, type TurnstileOutcome } from "../lib/turnstile.ts";
import type { AuditSubmission } from "../lib/contract.ts";
import { errorResponse, jsonResponse } from "../lib/respond.ts";
import { sendLeadEmail } from "../lib/email.ts";

export interface AuditDeps {
  verifyTurnstile: (submission: AuditSubmission, ip: string) => Promise<TurnstileOutcome>;
  rateLimiter: RateLimiter;
  /** HMAC key for validation receipt (reuses TURNSTILE_SECRET_KEY) */
  receiptSecret?: string;
  /** Server-side email sender (spike D-01): if provided, validated leads are emailed server-side and status becomes "sent" */
  sendEmail?: (lead: AuditSubmission) => Promise<{ ok: boolean }>;
}

/** HMAC-SHA256 hex helper using Web Crypto */
async function hmacHex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createValidationReceipt(
  submissionId: string,
  issuedAt: string,
  secret: string,
): Promise<string | null> {
  try {
    if (!secret || typeof crypto === "undefined" || !crypto.subtle) return null;
    const hex = await hmacHex(secret, `${submissionId}|${issuedAt}`);
    return `${submissionId}.${issuedAt}.${hex}`;
  } catch {
    return null;
  }
}

export async function handleAuditRequest(request: Request, deps: AuditDeps): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", 405);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > LIMITS.maxBodyBytes) {
    return errorResponse("body_too_large", 413);
  }

  // Rate gate before parsing: invalid-payload floods are throttled per IP
  // instead of consuming unthrottled parse/validation CPU (security review
  // MINOR-2). Turnstile remains the primary abuse gate for valid traffic.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!deps.rateLimiter(ip)) {
    return errorResponse("rate_limited", 429);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse("validation", 400);
  }
  if (raw.length > LIMITS.maxBodyBytes) {
    return errorResponse("body_too_large", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse("validation", 400);
  }

  // Honeypot: a filled hidden field marks automation; reject quietly as a
  // validation error (never a fake success — 200 is reserved for validated
  // submissions only).
  if (typeof body === "object" && body !== null && honeypotTriggered(body as Record<string, unknown>)) {
    return errorResponse("validation", 400);
  }

  const result = validateAuditPayload(body);
  if (!result.ok) {
    return errorResponse("validation", 400, result.fields);
  }
  const submission = result.value;

  const turnstile = await deps.verifyTurnstile(submission, ip);
  if (turnstile.status === "upstream_error") {
    return errorResponse("server_error", 500);
  }
  if (turnstile.status === "fail") {
    return errorResponse("turnstile_failed", 403);
  }

  // Spike D-01: server-side email takes precedence when configured — validated leads are emailed
  // before any client delivery. This is flag-gated: no sendEmail dep → legacy "validated" path.
  if (deps.sendEmail) {
    const sent = await deps.sendEmail(submission);
    if (!sent.ok) return errorResponse("server_error", 500);
    return jsonResponse({ ok: true, status: "sent" }, 200);
  }

  // Validation accepted — this is a validation-success response, NOT a
  // persistence or delivery confirmation. The visitor journey completes
  // only when the browser's Web3Forms delivery confirms success.
  // Mitigation 021: issue a short-lived HMAC receipt so the inbox can
  // distinguish validated leads from direct Web3Forms POSTs.
  if (deps.receiptSecret) {
    const issuedAt = new Date().toISOString();
    const receipt = await createValidationReceipt(submission.submission_id, issuedAt, deps.receiptSecret);
    if (receipt) {
      return jsonResponse({ ok: true, status: "validated", receipt }, 200);
    }
  }
  return jsonResponse({ ok: true, status: "validated" }, 200);
}

const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> => {
  const { request, env } = context;
  const hasServerEmail = Boolean((env as AuditEnv & { RESEND_API_KEY?: string }).RESEND_API_KEY);
  return handleAuditRequest(request, {
    rateLimiter: limiter,
    receiptSecret: env.TURNSTILE_SECRET_KEY,
    sendEmail: hasServerEmail ? (lead) => sendLeadEmail(lead, env) : undefined,
    verifyTurnstile: async (submission, ip) =>
      verifyTurnstile({
        secret: env.TURNSTILE_SECRET_KEY,
        token: submission.cf_turnstile_token,
        remoteIp: ip,
        idempotencyKey: await idempotencyKeyForToken(submission.cf_turnstile_token),
      }),
  });
};
