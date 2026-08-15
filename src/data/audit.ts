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
    id: "business",
    label: "کسب‌وکار",
    question: "کسب‌وکار شما چیست؟",
    description: "تا پیش از تماس، تصویر دقیق‌تری از وضعیت فعلی داشته باشیم.",
    fields: [
      {
        id: "business_name",
        kind: "text",
        label: "نام کسب‌وکار",
        placeholder: "مثلاً: کافه نو",
        hint: "اختیاری؛ برای این که گفت‌وگو شخصی‌تر شروع شود.",
        optional: true,
        autocomplete: "organization",
        maxlength: 120,
      },
      {
        id: "industry",
        kind: "select",
        label: "حوزه فعالیت",
        placeholder: "انتخاب کنید",
        hint: "نزدیک‌ترین گزینه را انتخاب کنید؛ «سایر» هم درست است.",
        maxlength: 40,
        options: AUDIT_OPTIONS.industry,
      },
      {
        id: "website",
        kind: "text",
        label: "وب‌سایت یا شبکه اجتماعی",
        placeholder: "مثلاً: instagram.com/your.business",
        hint: "اختیاری؛ اگر سایت یا پیج دارید.",
        optional: true,
        inputmode: "url",
        maxlength: 200,
      },
    ],
  },
  {
    id: "channels",
    label: "کانال‌ها",
    question: "مشتری فعلاً بیشتر از کجا می‌آید؟",
    description: "هر تعداد که درست است انتخاب کنید؛ چند انتخابی است.",
    fields: [
      {
        id: "acquisition_channels",
        kind: "multiselect",
        label: "کانال‌های ورود مشتری",
        maxlength: 30,
        options: AUDIT_OPTIONS.channels,
      },
    ],
  },
  {
    id: "problem",
    label: "مشکل اصلی",
    question: "مشکل اصلی مسیر جذب چیست؟",
    description: "نزدیک‌ترین گزینه به وضعیت فعلی را انتخاب کنید.",
    fields: [
      {
        id: "primary_problem",
        kind: "select",
        label: "مشکل اصلی",
        placeholder: "انتخاب کنید",
        hint: "اگر مطمئن نیستید، «مطمئن نیستیم مشکل دقیقاً چیست» را انتخاب کنید.",
        maxlength: 40,
        options: AUDIT_OPTIONS.problems,
      },
    ],
  },
  {
    id: "value",
    label: "ارزش مشتری",
    question: "ارزش تقریبی هر مشتری چقدر است؟",
    description: "بازه تقریبی کافی است؛ این مورد اختیاری است و به تمرکز بررسی کمک می‌کند.",
    fields: [
      {
        id: "customer_value_range",
        kind: "select",
        label: "ارزش تقریبی مشتری در یک سال",
        placeholder: "انتخاب کنید (اختیاری)",
        hint: "بدون حدس دقیق؛ بازه کافی است.",
        optional: true,
        maxlength: 40,
        options: AUDIT_OPTIONS.valueRanges,
      },
    ],
  },
  {
    id: "need",
    label: "نیاز",
    question: "به چه چیزی نیاز دارید؟",
    description: "اگر مطمئن نیستید، همان «هنوز مطمئن نیستم» درست است.",
    fields: [
      {
        id: "requested_service",
        kind: "select",
        label: "نیاز شما",
        placeholder: "انتخاب کنید",
        maxlength: 40,
        options: AUDIT_OPTIONS.needs,
      },
    ],
  },
  {
    id: "contact",
    label: "تماس",
    question: "چگونه با شما در تماس باشیم؟",
    description: "نام و شماره تماس برای هماهنگی گفت‌وگوی کوتاه اولیه.",
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
        id: "preferred_contact",
        kind: "select",
        label: "روش دلخواه تماس",
        placeholder: "انتخاب کنید",
        maxlength: 40,
        options: AUDIT_OPTIONS.preferredContact,
      },
      {
        id: "email",
        kind: "text",
        label: "ایمیل",
        placeholder: "you@example.com",
        optional: true,
        autocomplete: "email",
        inputmode: "email",
        maxlength: 120,
      },
    ],
  },
] as const;

/**
 * Audit progress stations — DERIVED from AUDIT_STEPS so the desktop
 * progress rail can never drift from the form (previously duplicated
 * in src/data/site.ts).
 */
export const AUDIT_STATIONS: readonly { id: string; label: string }[] = AUDIT_STEPS.map(
  ({ id, label }) => ({ id, label }),
);

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

/** Which fields are required for a step to advance (server contract). */
export function requiredFieldsForStep(stepId: string): readonly string[] {
  switch (stepId) {
    case "business":
      return ["industry"];
    case "channels":
      return ["acquisition_channels"];
    case "problem":
      return ["primary_problem"];
    case "need":
      return ["requested_service"];
    case "contact":
      return ["name", "phone", "preferred_contact"];
    default:
      return [];
  }
}
