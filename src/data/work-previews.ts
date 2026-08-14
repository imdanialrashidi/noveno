/**
 * Work preview metadata (2026-08-14 founder redesign).
 * Real projects use screenshots of the public delivered sites; concepts use
 * the designed mock component. No stock imagery or invented results.
 */

export interface WorkPreview {
  type: "image" | "concept";
  src?: string;
  srcset?: string;
  alt?: string;
  detailSrc?: string;
  detailSrcset?: string;
  detailAlt?: string;
  layout?: "form" | "course";
  scenario?: string;
}

export function previewFor(id: string): WorkPreview {
  if (id === "noveno-website") {
    return {
      type: "image",
      src: "/images/work/noveno-website-hero.webp",
      srcset:
        "/images/work/noveno-website-hero.webp 1440w, /images/work/noveno-website-hero-800.webp 720w",
      alt: "صفحهٔ نخست وب‌سایت نوونو — مسیر جذب با درخواست بررسی",
      detailSrc: "/images/work/noveno-website-audit.webp",
      detailSrcset:
        "/images/work/noveno-website-audit.webp 1440w, /images/work/noveno-website-audit-800.webp 720w",
      detailAlt: "فرم بررسی مسیر جذب در وب‌سایت نوونو — شش مرحلهٔ کوتاه",
    };
  }

  if (id === "mobile-khorsandi") {
    return {
      type: "image",
      src: "/images/work/mobile-khorsandi-hero.webp",
      srcset:
        "/images/work/mobile-khorsandi-hero.webp 1440w, /images/work/mobile-khorsandi-hero-800.webp 720w",
      alt: "صفحهٔ اصلی فروشگاه آنلاین موبایل خرسندی",
    };
  }

  if (id === "elsa-hamrah") {
    return {
      type: "image",
      src: "/images/work/elsa-hamrah-hero.webp",
      srcset:
        "/images/work/elsa-hamrah-hero.webp 1440w, /images/work/elsa-hamrah-hero-800.webp 720w",
      alt: "صفحهٔ اصلی فروشگاه آنلاین السا همراه",
    };
  }

  if (id === "php-ielts-house") {
    return {
      type: "image",
      src: "/images/work/php-ielts-house-hero.webp",
      srcset:
        "/images/work/php-ielts-house-hero.webp 1440w, /images/work/php-ielts-house-hero-800.webp 720w",
      alt: "صفحهٔ اصلی سایت آموزشی خانهٔ آیلتس PHP",
    };
  }

  if (id === "isbatab") {
    return {
      type: "image",
      src: "/images/work/isbatab-hero.webp",
      srcset:
        "/images/work/isbatab-hero.webp 1440w, /images/work/isbatab-hero-800.webp 720w",
      alt: "صفحهٔ اصلی وب‌سایت شرکتی ایمن صنعت باتاب",
    };
  }

  if (id === "danial-rashidi-portfolio") {
    return {
      type: "image",
      src: "/images/work/danial-rashidi-portfolio-hero.webp",
      srcset:
        "/images/work/danial-rashidi-portfolio-hero.webp 1440w, /images/work/danial-rashidi-portfolio-hero-800.webp 720w",
      alt: "صفحهٔ اصلی پرتفولیوی شخصی دانیال رشیدی",
    };
  }

  const isClinic = id === "clinic-acquisition-concept";
  return {
    type: "concept",
    layout: isClinic ? "form" : "course",
    scenario: isClinic
      ? "شماتیک صفحهٔ فرود کلینیک نمونه: پیام خدمت، دکمهٔ اقدام و فرم ثبت درخواست — سناریوی مفهومی"
      : "شماتیک صفحهٔ دورهٔ آموزشگاه نمونه: معرفی دوره و فرم درخواست ثبت‌نام — سناریوی مفهومی",
  };
}
