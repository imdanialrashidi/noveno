/**
 * Audit form client contract (Spec §31, DESIGN §11, plan §5.4).
 *
 * This module holds the UI-side shape of the audit journey: station
 * order, field definitions, option labels (Persian), and UX validation
 * rules. The authoritative server enums live in
 * `functions/lib/contract.ts`; a structural test asserts the option ids
 * here are exactly the server whitelist, so the two cannot drift.
 *
 * Values are Latin ids — labels are the display side.
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
  ] as const satisfies readonly AuditOption[],
  channels: [
    { id: "instagram", label: "اینستاگرام" },
    { id: "google", label: "گوگل" },
    { id: "advertising", label: "تبلیغات" },
    { id: "referral", label: "معرفی مشتریان قبلی" },
    { id: "in_person", label: "مراجعه حضوری" },
    { id: "website", label: "وب‌سایت" },
    { id: "other", label: "سایر" },
  ] as const satisfies readonly AuditOption[],
  problems: [
    { id: "low_requests", label: "بازدید یا دیده‌شدن داریم ولی درخواست کم است" },
    { id: "scattered_lost", label: "درخواست‌ها پراکنده‌اند یا گم می‌شوند" },
    { id: "no_website", label: "وب‌سایت یا صفحه نداریم" },
    { id: "website_unclear", label: "وب‌سایت داریم ولی عملکردش مشخص نیست" },
    { id: "weak_followup", label: "پیگیری درخواست‌ها ضعیف است" },
    { id: "unknown_channels", label: "نمی‌دانیم کدام کانال نتیجه می‌دهد" },
    { id: "not_sure", label: "مطمئن نیستیم مشکل دقیقاً چیست" },
  ] as const satisfies readonly AuditOption[],
  needs: [
    { id: "audit_analysis", label: "بررسی و تحلیل وضعیت فعلی" },
    { id: "build_system", label: "ساخت سیستم جذب" },
    { id: "redesign_path", label: "بازطراحی مسیر فعلی" },
    { id: "monthly_improvement", label: "بهبود و همراهی ماهانه" },
    { id: "not_sure_yet", label: "هنوز مطمئن نیستم" },
  ] as const satisfies readonly AuditOption[],
  valueRanges: [
    { id: "under_5m", label: "کمتر از ۵ میلیون تومان" },
    { id: "5m_20m", label: "۵ تا ۲۰ میلیون تومان" },
    { id: "20m_50m", label: "۲۰ تا ۵۰ میلیون تومان" },
    { id: "50m_200m", label: "۵۰ تا ۲۰۰ میلیون تومان" },
    { id: "over_200m", label: "بیشتر از ۲۰۰ میلیون تومان" },
  ] as const satisfies readonly AuditOption[],
  preferredContact: [
    { id: "phone", label: "تماس تلفنی" },
    { id: "whatsapp", label: "واتساپ" },
    { id: "telegram", label: "تلگرام" },
    { id: "email", label: "ایمیل" },
  ] as const satisfies readonly AuditOption[],
} as const;

export type FieldKind = "text" | "select" | "multiselect";

export interface AuditField {
  /** DOM id + draft key (matches the server contract field names). */
  id: string;
  kind: FieldKind;
  label: string;
  hint?: string;
  placeholder?: string;
  optional?: boolean;
  autocomplete?: string;
  inputmode?: "tel" | "email" | "url" | "text";
  maxlength: number;
  /** Options for select/multiselect (client label side of the enum). */
  options?: readonly AuditOption[];
}

export interface AuditStep {
  id: string;
  /** Step label (audit progress). */
  label: string;
  /** Step heading — the question. */
  question: string;
  description: string;
  fields: readonly AuditField[];
}

export const AUDIT_STEPS: readonly AuditStep[] = [
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
      },
      {
        id: "industry",
        kind: "select",
        label: "نوع کسب‌وکار",
        placeholder: "انتخاب کنید",
        hint: "نزدیک‌ترین گزینه کافی است.",
        maxlength: 40,
        options: AUDIT_OPTIONS.industry,
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
      },
      {
        id: "primary_problem",
        kind: "select",
        label: "بیشتر کجا مشکل دارید؟",
        placeholder: "انتخاب کنید",
        hint: "اگر مطمئن نیستید، گزینهٔ آخر را بزنید.",
        maxlength: 40,
        options: AUDIT_OPTIONS.problems,
      },
    ],
  },
];

/**
 * Audit progress stations — DERIVED from AUDIT_STEPS so a progress label
 * can never drift from the form. The first-contact form is a single
 * screen, so this list is one entry; the desktop rail that used to
 * render six of them went away with the multi-step journey
 * (docs/DESIGN.md §3.7).
 */
export const AUDIT_STATIONS: readonly { id: string; label: string }[] = AUDIT_STEPS.map(({ id, label }) => ({
  id,
  label,
}));

/* ------------------------------------------------------------------ */
/* UX validation rules (client-side only — server is authoritative)    */
/* ------------------------------------------------------------------ */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalize digits for client-side checks (server re-normalizes). */
function latinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function normalizePhoneClient(value: string): string {
  return latinDigits(value).replace(/[^\d+]/g, "");
}

/**
 * Returns a Persian error message key ('' = valid). Keys are mapped to
 * copy in the audit page script. Client validation is UX-only.
 */
export function validateFieldClient(fieldId: string, value: string): string {
  const trimmed = value.trim();
  switch (fieldId) {
    case "name":
      if (trimmed === "") return "required";
      if (trimmed.length < 2) return "too_short";
      if (trimmed.length > 80) return "too_long"; // mirrors server LIMITS.name
      return "";
    case "phone": {
      // Client cap (≤15 digits) is deliberately stricter than the server
      // length cap (≤24, contract.ts) — the server remains authoritative.
      const digits = normalizePhoneClient(trimmed);
      if (trimmed === "") return "required";
      if (digits.replace(/^\+/, "").length < 10 || digits.length > 15) return "invalid";
      return "";
    }
    case "email":
      if (trimmed === "") return "";
      if (trimmed.length > 120) return "too_long"; // mirrors server LIMITS.email
      if (!EMAIL_PATTERN.test(trimmed)) return "invalid";
      return "";
    case "website":
      if (trimmed === "") return "";
      if (trimmed.length > 200) return "too_long";
      return "";
    case "business_name":
      if (trimmed === "") return "";
      if (trimmed.length > 120) return "too_long";
      return "";
    case "acquisition_channels":
      return ""; // array check happens at step level
    default:
      return "";
  }
}

/**
 * Which fields are required for a step to advance (server contract).
 *
 * The first-contact form asks only what qualifies and contacts a lead
 * (2026-10 focus pass). The deeper qualification — channels, customer
 * value, requested service, preferred contact, email — happens in the
 * first conversation instead of a six-screen interview, so the server
 * treats those fields as optional and the client never invents an
 * answer for them.
 */
export function requiredFieldsForStep(stepId: string): readonly string[] {
  switch (stepId) {
    case "lead":
      return ["name", "phone", "industry", "primary_problem"];
    default:
      return [];
  }
}
