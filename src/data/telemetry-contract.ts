/**
 * Acquisition telemetry contract — the deep module behind the event seam.
 *
 * One interface owns the event vocabulary (names, payload keys, enum value
 * whitelists, length/pattern rules) plus the serialization the client
 * queue and the server gate both enforce: coerce → validate → serialize.
 * The browser queue (`track` in analytics.ts) and the Pages ingest
 * (`validateEvent` in functions/api/events.ts) become adapters over this
 * interface — callers name events once, in one typed surface.
 */

import { LEAD_LIMITS } from "./lead-contract.ts";

/** Accepted acquisition-event names (Spec §36; no PII in any payload). */
export const TELEMETRY_NAMES = [
  "primary_cta_click",
  "secondary_cta_click",
  "audit_started",
  "audit_step_completed",
  "audit_submitted",
  "phone_click",
  "messaging_click",
  "service_opened",
  "case_study_opened",
  "project_opened",
] as const;

export type TelemetryName = (typeof TELEMETRY_NAMES)[number];

/** Allowed payload keys (generic, non-personal — never name/phone/email). */
export const TELEMETRY_PAYLOAD_KEYS = [
  "page",
  "section",
  "cta_id",
  "step",
  "service",
  "slug",
  "channel",
] as const;

export type TelemetryPayload = Record<string, string | number>;

export interface TelemetryEvent {
  name: string;
  payload: Record<string, unknown>;
}

const TELEMETRY_PATTERNS = {
  /** page = location.pathname — a leading-slash path; "/" (homepage) is valid. */
  page: /^\/[^\s]{0,99}$/,
  /** slug = content slugs (work/blog entries). */
  slug: /^[a-z0-9-]{1,80}$/,
  /** section / cta_id — word chars (incl. Persian) + hyphen, ≤ 40. */
  wordish: /^[\p{L}\p{N}_-]{1,40}$/u,
} as const;

export const TELEMETRY_BOUNDS = {
  maxKeys: 8,
  maxValueLength: 100,
  maxPayloadBytes: 1024,
} as const;

/**
 * Validate a raw inbound event body against the contract. Returns the
 * normalized event (name + payload) — the only shape the ingest path may
 * write to the metered store.
 */
export function validateTelemetryEvent(
  raw: unknown,
  enums: { step: readonly string[]; service: readonly string[]; channel: readonly string[] },
): { ok: true; event: TelemetryEvent } | { ok: false } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false };
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : "";
  if (!(TELEMETRY_NAMES as readonly string[]).includes(name)) return { ok: false };

  let payload: Record<string, unknown> = {};
  if (body.payload !== undefined) {
    if (typeof body.payload !== "object" || body.payload === null || Array.isArray(body.payload)) {
      return { ok: false };
    }
    const entries = Object.entries(body.payload as Record<string, unknown>);
    if (entries.length > TELEMETRY_BOUNDS.maxKeys) return { ok: false };
    for (const [key, value] of entries) {
      if (!(TELEMETRY_PAYLOAD_KEYS as readonly string[]).includes(key)) return { ok: false };
      if (typeof value !== "string" && typeof value !== "number") return { ok: false };
      if (typeof value === "string" && value.length > TELEMETRY_BOUNDS.maxValueLength) return { ok: false };
      if (key === "step" || key === "service" || key === "channel") {
        const allowed = key === "step" ? enums.step : key === "service" ? enums.service : enums.channel;
        if (typeof value !== "string" || !allowed.includes(value)) return { ok: false };
      } else if (typeof value === "string") {
        const pattern =
          key === "page"
            ? TELEMETRY_PATTERNS.page
            : key === "slug"
              ? TELEMETRY_PATTERNS.slug
              : TELEMETRY_PATTERNS.wordish;
        if (!pattern.test(value)) return { ok: false };
      }
      payload[key] = value;
    }
  }

  if (JSON.stringify(payload).length > TELEMETRY_BOUNDS.maxPayloadBytes) return { ok: false };
  return { ok: true, event: { name, payload } };
}

/**
 * Serialize one outbound event: coerce values to the contract shape and
 * stamp the page. Shared by the browser queue adapter so queue payloads
 * and ingest payloads are identical by construction.
 */
export function serializeTelemetryEvent(
  name: TelemetryName,
  payload: TelemetryPayload,
  page: string,
): TelemetryEvent {
  const merged: Record<string, unknown> = { ...payload, page };
  return { name, payload: merged };
}

/** Attribution clamps shared by the draft adapter (bytes, not trust). */
export const ATTRIBUTION_BOUNDS = {
  landingPage: LEAD_LIMITS.landingPage,
  referrer: LEAD_LIMITS.referrer,
  utm: LEAD_LIMITS.utm,
} as const;
