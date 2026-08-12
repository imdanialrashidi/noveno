/**
 * Acquisition-event endpoint (plan §5.8) — POST /api/events.
 *
 * Writes one event to the Cloudflare Analytics Engine binding
 * (NOVENO_EVENTS). Strictly fire-and-forget from the client's
 * perspective: this endpoint never blocks the audit journey, never
 * carries PII (event names + generic payload keys only), and degrades
 * to 501 when the binding is unavailable (local dev / preview without
 * the binding configured). Never a lead store — attribution lives on
 * the lead row, not in events.
 */

import { EVENT_NAMES, EVENT_PAYLOAD_KEYS, LIMITS, type AuditEnv } from "../lib/contract.ts";
import { errorResponse, jsonResponse } from "../lib/respond.ts";
import { createRateLimiter } from "../lib/rate-limit.ts";

interface EventInput {
  name: string;
  payload?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateEvent(raw: unknown): { ok: true; event: EventInput } | { ok: false } {
  if (!isRecord(raw)) return { ok: false };
  const name = typeof raw.name === "string" ? raw.name : "";
  if (!EVENT_NAMES.includes(name as never)) return { ok: false };

  let payload: Record<string, unknown> = {};
  if (raw.payload !== undefined) {
    if (!isRecord(raw.payload)) return { ok: false };
    const entries = Object.entries(raw.payload);
    if (entries.length > 8) return { ok: false };
    for (const [key, value] of entries) {
      if (!EVENT_PAYLOAD_KEYS.includes(key as never)) return { ok: false };
      const okValue =
        typeof value === "string" || typeof value === "number";
      if (!okValue) return { ok: false };
      if (typeof value === "string" && value.length > LIMITS.maxEventPayloadValue) return { ok: false };
      payload[key] = value;
    }
  }

  const serialized = JSON.stringify(payload);
  if (serialized.length > LIMITS.maxEventPayloadBytes) return { ok: false };

  return { ok: true, event: { name, payload } };
}

export async function onRequest(context: { request: Request; env: AuditEnv }): Promise<Response> {
  const { request, env } = context;

  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", 405);
  }

  // Abuse gate for the metered Analytics Engine write path (security
  // review MAJOR-2): per-IP, per-isolate, generous for real users.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!eventsLimiter(ip)) {
    return errorResponse("rate_limited", 429);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > LIMITS.maxEventsBodyBytes) {
    return errorResponse("body_too_large", 413);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse("validation", 400);
  }
  if (raw.length > LIMITS.maxEventsBodyBytes) {
    return errorResponse("body_too_large", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse("validation", 400);
  }

  const result = validateEvent(body);
  if (!result.ok) {
    return errorResponse("validation", 400);
  }

  const dataset = env.NOVENO_EVENTS as
    | { writeDataPoint(data: { indexes: string[]; doubles: number[]; blobs: string[] }): void }
    | undefined;

  if (!dataset || typeof dataset.writeDataPoint !== "function") {
    // Binding unavailable (local dev / not configured) — degrade, never fail hard.
    return jsonResponse({ ok: false, error: { code: "analytics_unavailable" } }, 501);
  }

  const { event } = result;
  const page = typeof event.payload?.page === "string" ? event.payload.page : "";
  const section = typeof event.payload?.section === "string" ? event.payload.section : "";
  try {
    dataset.writeDataPoint({
      indexes: [event.name],
      doubles: [Date.now()],
      blobs: [page, section, JSON.stringify(event.payload)],
    });
  } catch {
    // Analytics must never break the caller; drop silently.
    return jsonResponse({ ok: false, error: { code: "analytics_unavailable" } }, 501);
  }

  return new Response(null, { status: 204 });
}

const eventsLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });
