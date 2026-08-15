/**
 * Shared response helpers + the audit request core (plan §5.5).
 *
 * `handleAuditRequest` is the testable trust boundary: it takes explicit
 * dependencies (turnstile verification + persistence) so the request
 * handling, error mapping, and invariant ordering can be proven without
 * external services. `onRequest` wires the real implementations from
 * Pages environment secrets.
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
import { createSupabasePersister, type LeadRow } from "../lib/persist.ts";
import type { AuditSubmission } from "../lib/contract.ts";
import { errorResponse, jsonResponse } from "../lib/respond.ts";

export interface AuditDeps {
  verifyTurnstile: (submission: AuditSubmission, ip: string) => Promise<TurnstileOutcome>;
  persistLead: (row: LeadRow) => Promise<{ status: "inserted" | "replay"; id: string }>;
  rateLimiter: RateLimiter;
  now?: () => string;
}

/** Map a validated submission to the persistence row (leads table shape). */
export function toLeadRow(submission: AuditSubmission, submittedAt: string): LeadRow {
  const a = submission.attribution;
  return {
    submission_id: submission.submission_id,
    name: submission.name,
    phone: submission.phone,
    email: submission.email ?? null,
    preferred_contact: submission.preferred_contact,
    business_name: submission.business_name ?? null,
    industry: submission.industry,
    website: submission.website ?? null,
    acquisition_channels: submission.acquisition_channels,
    primary_problem: submission.primary_problem,
    requested_service: submission.requested_service,
    customer_value_range: submission.customer_value_range ?? null,
    source: "website",
    landing_page: a.landing_page ?? null,
    referrer: a.referrer ?? null,
    utm_source: a.utm_source ?? null,
    utm_medium: a.utm_medium ?? null,
    utm_campaign: a.utm_campaign ?? null,
    utm_content: a.utm_content ?? null,
    utm_term: a.utm_term ?? null,
    first_seen_at: a.first_seen_at ?? null,
  };
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
  // validation error (never a fake success — 200 is reserved for persisted).
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

  const submittedAt = deps.now?.() ?? new Date().toISOString();
  try {
    const persisted = await deps.persistLead(toLeadRow(submission, submittedAt));
    // 200 ⇔ Supabase accepted the row (fresh insert or idempotent replay).
    return jsonResponse({ ok: true, id: persisted.id }, 200);
  } catch {
    // Supabase failure — never a success (invariant A4-i/ii).
    return errorResponse("persistence_failed", 502);
  }
}

const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> => {
  const { request, env } = context;
  return handleAuditRequest(request, {
    rateLimiter: limiter,
    persistLead: (row) => createSupabasePersister(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY).persistLead(row),
    verifyTurnstile: async (submission, ip) =>
      verifyTurnstile({
        secret: env.TURNSTILE_SECRET_KEY,
        token: submission.cf_turnstile_token,
        remoteIp: ip,
        idempotencyKey: await idempotencyKeyForToken(submission.cf_turnstile_token),
      }),
  });
};
