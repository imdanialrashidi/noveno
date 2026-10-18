/**
 * Audit journey — the deep module behind the audit field-definition seam.
 *
 * One interface defines the whole first-contact journey: field
 * definitions (id, kind, label, UX limits, enum options), Persian error
 * copy, step membership, payload shaping, banner routing, and the submit
 * state machine's observable statuses. The page markup renders field
 * definitions from this module (never hand-writes ids), the DOM
 * controller drives journey phases from it, and the tests cross the same
 * seam — draft persistence, Turnstile bridging, and delivery adapters
 * stay internal seams of this journey, reached only through it.
 */

import {
  AUDIT_OPTIONS,
  CLIENT_PHONE_UX_MAX,
  LEAD_ENUMS,
  labelOf,
  leadFieldKey,
  labelsOf,
  normalizePhone,
  requiredFieldsForStep,
  safeText,
} from "./lead-contract.ts";
import type { AuditOption, LeadOptionGroup } from "./lead-contract.ts";

export type JourneyFieldKind = "text" | "select" | "multiselect";

export interface JourneyField {
  /** DOM id + draft key + server contract field name. */
  id: string;
  kind: JourneyFieldKind;
  label: string;
  hint?: string;
  placeholder?: string;
  optional?: boolean;
  autocomplete?: string;
  inputmode?: "tel" | "email" | "url" | "text";
  maxlength: number;
  /** Options for select/multiselect (display side of the lead enum). */
  options?: readonly AuditOption[];
  /** Which lead-contract option group this field reads (`industry`, …). */
  optionGroup?: LeadOptionGroup;
  /** Logical input type for the text renderer (phone → tel, …). */
  inputType?: "text" | "tel" | "url" | "email";
}

export interface JourneyStep {
  id: string;
  label: string;
  question: string;
  description: string;
  fields: readonly JourneyField[];
}

/**
 * The field definitions — the seam's vocabulary. The page renders from
 * `journeyFields` filtered by step; adding a field here adds it to
 * markup, draft, validation, summary, and delivery in one edit.
 */
export const JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    id: "lead",
    label: "درخواست",
    question: "برای اینکه مسیر جذب شما را ببینم، این پنج مورد کافی است",
    description:
      "این درخواست بررسی اولیه است، نه پرسش‌نامه. هرچه بیشتر بنویسید، گفت‌وگوی اول کوتاه‌تر می‌شود.",
    fields: [
      {
        id: "name",
        kind: "text",
        label: "نام و نام خانوادگی",
        placeholder: "مثلاً: علی رضایی",
        autocomplete: "name",
        maxlength: 80,
        inputType: "text",
      },
      {
        id: "phone",
        kind: "text",
        label: "شماره تماس",
        placeholder: "۰۹۱۲ ۳۴۵ ۶۷۸۹",
        hint: "ارقام فارسی یا لاتین هر دو درست است.",
        autocomplete: "tel",
        inputmode: "tel",
        maxlength: 24,
        inputType: "tel",
      },
      {
        id: "industry",
        kind: "select",
        label: "نوع کسب‌وکار",
        placeholder: "انتخاب کنید",
        hint: "نزدیک‌ترین گزینه کافی است.",
        maxlength: 40,
        options: AUDIT_OPTIONS.industry,
        optionGroup: "industry",
      },
      {
        id: "website",
        kind: "text",
        label: "سایت یا اینستاگرام",
        placeholder: "مثلاً: instagram.com/your.business",
        hint: "اختیاری؛ اگر سایت یا پیج دارید.",
        optional: true,
        inputmode: "url",
        maxlength: 200,
        inputType: "url",
      },
      {
        id: "primary_problem",
        kind: "select",
        label: "بیشتر کجا مشکل دارید؟",
        placeholder: "انتخاب کنید",
        hint: "اگر مطمئن نیستید، گزینهٔ آخر را بزنید.",
        maxlength: 40,
        options: AUDIT_OPTIONS.problems,
        optionGroup: "problems",
      },
    ],
  },
];

/** Flat field list for renderers that don't care about steps. */
export const JOURNEY_FIELDS: readonly JourneyField[] = JOURNEY_STEPS.flatMap((s) => s.fields);

/** Progress stations — derived from the steps, never hand-written. */
export const JOURNEY_STATIONS: readonly { id: string; label: string }[] = JOURNEY_STEPS.map(
  ({ id, label }) => ({ id, label }),
);

export { requiredFieldsForStep };

/* ------------------------------------------------------------------ */
/* UX error copy (DESIGN §11) — Persian strings keyed by field+key      */
/* ------------------------------------------------------------------ */

export const FIELD_ERROR_COPY: Record<string, Record<string, string>> = {
  name: {
    required: "نام و نام خانوادگی را وارد کنید",
    too_short: "نام کوتاه است",
    too_long: "نام خیلی طولانی است",
  },
  phone: { required: "شماره تماس را وارد کنید", invalid: "شماره تماس را کامل وارد کنید" },
  email: { invalid: "ایمیل معتبر وارد کنید", too_long: "ایمیل خیلی طولانی است" },
  website: { too_long: "نشانی خیلی طولانی است" },
  business_name: { too_long: "نام کسب‌وکار خیلی طولانی است" },
  industry: { required: "یک حوزه فعالیت انتخاب کنید" },
  acquisition_channels: {
    required: "حداقل یک کانال ورود مشتری را انتخاب کنید",
    too_long: "بیشتر از این گزینه انتخاب نشود؛ فقط کانال‌های اصلی را علامت بزنید",
    invalid_enum: "یکی از گزینه‌های فهرست را انتخاب کنید",
  },
  primary_problem: { required: "یک گزینه انتخاب کنید" },
  requested_service: { required: "یک گزینه انتخاب کنید" },
  preferred_contact: { required: "روش دلخواه تماس را انتخاب کنید" },
  customer_value_range: {},
};

export function errorCopyFor(fieldId: string, key: string): string {
  return FIELD_ERROR_COPY[fieldId]?.[key] ?? "";
}

/** Client-side UX ceiling for the channel multi-select (server stays authoritative). */
export const MAX_CLIENT_CHANNELS = LEAD_ENUMS.channels.length;

export const CLIENT_PHONE_MAX = CLIENT_PHONE_UX_MAX;

/**
 * Single-field UX check ('' = valid). The lead contract owns digit floor
 * + shape; the ≤15-char phone ceiling stays this module's UX adapter
 * concern (the server length cap is authoritative).
 */
export function validateJourneyField(fieldId: string, value: string): string {
  if (fieldId === "phone" && leadFieldKey(fieldId, value) === "" && value.trim() !== "") {
    return normalizePhone(value.trim()).length > CLIENT_PHONE_UX_MAX ? "invalid" : "";
  }
  return leadFieldKey(fieldId, value);
}

/* ------------------------------------------------------------------ */
/* Payload shaping — what leaves the browser for /api/audit            */
/* ------------------------------------------------------------------ */

export interface JourneyValues {
  [fieldId: string]: string | string[];
}

export interface JourneyAttribution {
  landing_page?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  first_seen_at?: string;
}

/**
 * Build the /api/audit payload from draft values. Deeper qualification
 * (channels, requested service, preferred contact, customer value) is
 * not asked on the first-contact form: it is OMITTED, never guessed —
 * the server treats those fields as optional.
 */
export function buildJourneyPayload(
  values: JourneyValues,
  submissionId: string,
  token: string,
  honeypot: string,
  attribution: JourneyAttribution,
): Record<string, unknown> {
  const optional = (id: string): string | undefined => {
    const raw = values[id];
    const text = Array.isArray(raw) ? "" : String(raw ?? "").trim();
    return text === "" ? undefined : text;
  };
  const channels = Array.isArray(values.acquisition_channels)
    ? values.acquisition_channels.filter((id) => typeof id === "string" && id !== "")
    : [];
  return {
    submission_id: submissionId,
    company_website: honeypot,
    name: String(values.name ?? "").trim(),
    phone: normalizePhone(String(values.phone ?? "")),
    email: optional("email"),
    preferred_contact: optional("preferred_contact"),
    business_name: optional("business_name"),
    industry: String(values.industry ?? ""),
    website: optional("website"),
    ...(channels.length > 0 ? { acquisition_channels: channels } : {}),
    primary_problem: String(values.primary_problem ?? ""),
    requested_service: optional("requested_service"),
    customer_value_range: optional("customer_value_range"),
    cf_turnstile_token: token,
    attribution: {
      landing_page: attribution.landing_page,
      referrer: attribution.referrer,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      first_seen_at: attribution.first_seen_at,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Journey phases — the submit state machine's observable statuses      */
/* ------------------------------------------------------------------ */

export type JourneyPhase =
  | "idle"
  | "unconfigured"
  | "validating"
  | "turnstile"
  | "delivering"
  | "rate"
  | "validation"
  | "network"
  | "offline"
  | "delivery"
  | "done";

/**
 * Map an /api/audit response to the next phase. The success invariant
 * lives here, not in call order: only a confirmed Web3Forms delivery
 * reaches `done` — a 200 `validated` alone stays in `delivering`.
 */
export function phaseAfterServerResponse(status: number, bodyStatus?: string): JourneyPhase {
  if (status === 200) {
    return bodyStatus === "validated" || bodyStatus === "sent" ? "delivering" : "network";
  }
  if (status === 403) return "turnstile";
  if (status === 429) return "rate";
  if (status === 400) return "validation";
  return "network";
}

/** Map a failed delivery attempt to its banner phase. */
export function phaseAfterDelivery(rateLimited: boolean): JourneyPhase {
  return rateLimited ? "rate" : "delivery";
}

/* ------------------------------------------------------------------ */
/* Delivery-safe rendering — one renderer behind the journey seam       */
/* ------------------------------------------------------------------ */

export { labelOf, labelsOf, safeText };

/** Comma-joined labels for a multi-select id list. */
export function channelLabels(ids: unknown): string {
  return labelsOf("channels", ids);
}
