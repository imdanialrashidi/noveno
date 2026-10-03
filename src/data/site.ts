/**
 * Typed site-wide constants — nav, contact facts, offers, FAQ, process,
 * system components, qualification, proof labels.
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
 * Hero headline — the founder's positioning line (2026-10 focus pass,
 * docs/DESIGN.md §0). It replaces the abstract former headline: it
 * states the business outcome, not the mechanism.
 */
export const HERO_HEADLINE = "سایت شما باید مشتری واقعی بیاورد، نه فقط بازدید.";

/** Hero kicker — one line that names the category and the audience. */
export const HERO_KICKER = "سیستم جذب مشتری برای کسب‌وکارهای خدماتی";

/** Hero support — two clauses, no paragraph. */
export const HERO_LEAD =
  "نوونو برای کسب‌وکارهای خدماتی، مسیر جذب را می‌سازد: از بازدید تا ثبت درخواست و پیگیری.";

/** Hero microcopy — what happens if they click, stated honestly. */
export const HERO_MICROCOPY = "بررسی اولیه رایگان است و حدود دو دقیقه وقت می‌گیرد. فروش تضمین نمی‌شود.";

export const PRIMARY_CTA_LABEL = "درخواست بررسی مسیر جذب";
export const SECONDARY_CTA_LABEL = "دیدن نمونه‌کارها";

/* ------------------------------------------------------------------ */
/* Search Console verification                                         */
/* ------------------------------------------------------------------ */

/**
 * Google Search Console HTML-tag verification token.
 *
 * This is a **public identifier, not a secret**: the tag exists precisely
 * so that anyone — including Google's crawler — can read it from the served
 * homepage. It grants no access and must never be treated as a credential.
 *
 * Google reads this meta tag from the homepage `<head>`. It is rendered by
 * `BaseLayout` so every route carries it, which guarantees the homepage
 * does too.
 *
 * To rotate: issue a new token in Search Console → Settings → Ownership
 * verification → HTML tags, replace this value, then re-verify.
 */
export const GOOGLE_SITE_VERIFICATION = "2iOJHcK1PglZdQc_FBOOZRu55LmikB_HLm0BUjACqWw";

/* ------------------------------------------------------------------ */
/* Contact facts (Spec §64.1 — redundancy is a requirement)            */
/* ------------------------------------------------------------------ */

export const CONTACT = {
  phone: "09102256986",
  phoneHref: "tel:09102256986",
  /** E.164-ish international form for schema.org `telephone` (no formatting tricks). */
  phoneIntl: "+98-910-225-6986",
  whatsappHref: "https://wa.me/989102256986",
  telegramHref: "https://t.me/noveno_ir",
  email: "imdanialrashidi@gmail.com",
  emailHref: "mailto:imdanialrashidi@gmail.com",
  instagramHandle: "@noveno_ir",
  instagramHref: "https://instagram.com/noveno_ir",
} as const;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Primary navigation (2026-10 focus pass): five links plus one action.
 * `/services` and `/work` keep their URLs — only the labels changed to
 * the founder's product language (راهکارها / نمونه‌کار). Supporting
 * pages (`/process`, `/blog`, `/contact`, legal) stay reachable through
 * the footer and in-context links; no route is deleted for simplicity.
 */
export const NAV_LINKS = [
  { href: "/", label: "خانه" },
  { href: "/services", label: "راهکارها" },
  { href: "/work", label: "نمونه‌کار" },
  { href: "/pricing", label: "قیمت" },
  { href: "/about", label: "درباره" },
] as const;

export const SITE_NAME_EN = "NOVENO";

/* ------------------------------------------------------------------ */
/* Vocabulary (2026-08-14 founder redesign — the route-band grammar    */
/* was removed from the public design; only the six-stage model and    */
/* the five-stage process survive as editorial copy/data).             */
/* ------------------------------------------------------------------ */

/** Six-stage acquisition model (Spec §13.3). */
export const SYSTEM_STAGES = [
  { label: "جذب", description: "اینستاگرام، گوگل، تبلیغ، معرفی و مشتری قبلی" },
  { label: "متقاعدسازی", description: "صفحه فرود، خدمات، اعتماد، پاسخ به ابهام" },
  { label: "اقدام", description: "فرم، تماس، پیام یا رزرو" },
  { label: "ثبت", description: "شناسه، منبع، درخواست و وضعیت لید ثبت می‌شود" },
  { label: "پیگیری", description: "وضعیت‌های مشخص: جدید، تماس‌گرفته‌شده، واجدشرایط، برنده/ازدست‌رفته" },
  { label: "یادگیری", description: "بازدید، تبدیل، کیفیت لید و گلوگاه‌ها بررسی می‌شوند" },
] as const;

/**
 * How the system works — the three steps the homepage explains
 * (2026-10 focus pass). The full six-stage model stays on /services
 * and the five-stage delivery process on /process; repeating them on
 * the homepage was the copy bloat this pass removed.
 */
export const HOW_IT_WORKS = [
  {
    title: "بررسی",
    text: "پنج سؤال کوتاه و یک گفت‌وگوی کم‌حرف: مشتری الان از کجا می‌آید و درخواست کجا گم می‌شود.",
  },
  {
    title: "ساخت",
    text: "صفحه، پیام، فرم و تماس یک مسیر می‌سازند؛ هر بازدید می‌داند قدم بعدی چیست.",
  },
  {
    title: "سنجش و بهبود",
    text: "هر درخواست با منبع و وضعیت ثبت می‌شود؛ تغییر بعدی بر اساس داده انتخاب می‌شود، نه حدس.",
  },
] as const;

/** Five-stage delivery process (Spec §24) — cycle, rendered as a    */
/** numbered editorial sequence.                                        */
export const PROCESS_STAGES = [
  { label: "بررسی", description: "کسب‌وکار، مشتری، پیشنهاد، مسیر فعلی جذب، گلوگاه‌ها و محدودیت‌ها" },
  { label: "طراحی", description: "مسیر مشتری، ساختار پیام، اعتماد، CTA، ثبت لید و برنامه اندازه‌گیری" },
  { label: "اجرا", description: "فقط آنچه لازم است ساخته می‌شود؛ بدون پیچیدگی غیرضروری" },
  { label: "اندازه‌گیری", description: "اقدام‌های مهم ثبت و قابل مقایسه می‌شوند" },
  { label: "بهبود", description: "تغییرها بر اساس شواهد اولویت‌بندی می‌شوند" },
] as const;

/* ------------------------------------------------------------------ */
/* Offers — three core offers only (Spec §14–17)                       */
/* ------------------------------------------------------------------ */

export interface Offer {
  id: string;
  name: string;
  /** Public starting price in تومان (docs/DESIGN.md §0). Never USD/FX. */
  price: string;
  /** One line: what this starting price actually covers. */
  priceNote: string;
  summary: string;
  points: readonly string[];
  framing: string;
  /** Quiet typographic recommendation label — no scarcity, no dark pattern. */
  recommended?: boolean;
}

/**
 * Three core offers (2026-10 focus pass). Scopes stay inside what the
 * business can actually deliver today: no CRM product, no invented
 * dashboards, no guaranteed results. The middle tier is the default
 * recommendation for service businesses.
 */
export const OFFERS: readonly Offer[] = [
  {
    id: "landing",
    name: "صفحه جذب",
    price: "از ۲۴.۹ میلیون تومان",
    priceNote: "متن و ساختار صفحه، فرم ثبت درخواست، اندازه‌گیری پایه.",
    summary: "یک صفحه برای یک خدمت مشخص؛ کاری نمی‌کند جز اینکه بازدید را به درخواست تبدیل کند.",
    points: [
      "متن و ساختار صفحه برای یک خدمت مشخص",
      "فرم ثبت درخواست و مسیر تماس",
      "ثبت رویدادهای اصلی در تحلیل",
    ],
    framing: "مناسب کسب‌وکاری که یک خدمت روشن دارد و یک مسیر تبدیل لازم دارد.",
  },
  {
    id: "system",
    name: "سیستم جذب",
    price: "از ۴۴.۹ میلیون تومان",
    priceNote: "صفحه‌های اصلی، فرم و تماس، اندازه‌گیری، ثبت لید با منبع مشخص و پیگیری وضعیت درخواست‌ها.",
    summary: "مسیر کامل از بازدید تا درخواست قابل پیگیری: صفحه‌ها، فرم، تماس، ثبت و پیگیری.",
    points: [
      "صفحه‌های اصلی کسب‌وکار و تجربهٔ لندینگ",
      "CTA، فرم ثبت درخواست و مسیر تماس",
      "اندازه‌گیری و ثبت منبع هر لید",
      "پیگیری وضعیت درخواست‌ها و گزارش دوره‌ای",
    ],
    framing: "پیشنهاد نوونو برای بیشتر کسب‌وکارهای خدماتی.",
    recommended: true,
  },
  {
    id: "growth",
    name: "سیستم رشد",
    price: "از ۶۴.۹ میلیون تومان",
    priceNote: "مسیرهای جذب بیشتر، صفحات تکمیلی، گزارش دوره‌ای و کار مستمر روی تبدیل.",
    summary: "برای کسب‌وکاری که ورودی دارد و مسئله‌اش تبدیل و پیگیری است، نه جذب.",
    points: [
      "تکمیل مسیر جذب و صفحات بیشتر",
      "گزارش دوره‌ای عملکرد مسیر",
      "اندازه‌گیری دقیق‌تر نقاط تماس و تبدیل",
      "بهبود مستمر بر اساس داده",
    ],
    framing: "برای کسب‌وکارهایی که ورودی قابل‌توجه دارند و دنبال رشد مرحله‌ای‌اند.",
  },
];

/** Public pricing policy — one sentence, shown wherever a price appears. */
export const PRICING_NOTE =
  "قیمت‌های فوق نقطه شروع هستند و بر اساس دامنه و پیچیدگی پروژه تعیین می‌شوند. پیشنهاد رسمی هر پروژه ۷ روز اعتبار دارد.";

/** Recurring support — productized monthly options, differentiated by work. */
export const RECURRING_PLANS = [
  {
    id: "care",
    name: "Care",
    price: "از ۴.۹ میلیون تومان / ماه",
    scope: "نگهداری سایت، به‌روزرسانی امنیتی، پشتیبان‌گیری و اصلاحات کوچک.",
  },
  {
    id: "growth",
    name: "Growth",
    price: "از ۹.۹ میلیون تومان / ماه",
    scope: "همه موارد Care، به‌علاوهٔ گزارش ماهانه و تغییرات محدود در صفحه‌ها.",
  },
  {
    id: "active-growth",
    name: "Active Growth",
    price: "از ۱۶.۹ میلیون تومان / ماه",
    scope: "همه موارد Growth، به‌علاوهٔ جلسهٔ ماهانهٔ بهبود تبدیل و اولویت‌بندی کارها بر اساس داده.",
  },
] as const;

/**
 * E-commerce stays a secondary, custom-scoped project line — it is not a
 * flagship offer (docs/DESIGN.md §0). No fabricated store results.
 */
export const ECOMMERCE_OFFER = {
  name: "پروژه‌های فروشگاهی",
  price: "از ۵۹.۹ میلیون تومان، پس از بررسی",
  note: "فروشگاه اینترنتی پروژه‌ای جداگانه است و جزو بسته‌های اصلی نیست؛ دامنه‌اش بعد از بررسی مسیر خرید مشخص می‌شود.",
} as const;

/**
 * Priority segments (2026-10). These describe the *problem each segment
 * brings*, not a specialization claim, a client list, or a result: no
 * niche is presented as proven traction (docs/DESIGN.md §0).
 */
export const PRIORITY_SEGMENTS = [
  {
    id: "clinic",
    name: "کلینیک‌ها و مراکز درمانی",
    problem: "نوبت‌دهی بین تلفن و پیام‌رسان پخش است و معلوم نیست کدام مسیر مراجعه می‌سازد.",
    approach: "یک مسیر رزرو روشن، با ثبت منبع هر تماس و پیگیری وضعیت.",
  },
  {
    id: "education",
    name: "آموزشگاه‌ها و مراکز آموزشی",
    problem: "ثبت‌نام بین دایرکت و تماس گم می‌شود و ظرفیت دوره‌ها دیده نمی‌شود.",
    approach: "صفحهٔ دوره با ثبت‌نام مشخص و پیگیری هر متقاضی تا تصمیم.",
  },
  {
    id: "services-b2b",
    name: "کسب‌وکارهای خدماتی و B2B",
    problem: "سرنخ‌ها در چند کانال پخش‌اند و هیچ‌کس نمی‌داند کدام کانال مشتری می‌آورد.",
    approach: "فرم و تماس در یک نقطهٔ ثبت، با منبع و وضعیت مشخص برای هر سرنخ.",
  },
] as const;

/** Founder — verified identity only; no invented experience or counts. */
export const FOUNDER = {
  name: "دانیال رشیدی",
  role: "بنیان‌گذار نوونو",
  bio: "نوونو را تک‌نفره اداره می‌کند و روی همین مسیر کار می‌کند: تبدیل توجه پراکندهٔ کسب‌وکارهای خدماتی به درخواست‌هایی که ثبت و پیگیری می‌شوند.",
} as const;

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

/**
 * Homepage FAQ — the five objections a qualified lead actually has.
 * Short answers, no repeated explanations, no promises.
 */
export const HOME_FAQ = [
  {
    q: "قیمت‌ها دقیق است؟",
    a: PRICING_NOTE,
  },
  {
    q: "پروژه چقدر طول می‌کشد؟",
    a: "به دامنه بستگی دارد: صفحه جذب معمولاً کوتاه‌تر است و سیستم جذب به تعداد صفحه‌ها و مسیر تماس. عدد دقیق بعد از بررسی گفته می‌شود، نه قبل از آن.",
  },
  {
    q: "فروش را تضمین می‌کنید؟",
    a: "نه. هیچ‌کس نمی‌تواند فروش را تضمین کند و ما هم چنین وعده‌ای نمی‌دهیم. کار ما درست‌کردن مسیر جذب است؛ نتیجه هرجا داده اجازه بدهد گزارش می‌شود.",
  },
  {
    q: "قبلاً سایت یا پیج داریم، چه می‌شود؟",
    a: "بررسی روی وضعیت فعلی انجام می‌شود. سایت موجود می‌تواند نقطهٔ شروع باشد؛ بدون دلیل دور ریخته نمی‌شود.",
  },
  {
    q: "بعد از تحویل چه اتفاقی می‌افتد؟",
    a: "سه گزینهٔ همراهی ماهانه با دامنه و قیمت مشخص داریم: Care، Growth و Active Growth. یا پروژه همان‌جا تمام می‌شود و سایت دست خودتان است.",
  },
] as const;

/** Full FAQ — the long-form set kept for the pages that own it. */
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
    a: "بله، اما اختیاری و با دامنه مشخص: سه گزینه همراهی ماهانه داریم — Care برای نگهداری و امنیت، Growth با گزارش ماهانه و تغییرات محدود، و Active Growth با جلسه ماهانه بهبود تبدیل. بدون قرارداد بلندمدت.",
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
    a: "قیمت شروع هر بسته در صفحه قیمت آمده است. عدد نهایی بعد از دیدن وضعیت کسب‌وکار شما تعیین می‌شود و پیشنهاد رسمی هر پروژه ۷ روز اعتبار دارد.",
  },
  {
    q: "بررسی اولیه رایگان است؟",
    a: "بله. همان فرم کوتاهی که در سایت می‌بینید رایگان است و فقط برای فهمیدن وضعیت فعلی لازم است؛ اگر همکاری مناسب نباشد همان‌جا گفته می‌شود.",
  },
  {
    q: "آیا می‌توان همکاری را با بررسی مسیر فعلی شروع کرد؟",
    a: "بله؛ دقیقاً پیشنهاد ما همین است. چند سؤال کوتاه کافی است تا تصویر دقیق‌تری از وضعیت فعلی داشته باشیم.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Proof-type labels (DESIGN §10 — plain typographic tags)             */
/* ------------------------------------------------------------------ */

export const PROOF_LABELS = {
  "case-study": "مطالعه موردی",
  project: "پروژه",
  concept: "نمونه نمایشی",
} as const;

export const CONCEPT_DISCLAIMER = "نمونه نمایشی — سناریوی مفهومی";

/* ------------------------------------------------------------------ */
/* Numerals — Persian digits are the brand default (۰–۹)               */
/* ------------------------------------------------------------------ */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert Latin digits to Persian digits (۰–۹). */
export function toFaDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * Persian (jalali) year at build time — Intl-computed so the Nowruz
 * cutover (21 March) is handled by the CLDR data, not a hand-rolled
 * month approximation (the old `getMonth() + 1 >= 3` was wrong for
 * March 1-20). `-u-nu-latn` keeps the Intl math in Latin digits; the
 * result is converted back to Persian digits because Persian digits
 * are the brand default (see `toFaDigits` — the OLD implementation
 * also returned Persian digits, and `Footer.astro` renders the value
 * directly without conversion).
 */
export function jalaliYear(date = new Date()): string {
  // Iran's calendar cutover (Nowruz) must not depend on the build machine's TZ.
  const latin = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).format(date);
  return toFaDigits(latin);
}
