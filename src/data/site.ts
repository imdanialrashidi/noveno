/**
 * Typed site-wide constants — nav, contact facts, offers, FAQ, process,
 * system components, qualification, audit stations, proof labels.
 * Contract: docs/DESIGN.md §13 (voice), docs/Noveno_Website_Master_Spec.md
 * (§8–24, §28, §31), docs/exec-plans/active/noveno-launch.md §5.3.
 */

/* ------------------------------------------------------------------ */
/* Slice-1 switchable constants (plan §11 — founder-owned decisions)   */
/* ------------------------------------------------------------------ */

/**
 * Primary CTA destination — the launch contract (plan §11, Spec §3.5).
 * Slice 1 → /contact; Slice 2 flips to /audit (the production
 * acquisition route). Direct-contact fallback routes remain available.
 */
export const CTA_URL = "/audit";

/**
 * Hero headline — approved candidate A (Spec §11.2). Single-line swap;
 * both candidates are verified to fit the display treatment (§5.2).
 */
export const HERO_HEADLINE =
  "بازدید را به یک مسیر قابل‌پیگیری برای جذب مشتری تبدیل کنید.";

export const PRIMARY_CTA_LABEL = "درخواست بررسی مسیر جذب";
export const SECONDARY_CTA_LABEL = "دیدن پروژه‌ها";

/* ------------------------------------------------------------------ */
/* Contact facts (Spec §64.1 — redundancy is a requirement)            */
/* ------------------------------------------------------------------ */

export const CONTACT = {
  phone: "09353598620",
  phoneHref: "tel:09353598620",
  whatsappHref: "https://wa.me/989353598620",
  telegramHref: "https://t.me/+989353598620",
  email: "imdanialrashidi@gmail.com",
  emailHref: "mailto:imdanialrashidi@gmail.com",
  instagramHandle: "@noveno.ir",
  instagramHref: "https://instagram.com/noveno.ir",
} as const;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_LINKS = [
  { href: "/services", label: "خدمات" },
  { href: "/work", label: "پروژه‌ها" },
  { href: "/process", label: "فرآیند" },
  { href: "/about", label: "درباره" },
] as const;

export const SITE_NAME_FA = "نوونو";
export const SITE_NAME_EN = "NOVENO";

/* ------------------------------------------------------------------ */
/* Journey Line vocabulary (DESIGN §4.1)                               */
/* ------------------------------------------------------------------ */

/** Hero route — attention becomes a captured, followed-up result (§11.5). */
export const HERO_JOURNEY = [
  { label: "توجه" },
  { label: "اقدام" },
  { label: "ثبت" },
  { label: "پیگیری" },
  { label: "نتیجه" },
] as const;

/** Six-stage acquisition model (Spec §13.3). */
export const SYSTEM_STAGES = [
  { label: "جذب", description: "اینستاگرام، گوگل، تبلیغ، معرفی و مشتری قبلی" },
  { label: "متقاعدسازی", description: "صفحه فرود، خدمات، اعتماد، پاسخ به ابهام" },
  { label: "اقدام", description: "فرم، تماس، پیام یا رزرو" },
  { label: "ثبت", description: "شناسه، منبع، درخواست و وضعیت لید ثبت می‌شود" },
  { label: "پیگیری", description: "وضعیت‌های مشخص: جدید، تماس‌گرفته‌شده، واجدشرایط، برنده/ازدست‌رفته" },
  { label: "یادگیری", description: "بازدید، تبدیل، کیفیت لید و گلوگاه‌ها بررسی می‌شوند" },
] as const;

/** Five-stage delivery process (Spec §24) — loop-back ↩. */
export const PROCESS_STAGES = [
  { label: "بررسی", description: "کسب‌وکار، مشتری، پیشنهاد، مسیر فعلی جذب، گلوگاه‌ها و محدودیت‌ها" },
  { label: "طراحی", description: "مسیر مشتری، ساختار پیام، اعتماد، CTA، ثبت لید و برنامه اندازه‌گیری" },
  { label: "اجرا", description: "فقط آنچه لازم است ساخته می‌شود؛ بدون پیچیدگی غیرضروری" },
  { label: "اندازه‌گیری", description: "اقدام‌های مهم ثبت و قابل مقایسه می‌شوند" },
  { label: "بهبود", description: "تغییرها بر اساس شواهد اولویت‌بندی می‌شوند" },
] as const;

/** Lead status strip (DESIGN §4.1 item 4 — honesty device, real states). */
export const LEAD_STATUSES = ["جدید", "تماس‌گرفته‌شده", "واجدشرایط", "برنده‌شده/ازدست‌رفته"] as const;

/* ------------------------------------------------------------------ */
/* Offers — three core offers only (Spec §14–17)                       */
/* ------------------------------------------------------------------ */

export interface Offer {
  id: string;
  name: string;
  summary: string;
  points: readonly string[];
  framing: string;
}

export const OFFERS: readonly Offer[] = [
  {
    id: "audit",
    name: "بررسی مسیر جذب",
    summary: "نقطه ورود کم‌اصطکاک برای تشخیص: مسیر فعلی کسب‌وکار شما کجا درخواست را گم می‌کند.",
    points: [
      "پیام‌رسانی، سایت یا صفحه فرود و CTA",
      "مسیر تلفن و پیام (واتساپ/دایرکت)",
      "ثبت لید و دیده‌شدن منبع ورودی",
      "پیگیری و پاسخ‌گویی",
    ],
    framing: "خروجی: تحلیل وضعیت فعلی، مسائل اولویت‌دار، مسیر مشتری پیشنهادی و برنامه اجرا.",
  },
  {
    id: "system",
    name: "طراحی و اجرای سیستم جذب",
    summary: "هسته همکاری: از توجه پراکنده تا ثبت، پیگیری و اندازه‌گیری — به اندازه نیاز کسب‌وکار.",
    points: [
      "لندینگ یا سایت خدماتی و ساختار پیام",
      "CTA، فرم و مسیر تلفن/پیام",
      "ثبت لید، منبع ورودی و وضعیت پیگیری",
      "تحلیل و گزارش‌دهی",
    ],
    framing: "سیستم بر اساس مشکل واقعی کسب‌وکار Scope می‌شود؛ نه همه اجزا برای همه.",
  },
  {
    id: "growth",
    name: "بهبود و همراهی ماهانه",
    summary: "ارزش تکرارشونده پس از اجرا: اندازه‌گیری، بهبود و نگهداری در محدوده مشخص.",
    points: [
      "بررسی تحلیلها و گزارش ماهانه",
      "بهبود کپی و CTA در محدوده تعریف‌شده",
      "بررسی قیف و بهینه‌سازی محدود",
      "QA و تغییرهای کوچک",
    ],
    framing: "همراهی ماهانه؛ نه پشتیبانی بی‌پایان.",
  },
];

/** System component building blocks (Spec §22) — not isolated products. */
export const SYSTEM_COMPONENTS = [
  "لندینگ",
  "سایت خدماتی",
  "مسیر پیام",
  "فرم لید",
  "مسیر تلفن",
  "واتساپ / پیام‌رسان",
  "ثبت لید",
  "CRM سبک",
  "تحلیل",
  "پیگیری",
  "گزارش ماهانه",
  "بهبود تبدیل",
] as const;

/* ------------------------------------------------------------------ */
/* Qualification (Spec §23)                                            */
/* ------------------------------------------------------------------ */

export const GOOD_FIT = [
  "جذب مشتری برای کسب‌وکار اهمیت اقتصادی دارد",
  "توجه یا درخواست فعلی وجود دارد (حتی پراکنده)",
  "تصمیم‌گیرنده در همکاری مشارکت می‌کند",
  "خدمت مشخصی ارائه می‌شود",
  "بودجه واقعی برای حل مسئله وجود دارد",
  "ثبت و پیگیری درخواست‌ها برای شما مهم است",
] as const;

export const BAD_FIT = [
  "انتظار تضمین فروش دارید",
  "بودجه‌ای برای حل مسئله وجود ندارد",
  "انتظار Scope بی‌پایان دارید",
  "رشد فریبنده یا ترافیک تقلبی خواسته می‌شود",
  "کسب‌وکار غیرقانونی است",
  "تصمیم‌گیرنده در دسترس نیست",
] as const;

/* ------------------------------------------------------------------ */
/* FAQ (Spec §28 — genuine purchase objections only)                   */
/* ------------------------------------------------------------------ */

export const FAQ_ITEMS = [
  {
    q: "آیا Noveno فروش را تضمین می‌کند؟",
    a: "خیر. هیچ‌کس نمی‌تواند فروش را تضمین کند و ما چنین وعده‌ای نمی‌دهیم. شاخص‌ها بر اساس داده واقعی تعریف و اندازه‌گیری می‌شوند؛ نتیجه را تا جایی که داده اجازه دهد نشان می‌دهیم.",
  },
  {
    q: "آیا فقط سایت طراحی می‌کنید؟",
    a: "خیر. تمرکز ما سیستم جذب است؛ سایت یا لندینگ فقط یکی از اجزای آن است. مسیر پیام، ثبت لید، پیگیری و اندازه‌گیری معمولاً همان جایی هستند که درخواست‌ها گم می‌شوند.",
  },
  {
    q: "اگر از قبل سایت داشته باشیم چه؟",
    a: "بررسی مسیر جذب روی وضعیت فعلی انجام می‌شود. سایت قبلی می‌تواند نقطه شروع باشد؛ نیازی به دور ریختن آن بدون دلیل نیست.",
  },
  {
    q: "پروژه معمولاً چقدر طول می‌کشد؟",
    a: "به Scope بستگی دارد. در بررسی اولیه، بازه تخمینی بر اساس مشکل واقعی اعلام می‌شود؛ قبل از آن عدد دقیق وعده‌ای بی‌اساس است.",
  },
  {
    q: "آیا بعد از تحویل پشتیبانی وجود دارد؟",
    a: "بله؛ در قالب «بهبود و همراهی ماهانه». نگهداری فنی، بررسی تحلیلها و بهبودهای کوچک در محدوده تعریف‌شده انجام می‌شود.",
  },
  {
    q: "آیا تبلیغات هم انجام می‌دهید؟",
    a: "تبلیغ بخشی از مسیر جذب است، اما تمرکز ما بر تبدیل و ثبت است. اگر مسیر بعد از بازدید خراب باشد، تبلیغ بیشتر فقط هزینه بیشتری می‌سازد؛ اول مسیر بررسی می‌شود.",
  },
  {
    q: "از چه تکنولوژی یا سیستم مدیریتی استفاده می‌کنید؟",
    a: "سیستم‌های ساده و قابل‌جایگزین که در شرایط اینترنت ایران کار کنند. پیچیدگی غیرضروری برای مشتری هزینه دارد، نه ارزش.",
  },
  {
    q: "هزینه پروژه چگونه تعیین می‌شود؟",
    a: "پس از بررسی مسیر جذب و بر اساس مشکل واقعی، Scope و هزینه مشخص می‌شود. بدون بررسی، قیمت معنا ندارد.",
  },
  {
    q: "آیا می‌توان همکاری را با بررسی مسیر فعلی شروع کرد؟",
    a: "بله؛ دقیقاً پیشنهاد ما همین است. چند سؤال کوتاه کافی است تا تصویر دقیق‌تری از وضعیت فعلی داشته باشیم.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Measurement (Spec §25)                                              */
/* ------------------------------------------------------------------ */

export const MEASURED_ACTIONS = [
  "بازدید صفحه",
  "کلیک روی CTA",
  "شروع فرم",
  "ثبت درخواست",
  "تماس",
  "کلیک روی واتساپ / پیام‌رسان",
  "لید واجدشرایط",
  "منبع ورودی",
  "وضعیت پیگیری",
] as const;

/* ------------------------------------------------------------------ */
/* Audit stations (Slice 2 — data contract lives here now)             */
/* ------------------------------------------------------------------ */

export const AUDIT_STATIONS = [
  { id: "business", label: "کسب‌وکار" },
  { id: "channels", label: "کانال‌ها" },
  { id: "problem", label: "مشکل اصلی" },
  { id: "value", label: "ارزش مشتری" },
  { id: "need", label: "نیاز" },
  { id: "contact", label: "تماس" },
] as const;

/* ------------------------------------------------------------------ */
/* Proof-type labels (DESIGN §4.3 — line-style code)                   */
/* ------------------------------------------------------------------ */

export const PROOF_LABELS = {
  "case-study": "مطالعه موردی",
  project: "پروژه",
  concept: "نمونه نمایشی",
} as const;

export const CONCEPT_DISCLAIMER = "نمونه نمایشی — سناریوی مفهومی";
export const CONCEPT_UI_LABEL = "نمونه رابط سیستم";

/* ------------------------------------------------------------------ */
/* Numerals — Persian digits are the brand default (۰–۹)               */
/* ------------------------------------------------------------------ */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert Latin digits to Persian digits (۰–۹). */
export function toFaDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Persian (jalali) year at build time: 1405 for 2026-03-21 onward. */
export function jalaliYear(date = new Date()): string {
  const year =
    date.getMonth() + 1 >= 3 ? date.getFullYear() - 621 : date.getFullYear() - 622;
  return toFaDigits(year);
}
