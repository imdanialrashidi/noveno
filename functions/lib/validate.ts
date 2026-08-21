/**
 * Server-side payload validation (plan §5.5) — the authoritative gate.
 * The client validates for UX only; this module decides what may reach
 * persistence. All enum values are whitelisted, lengths are capped, the
 * submission_id must be a UUID, attribution is shape- and time-bounded, and the
 * normalized phone must be a plausible number.
 */

import {
  ACQUISITION_CHANNELS,
  CUSTOMER_VALUE_RANGES,
  HONEYPOT_FIELD,
  INDUSTRIES,
  LIMITS,
  PREFERRED_CONTACTS,
  PRIMARY_PROBLEMS,
  REQUESTED_SERVICES,
  UUID_PATTERN,
  type AuditSubmission,
  type ValidationResult,
} from "./contract.ts";
import { normalizeEmail, normalizePhone, normalizePlain, normalizeText } from "./normalize.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Strict ISO-8601 — must also be valid Postgres timestamptz input. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
/** Client-clock skew tolerance: accept timestamps up to 5 minutes in the future. */
const FIRST_SEEN_MAX_SKEW_MS = 5 * 60_000;
/** First-seen older than 180 days is dropped (long-lived sessions are normal). */
const FIRST_SEEN_MAX_AGE_MS = 180 * 24 * 3600_000;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Honeypot check: any present, meaningful value for the hidden field → bot. Legit clients submit an empty hidden input → "". Anything else present (non-empty string, number, array, object) marks automation. */
export function honeypotTriggered(body: Record<string, unknown>): boolean {
  const value = body[HONEYPOT_FIELD];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/**
 * Validate a parsed submission body. Returns the validated + normalized
 * submission on success, or field-level message keys on failure.
 * Message keys are semantic ('required' | 'invalid' | 'too_long' |
 * 'invalid_enum' | 'invalid_uuid' | 'invalid_date') — the client maps
 * them to the DESIGN §11 Persian copy.
 */
export function validateAuditPayload(raw: unknown): ValidationResult {
  const fields: Record<string, string> = {};

  if (!isRecord(raw)) return { ok: false, fields: { body: "invalid" } };

  const fail = (field: string, key: string) => {
    fields[field] = key;
  };
  const has = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

  /* submission_id — stable client-generated UUID (idempotency key) */
  const submissionId = str(raw.submission_id) ?? "";
  if (!UUID_PATTERN.test(submissionId)) fail("submission_id", "invalid_uuid");

  /* name */
  const name = has(raw.name) ? normalizeText(raw.name) : "";
  if (name === "") fail("name", "required");
  else if (name.length > LIMITS.name) fail("name", "too_long");

  /* phone — normalized Persian/Arabic/Latin → Latin digits */
  const phone = has(raw.phone) ? normalizePhone(raw.phone) : "";
  if (phone === "") fail("phone", "required");
  else if (phone.length > LIMITS.phone) fail("phone", "too_long");
  else if (phone.replace(/\D/g, "").length < 10) fail("phone", "invalid");

  /* email — optional, format-checked when present */
  let email: string | undefined;
  if (has(raw.email)) {
    email = normalizeEmail(raw.email as string);
    if (email.length > LIMITS.email) fail("email", "too_long");
    else if (!EMAIL_PATTERN.test(email)) fail("email", "invalid");
  }

  /* preferred_contact */
  const preferredContact = str(raw.preferred_contact) ?? "";
  if (!PREFERRED_CONTACTS.includes(preferredContact as never)) fail("preferred_contact", "invalid_enum");

  /* business_name — optional */
  let businessName: string | undefined;
  if (has(raw.business_name)) {
    businessName = normalizeText(raw.business_name as string);
    if (businessName.length > LIMITS.businessName) fail("business_name", "too_long");
  }

  /* industry */
  const industry = str(raw.industry) ?? "";
  if (!INDUSTRIES.includes(industry as never)) fail("industry", "invalid_enum");

  /* website — optional, length-capped */
  let website: string | undefined;
  if (has(raw.website)) {
    website = normalizePlain(raw.website as string);
    if (website.length > LIMITS.website) fail("website", "too_long");
  }

  /* acquisition_channels — non-empty, whitelisted, deduped */
  if (!Array.isArray(raw.acquisition_channels)) {
    fail("acquisition_channels", "required");
  } else {
    const channels = [...new Set(raw.acquisition_channels)];
    if (channels.length === 0) fail("acquisition_channels", "required");
    else if (channels.length > LIMITS.maxChannels) fail("acquisition_channels", "too_long");
    else if (channels.some((c) => !ACQUISITION_CHANNELS.includes(c as never))) {
      fail("acquisition_channels", "invalid_enum");
    } else {
      raw.acquisition_channels = channels;
    }
  }

  /* primary_problem / requested_service */
  const primaryProblem = str(raw.primary_problem) ?? "";
  if (!PRIMARY_PROBLEMS.includes(primaryProblem as never)) fail("primary_problem", "invalid_enum");

  const requestedService = str(raw.requested_service) ?? "";
  if (!REQUESTED_SERVICES.includes(requestedService as never)) fail("requested_service", "invalid_enum");

  /* customer_value_range — optional enum */
  let customerValueRange: string | undefined;
  if (has(raw.customer_value_range)) {
    customerValueRange = normalizePlain(raw.customer_value_range as string);
    if (!CUSTOMER_VALUE_RANGES.includes(customerValueRange as never))
      fail("customer_value_range", "invalid_enum");
  }

  /* cf_turnstile_token — required, non-empty */
  const turnstileToken = str(raw.cf_turnstile_token) ?? "";
  if (turnstileToken === "") fail("cf_turnstile_token", "required");

  /* attribution — shape + length + time bounds (values are self-reported, not trusted) */
  const attributionRaw = raw.attribution;
  const attribution: AuditSubmission["attribution"] = {};
  if (attributionRaw !== undefined) {
    if (!isRecord(attributionRaw)) {
      fail("attribution", "invalid");
    } else {
      const check = (key: string, limit: number, field: string) => {
        const value = str(attributionRaw[key]);
        if (value === undefined) return;
        const cleaned = normalizePlain(value);
        if (cleaned.length > limit) fail(`attribution.${field}`, "too_long");
        else attribution[field as keyof AuditSubmission["attribution"]] = cleaned;
      };
      check("landing_page", LIMITS.landingPage, "landing_page");
      check("referrer", LIMITS.referrer, "referrer");
      for (const key of UTM_KEYS) check(key, LIMITS.utm, key);
      const firstSeen = str(attributionRaw.first_seen_at);
      if (firstSeen !== undefined) {
        // first_seen_at is client-clock data — bound it: no future dates
        // (5 min skew tolerance), nothing older than 180 days. Out-of-range
        // values are dropped (nulled), never stored. Attribution remains
        // self-reported (landing_page/referrer/utm_*), but timestamps that
        // would corrupt funnel analysis are not trusted.
        if (firstSeen.length > LIMITS.firstSeenAt) fail("attribution.first_seen_at", "too_long");
        else {
          const parsed = Date.parse(firstSeen);
          if (!ISO_DATE_PATTERN.test(firstSeen) || Number.isNaN(parsed)) {
            fail("attribution.first_seen_at", "invalid_date");
          } else if (parsed > Date.now() + FIRST_SEEN_MAX_SKEW_MS) {
            // Future-dated beyond skew tolerance — drop the field, never
            // reject the submission (client clocks drift; attribution is
            // self-reported). Mirrors the ancient-timestamp branch below.
          } else if (parsed >= Date.now() - FIRST_SEEN_MAX_AGE_MS) {
            attribution.first_seen_at = firstSeen;
          }
          // else: older than 180 days — an old-but-plausible session, drop the field
        }
      }
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  return {
    ok: true,
    value: {
      submission_id: submissionId.toLowerCase(),
      name,
      phone,
      ...(email !== undefined ? { email } : {}),
      preferred_contact: preferredContact,
      ...(businessName !== undefined ? { business_name: businessName } : {}),
      industry,
      ...(website !== undefined ? { website } : {}),
      acquisition_channels: [...new Set(raw.acquisition_channels as string[])],
      primary_problem: primaryProblem,
      requested_service: requestedService,
      ...(customerValueRange !== undefined ? { customer_value_range: customerValueRange } : {}),
      cf_turnstile_token: turnstileToken,
      attribution,
    },
  };
}
