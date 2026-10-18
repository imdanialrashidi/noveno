/**
 * Lead contract — the single deep module behind the audit lead's identity.
 *
 * One interface owns what the other candidates kept in two or three copies:
 * option ids + Persian labels, length caps, enum whitelists, digit/email
 * normalization, client UX validation keys, and delivery-safe rendering
 * (labelOf + safeText + leadRows). Client UX checks, the server gate, the
 * draft summary, and both delivery adapters all call into this module —
 * nothing outside it enumerates an option list or strips markup by hand.
 *
 * Environment-agnostic on purpose: pure TypeScript, no DOM, no fetch, no
 * Node/Workers imports — safe for the browser bundle, Pages Functions,
 * and node --test suites alike.
 */

export interface AuditOption {
  id: string;
  label: string;
}

export const AUDIT_OPTIONS = {
  industry: [
    { id: "salon_beauty", label: "آرایشگاه و زیبایی" },
    { id: "restaurant_cafe", label: "رستوران و کافه" },
    { id: "clinic_health", label: "کلینیک و خدمات درمانی" },
    { id: "education", label: "آموزشگاه و آموزش" },
    { id: "real_estate", label: "املاک" },
    { id: "consulting_professional", label: "مشاوره و خدمات تخصصی" },
    { id: "retail_shop", label: "فروشگاه و خرده‌فروشی" },
    { id: "auto_services", label: "خدمات خودرو" },
    { id: "fitness_sports", label: "ورزش و تناسب اندام" },
    { id: "manufacturing_craft", label: "تولیدی و صنفی" },
    { id: "other", label: "سایر" },
  ],
  channels: [
    { id: "instagram", label: "اینستاگرام" },
    { id: "google", label: "گوگل" },
    { id: "advertising", label: "تبلیغات" },
    { id: "referral", label: "معرفی مشتریان قبلی" },
    { id: "in_person", label: "مراجعه حضوری" },
    { id: "website", label: "وب‌سایت" },
    { id: "other", label: "سایر" },
  ],
  problems: [
    { id: "low_requests", label: "بازدید یا دیده‌شدن داریم ولی درخواست کم است" },
    { id: "scattered_lost", label: "درخواست‌ها پراکنده‌اند یا گم می‌شوند" },
    { id: "no_website", label: "وب‌سایت یا صفحه نداریم" },
    { id: "website_unclear", label: "وب‌سایت داریم ولی عملکردش مشخص نیست" },
    { id: "weak_followup", label: "پیگیری درخواست‌ها ضعیف است" },
    { id: "unknown_channels", label: "نمی‌دانیم کدام کانال نتیجه می‌دهد" },
    { id: "not_sure", label: "مطمئن نیستیم مشکل دقیقاً چیست" },
  ],
  needs: [
    { id: "audit_analysis", label: "بررسی و تحلیل وضعیت فعلی" },
    { id: "build_system", label: "ساخت سیستم جذب" },
    { id: "redesign_path", label: "بازطراحی مسیر فعلی" },
    { id: "monthly_improvement", label: "بهبود و همراهی ماهانه" },
    { id: "not_sure_yet", label: "هنوز مطمئن نیستم" },
  ],
  valueRanges: [
    { id: "under_5m", label: "کمتر از ۵ میلیون تومان" },
    { id: "5m_20m", label: "۵ تا ۲۰ میلیون تومان" },
    { id: "20m_50m", label: "۲۰ تا ۵۰ میلیون تومان" },
    { id: "50m_200m", label: "۵۰ تا ۲۰۰ میلیون تومان" },
    { id: "over_200m", label: "بیشتر از ۲۰۰ میلیون تومان" },
  ],
  preferredContact: [
    { id: "phone", label: "تماس تلفنی" },
    { id: "whatsapp", label: "واتساپ" },
    { id: "telegram", label: "تلگرام" },
    { id: "email", label: "ایمیل" },
  ],
} as const satisfies Record<string, readonly AuditOption[]>;

export type LeadOptionGroup = keyof typeof AUDIT_OPTIONS;

const idsOf = (group: LeadOptionGroup): readonly string[] =>
  AUDIT_OPTIONS[group].map((o) => o.id);

export const LEAD_ENUMS = {
  industries: idsOf("industry"),
  channels: idsOf("channels"),
  problems: idsOf("problems"),
  requestedServices: idsOf("needs"),
  valueRanges: idsOf("valueRanges"),
  preferredContacts: idsOf("preferredContact"),
} as const;

/** Length caps — the single source of truth for client and server. */
export const LEAD_LIMITS = {
  name: 80,
  phone: 24,
  email: 120,
  businessName: 120,
  website: 200,
  landingPage: 500,
  referrer: 500,
  utm: 200,
  firstSeenAt: 40,
} as const;

export const LEAD_HONEYPOT_FIELD = "company_website";

export const LEAD_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/* Labels — the display side of every lead enum (client + both senders) */
/* ------------------------------------------------------------------ */

/** Persian label for an option id; unknown ids echo back (never throw). */
export function labelOf(group: LeadOptionGroup, id: string): string {
  return AUDIT_OPTIONS[group].find((o) => o.id === id)?.label ?? id;
}

/** Comma-joined labels for a multi-select id list. */
export function labelsOf(group: LeadOptionGroup, ids: unknown): string {
  if (!Array.isArray(ids)) return labelOf(group, String(ids ?? ""));
  return ids.map((id) => labelOf(group, String(id))).join("، ");
}

/* ------------------------------------------------------------------ */
/* Normalization — Persian/Arabic/Latin digits → Latin, text trimming   */
/* ------------------------------------------------------------------ */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Map Persian and Arabic-Indic digits to Latin digits; other chars unchanged. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/**
 * Phone normalization: any digit script → Latin, then keep only digits
 * and a single leading "+". Persian formatting like «۰۹۳۵-۳۵۹ ۸۶۲۰»
 * becomes «09102256986».
 */
export function normalizePhone(input: string): string {
  const digits = normalizeDigits(input).replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `+${digits.replace(/\+/g, "")}` : digits;
}

/** Trim + collapse internal whitespace runs (names, business names). */
export function normalizeText(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** Trim + lowercase for email (domain case-insensitivity). */
export function normalizeEmail(input: string): string {
  return normalizeText(input).toLowerCase();
}

/** Trim for URLs / attribution strings. */
export function normalizePlain(input: string): string {
  return input.trim();
}

/* ------------------------------------------------------------------ */
/* Client UX validation keys ('' = valid; server remains authoritative). */
/* Keys map to DESIGN §11 Persian copy at the call site.                */
/* ------------------------------------------------------------------ */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Single-field UX check. The phone digit floor (≥10) and email shape are
 * the shared contract; the client adds a stricter ≤15-digit UX cap on top
 * (see CLIENT_PHONE_UX_MAX below) while the server enforces the length cap.
 */
export function leadFieldKey(fieldId: string, value: string): string {
  const trimmed = value.trim();
  switch (fieldId) {
    case "name":
      if (trimmed === "") return "required";
      if (trimmed.length < 2) return "too_short";
      if (trimmed.length > LEAD_LIMITS.name) return "too_long";
      return "";
    case "phone": {
      const digits = normalizePhone(trimmed);
      if (trimmed === "") return "required";
      if (digits.replace(/^\+/, "").replace(/\D/g, "").length < 10) return "invalid";
      return "";
    }
    case "email":
      if (trimmed === "") return "";
      if (trimmed.length > LEAD_LIMITS.email) return "too_long";
      if (!EMAIL_PATTERN.test(trimmed)) return "invalid";
      return "";
    case "website":
      if (trimmed === "") return "";
      if (trimmed.length > LEAD_LIMITS.website) return "too_long";
      return "";
    case "business_name":
      if (trimmed === "") return "";
      if (trimmed.length > LEAD_LIMITS.businessName) return "too_long";
      return "";
    default:
      return "";
  }
}

/**
 * Client-only phone UX ceiling (≤15 chars incl. optional +). Deliberately
 * stricter than the server length cap (≤24) — the server stays
 * authoritative; this keeps the phone pad honest on small screens.
 */
export const CLIENT_PHONE_UX_MAX = 15;

export function leadPhoneUxKey(digits: string): string {
  return digits.length > CLIENT_PHONE_UX_MAX ? "invalid" : "";
}

/** Which fields are required for a step to advance (server contract). */
export function requiredFieldsForStep(stepId: string): readonly string[] {
  switch (stepId) {
    case "lead":
      return ["name", "phone", "industry", "primary_problem"];
    default:
      return [];
  }
}

/** Honeypot check: any present, meaningful hidden-field value marks a bot. */
export function honeypotTriggered(body: Record<string, unknown>): boolean {
  const value = body[LEAD_HONEYPOT_FIELD];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/* ------------------------------------------------------------------ */
/* Delivery-safe rendering — one renderer for Web3Forms + Resend bodies */
/* ------------------------------------------------------------------ */

/**
 * Strip markup from lead-controlled text before it lands in an HTML email.
 * Lead values are untrusted; the inbox renders HTML — never let a
 * submitted value carry tags.
 */
export function safeText(value: string): string {
  return value.replace(/[<>]/g, "");
}

/** Flat key → rendered Persian-safe string map for one validated lead. */
export function leadRows(
  lead: Record<string, unknown>,
  attribution?: Record<string, unknown>,
): Record<string, string> {
  const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
  return {
    submission_id: safeText(str(lead.submission_id)),
    name: safeText(str(lead.name)),
    phone: safeText(str(lead.phone)),
    email: safeText(str(lead.email)),
    business_name: safeText(str(lead.business_name)),
    industry: safeText(labelOf("industry", str(lead.industry))),
    website: safeText(str(lead.website)),
    acquisition_channels: Array.isArray(lead.acquisition_channels)
      ? labelsOf("channels", lead.acquisition_channels)
      : "",
    primary_problem: safeText(labelOf("problems", str(lead.primary_problem))),
    requested_service: safeText(labelOf("needs", str(lead.requested_service))),
    customer_value_range: safeText(labelOf("valueRanges", str(lead.customer_value_range))),
    preferred_contact: safeText(labelOf("preferredContact", str(lead.preferred_contact))),
    landing_page: safeText(str(attribution?.landing_page)),
    referrer: safeText(str(attribution?.referrer)),
    utm_source: safeText(str(attribution?.utm_source)),
    utm_medium: safeText(str(attribution?.utm_medium)),
    utm_campaign: safeText(str(attribution?.utm_campaign)),
  };
}
