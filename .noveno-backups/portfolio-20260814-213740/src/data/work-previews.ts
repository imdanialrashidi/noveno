/**
 * Work preview metadata (2026-08-14 founder redesign).
 * Truthful preview policy (DESIGN §9, founder directive):
 *  - real project → real screenshots of the actual delivered product
 *    (captured from this site's own production build, 1440×900 WebP);
 *  - concept → designed page mockup (ConceptPreview), labeled
 *    «نمونه نمایشی — سناریوی مفهومی»;
 *  - no stock imagery for work previews, no invented interfaces, no
 *    fake results. (Site photography is licensed CC0, captioned, and
 *    clearly contextual — see docs/IMAGERY.md.)
 */

export interface WorkPreview {
  type: "image" | "concept";
  /** Image preview (real project screenshots only). */
  src?: string;
  srcset?: string;
  alt?: string;
  /** Secondary real screenshot for the detail page. */
  detailSrc?: string;
  detailSrcset?: string;
  detailAlt?: string;
  /** Concept mock layout: "form" | "course". */
  layout?: "form" | "course";
  /** Concept scenario short description (sr-only). */
  scenario?: string;
}

export function previewFor(id: string): WorkPreview {
  if (id === "noveno-website") {
    return {
      type: "image",
      src: "/images/work/noveno-website-hero.webp",
      srcset:
        "/images/work/noveno-website-hero.webp 1440w, /images/work/noveno-website-hero-800.webp 720w",
      alt: "صفحه نخست وب‌سایت نوونو — مسیر جذب با درخواست بررسی",
      detailSrc: "/images/work/noveno-website-audit.webp",
      detailSrcset:
        "/images/work/noveno-website-audit.webp 1440w, /images/work/noveno-website-audit-800.webp 720w",
      detailAlt: "فرم بررسی مسیر جذب در وب‌سایت نوونو — شش مرحله کوتاه",
    };
  }
  const isClinic = id === "clinic-acquisition-concept";
  return {
    type: "concept",
    layout: isClinic ? "form" : "course",
    scenario: isClinic
      ? "شماتیک صفحه فرود کلینیک نمونه: پیام خدمت، دکمه اقدام و فرم ثبت درخواست — سناریوی مفهومی"
      : "شماتیک صفحه دوره آموزشگاه نمونه: معرفی دوره و فرم درخواست ثبت‌نام — سناریوی مفهومی",
  };
}
