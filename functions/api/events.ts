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

import { LIMITS, type AuditEnv } from "../lib/contract.ts";
import {
  TELEMETRY_BOUNDS,
  validateTelemetryEvent,
} from "../../src/data/telemetry-contract.ts";
import {
  EVENT_SERVICE_VALUES,
  EVENT_STEP_VALUES,
  PREFERRED_CONTACTS,
} from "../lib/contract.ts";
import { errorResponse, jsonResponse } from "../lib/respond.ts";
import { createRateLimiter, type RateLimiter } from "../lib/rate-limit.ts";

interface EventInput {
  name: string;
  payload?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ingest adapter: the contract owns names, keys, and value rules (plan
 * 010); this module only supplies the server-known enum lists and the
 * metered-quota bounds before delegating. Rejects burn no Analytics
 * Engine quota.
 */
export function validateEvent(raw: unknown): { ok: true; event: EventInput } | { ok: false } {
  const result = validateTelemetryEvent(raw, {
    step: EVENT_STEP_VALUES,
    service: EVENT_SERVICE_VALUES,
    channel: PREFERRED_CONTACTS,
  });
  if (!result.ok) return { ok: false };
  if (JSON.stringify(result.event.payload).length > LIMITS.maxEventPayloadBytes) return { ok: false };
  for (const value of Object.values(result.event.payload)) {
    if (typeof value === "string" && value.length > LIMITS.maxEventPayloadValue) return { ok: false };
  }
  return result;
}

export async function handleEventRequest(
  request: Request,
  deps: { env: AuditEnv; limiter: RateLimiter },
): Promise<Response> {
  const { env, limiter } = deps;

  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", 405);
  }

  // Origin guard (plan 022): browsers attach Origin to POST/beacon; curl
  // and other non-browser probers often omit it. Require either:
  //  - a valid same-host Origin, or
  //  - a same-host Referer when Origin is absent (covers older sendBeacon
  //    edge cases). Otherwise reject — the metered Analytics Engine path
  //    must not be writable by bare curl.
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer") ?? request.headers.get("referrer") ?? "";
  const host = request.headers.get("host") ?? "";
  if (origin && !origin.startsWith("https://") && !origin.startsWith("http://")) {
    return errorResponse("validation", 400);
  }
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) return errorResponse("validation", 400);
    } catch {
      return errorResponse("validation", 400);
    }
  } else {
    // No Origin — require same-host Referer as fallback; bare curl has neither.
    if (!referer) return errorResponse("validation", 400);
    try {
      const refHost = new URL(referer).host;
      if (refHost !== host) return errorResponse("validation", 400);
    } catch {
      return errorResponse("validation", 400);
    }
  }

  // Abuse gate for the metered Analytics Engine write path (security
  // review MAJOR-2): per-IP, per-isolate, generous for real users.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!limiter(ip)) {
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
    { writeDataPoint(data: { indexes: string[]; doubles: number[]; blobs: string[] }): void } | undefined;

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

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

const eventsLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });

export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> =>
  handleEventRequest(context.request, { env: context.env, limiter: eventsLimiter });
