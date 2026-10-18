/**
 * Audit submission contract — the authoritative server-side field
 * definition (docs/exec-plans/active/noveno-launch.md §5.5).
 *
 * Enum ids, length caps, honeypot field, and UUID shape are derived from
 * the shared `lead-contract` module — this file keeps the server-only
 * surface (event vocabulary, byte budgets, request/response types) while
 * the lead identity lives behind one interface.
 */

import { LEAD_ENUMS, LEAD_LIMITS, LEAD_UUID_PATTERN } from "../../src/data/lead-contract.ts";
import { LEAD_HONEYPOT_FIELD } from "../../src/data/lead-contract.ts";

export const INDUSTRIES = LEAD_ENUMS.industries;

export const ACQUISITION_CHANNELS = LEAD_ENUMS.channels;

export const PRIMARY_PROBLEMS = LEAD_ENUMS.problems;

export const REQUESTED_SERVICES = LEAD_ENUMS.requestedServices;

export const CUSTOMER_VALUE_RANGES = LEAD_ENUMS.valueRanges;

export const PREFERRED_CONTACTS = LEAD_ENUMS.preferredContacts;

/** Accepted acquisition-event names (Spec §36; no PII in any payload). */
export { TELEMETRY_NAMES as EVENT_NAMES } from "../../src/data/telemetry-contract.ts";

/** Allowed payload keys for analytics events (generic, non-personal). */
export { TELEMETRY_PAYLOAD_KEYS as EVENT_PAYLOAD_KEYS } from "../../src/data/telemetry-contract.ts";

/**
 * Analytics `step` values — the client sends the 1-based positional
 * step index of the audit journey as a string. Bounded by the form's
 * step count; the first-contact form is a single screen (2026-10 focus
 * pass), so the whitelist is ["1"] and must follow the form if the
 * journey ever regains steps.
 */
export const EVENT_STEP_VALUES = ["1"] as const;

/**
 * Analytics `service` values — union of the homepage OFFER ids
 * (landing/system/growth from src/data/site.ts OFFERS) and the audit
 * form's REQUESTED_SERVICES, both sent by the client today.
 */
export const EVENT_SERVICE_VALUES = [...REQUESTED_SERVICES, "landing", "system", "growth"] as const;

/** Payload value patterns for the events endpoint (non-enum keys). */
export const EVENT_VALUE_PATTERNS = {
  /** page = location.pathname — a leading-slash path; "/" (homepage) is valid. */
  page: /^\/[^\s]{0,99}$/,
  /** slug = content slugs (work/blog entries). */
  slug: /^[a-z0-9-]{1,80}$/,
  /** section / cta_id — word chars (incl. Persian) + hyphen, ≤ 40. */
  wordish: /^[\p{L}\p{N}_-]{1,40}$/u,
} as const;

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  /** Request body ceiling — the plan's ~32 KB budget. */
  maxBodyBytes: 32 * 1024,
  /** Analytics event body ceiling. */
  maxEventsBodyBytes: 16 * 1024,
  name: LEAD_LIMITS.name,
  phone: LEAD_LIMITS.phone,
  email: LEAD_LIMITS.email,
  businessName: LEAD_LIMITS.businessName,
  website: LEAD_LIMITS.website,
  landingPage: LEAD_LIMITS.landingPage,
  referrer: LEAD_LIMITS.referrer,
  utm: LEAD_LIMITS.utm,
  firstSeenAt: LEAD_LIMITS.firstSeenAt,
  /** Upper bound == full enum pass; a user may legitimately select every channel. */
  maxChannels: ACQUISITION_CHANNELS.length /** Analytics payload value length. */,
  maxEventPayloadValue: 100,
  maxEventPayloadBytes: 1024,
} as const;

/** Honeypot field — hidden from humans; a non-empty value marks a bot. */
export const HONEYPOT_FIELD = LEAD_HONEYPOT_FIELD;

export const UUID_PATTERN = LEAD_UUID_PATTERN;

/* ------------------------------------------------------------------ */
/* Request/response contract (plan §5.5)                               */
/* ------------------------------------------------------------------ */

export interface AuditSubmission {
  submission_id: string;
  name: string;
  phone: string;
  email?: string;
  /**
   * Deeper qualification is optional: the first-contact form (2026-10
   * focus pass) asks only for name, phone, business type, site-or-
   * instagram and one problem field, and never invents the answers to
   * the rest. When a client does send them they are still whitelisted.
   */
  preferred_contact?: string;
  business_name?: string;
  industry: string;
  website?: string;
  acquisition_channels?: string[];
  primary_problem: string;
  requested_service?: string;
  customer_value_range?: string;
  cf_turnstile_token: string;
  attribution: {
    landing_page?: string;
    referrer?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    first_seen_at?: string;
  };
}

export interface ValidationFailure {
  ok: false;
  fields: Record<string, string>;
}

export interface ValidationSuccess {
  ok: true;
  value: AuditSubmission;
}

export type ValidationResult = ValidationFailure | ValidationSuccess;

export type ErrorCode =
  | "validation"
  | "turnstile_failed"
  | "rate_limited"
  | "method_not_allowed"
  | "body_too_large"
  | "server_error";

export interface AuditEnv {
  TURNSTILE_SECRET_KEY: string;
  NOVENO_EVENTS?: unknown;
  /** Spike D-01 (server-side email): presence of RESEND_API_KEY arms the sent path */
  RESEND_API_KEY?: string;
  LEAD_TO_EMAIL?: string;
  EMAIL_FROM?: string;
}
