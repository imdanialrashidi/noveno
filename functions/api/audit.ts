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
 */

import { LIMITS, type AuditEnv } from "../lib/contract.ts";
import { honeypotTriggered, validateAuditPayload } from "../lib/validate.ts";
import { createRateLimiter, type RateLimiter } from "../lib/rate-limit.ts";
import { idempotencyKeyForToken, verifyTurnstile, type TurnstileOutcome } from "../lib/turnstile.ts";
import type { AuditSubmission } from "../lib/contract.ts";
import { errorResponse, jsonResponse } from "../lib/respond.ts";

export interface AuditDeps {
  verifyTurnstile: (submission: AuditSubmission, ip: string) => Promise<TurnstileOutcome>;
  rateLimiter: RateLimiter;
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

  // Validation accepted — this is a validation-success response, NOT a
  // persistence or delivery confirmation. The visitor journey completes
  // only when the browser's Web3Forms delivery confirms success.
  return jsonResponse({ ok: true, status: "validated" }, 200);
}

const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> => {
  const { request, env } = context;
  return handleAuditRequest(request, {
    rateLimiter: limiter,
    verifyTurnstile: async (submission, ip) =>
      verifyTurnstile({
        secret: env.TURNSTILE_SECRET_KEY,
        token: submission.cf_turnstile_token,
        remoteIp: ip,
        idempotencyKey: await idempotencyKeyForToken(submission.cf_turnstile_token),
      }),
  });
};
