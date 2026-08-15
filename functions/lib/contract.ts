/**
 * Audit submission contract — the authoritative server-side field
 * definition (docs/exec-plans/active/noveno-launch.md §5.5).
 *
 * The client form (src/data/audit.ts) mirrors these values; a structural
 * test asserts the client options are an exact subset of these enums so
 * the two cannot silently drift. The server is the source of truth:
 * anything outside these whitelists is rejected before persistence.
 */

/* ------------------------------------------------------------------ */
/* Enums — canonical Latin ids (labels live client-side)               */
/* ------------------------------------------------------------------ */

export const INDUSTRIES = [
  "salon_beauty",
  "restaurant_cafe",
  "clinic_health",
  "education",
  "real_estate",
  "consulting_professional",
  "retail_shop",
  "auto_services",
  "fitness_sports",
  "manufacturing_craft",
  "other",
] as const;

export const ACQUISITION_CHANNELS = [
  "instagram",
  "google",
  "advertising",
  "referral",
  "in_person",
  "website",
  "other",
] as const;

export const PRIMARY_PROBLEMS = [
  "low_requests",
  "scattered_lost",
  "no_website",
  "website_unclear",
  "weak_followup",
  "unknown_channels",
  "not_sure",
] as const;

export const REQUESTED_SERVICES = [
  "audit_analysis",
  "build_system",
  "redesign_path",
  "monthly_improvement",
  "not_sure_yet",
] as const;

export const CUSTOMER_VALUE_RANGES = [
  "under_5m",
  "5m_20m",
  "20m_50m",
  "50m_200m",
  "over_200m",
] as const;

export const PREFERRED_CONTACTS = ["phone", "whatsapp", "telegram", "email"] as const;

/** Accepted acquisition-event names (Spec §36; no PII in any payload). */
export const EVENT_NAMES = [
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

/** Allowed payload keys for analytics events (generic, non-personal). */
export const EVENT_PAYLOAD_KEYS = [
  "page",
  "section",
  "cta_id",
  "step",
  "service",
  "slug",
  "channel",
] as const;

/**
 * Analytics `step` values — the client sends the 1-based positional
 * step index of the audit journey as a string ("1"…"6"; 6 steps in
 * AUDIT_STEPS), NOT the step ids. Bounded by the form's step count;
 * if the form gains/loses steps, update the array with it.
 */
export const EVENT_STEP_VALUES = ["1", "2", "3", "4", "5", "6"] as const;

/**
 * Analytics `service` values — union of the homepage OFFER ids
 * (audit/system/growth from src/data/site.ts OFFERS) and the audit
 * form's REQUESTED_SERVICES, both sent by the client today.
 */
export const EVENT_SERVICE_VALUES = [
  ...REQUESTED_SERVICES,
  "audit",
  "system",
  "growth",
] as const;

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
  name: 80,
  phone: 24,
  email: 120,
  businessName: 120,
  website: 200,
  landingPage: 500,
  referrer: 500,
  utm: 200,
  firstSeenAt: 40,
  /** Channel ids per submission (one full pass over the enum + slack). */
  maxChannels: 6,
  /** Analytics payload value length. */
  maxEventPayloadValue: 100,
  maxEventPayloadBytes: 1024,
} as const;

/** Honeypot field — hidden from humans; a non-empty value marks a bot. */
export const HONEYPOT_FIELD = "company_website";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/* Request/response contract (plan §5.5)                               */
/* ------------------------------------------------------------------ */

export interface AuditSubmission {
  submission_id: string;
  name: string;
  phone: string;
  email?: string;
  preferred_contact: string;
  business_name?: string;
  industry: string;
  website?: string;
  acquisition_channels: string[];
  primary_problem: string;
  requested_service: string;
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
  | "persistence_failed"
  | "method_not_allowed"
  | "body_too_large"
  | "server_error";

export interface AuditEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  NOVENO_EVENTS?: unknown;
}
