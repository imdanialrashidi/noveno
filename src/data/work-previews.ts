/**
 * Work preview metadata (2026-08-14 founder redesign).
 * Real projects use screenshots of the public delivered sites; concepts use
 * the designed mock component. No stock imagery or invented results.
 *
 * All image URLs resolve through the content-hashed image manifest
 * (src/generated/image-manifest.ts) so /images/* `immutable` caching
 * stays correct when previews are regenerated.
 */

import { imageUrl } from "../generated/image-manifest";

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

/** 1440w/720w WebP srcset for a preview pair (`name` + `name-800`). */
function webpSrcset(name: string): string {
  return `${imageUrl(`work/${name}.webp`)} 1440w, ${imageUrl(`work/${name}-800.webp`)} 720w`;
}

export function previewFor(id: string): WorkPreview {
  if (id === "noveno-website") {
    return {
      type: "image",
      src: imageUrl("work/noveno-website-hero.webp"),
      srcset: webpSrcset("noveno-website-hero"),
      alt: "صفحهٔ نخست وب‌سایت نوونو — مسیر جذب با درخواست بررسی",
      detailSrc: imageUrl("work/noveno-website-audit.webp"),
      detailSrcset: webpSrcset("noveno-website-audit"),
      detailAlt: "فرم بررسی مسیر جذب در وب‌سایت نوونو — شش مرحلهٔ کوتاه",
    };
  }

  if (id === "mobile-khorsandi") {
    return {
      type: "image",
      src: imageUrl("work/mobile-khorsandi-hero.webp"),
      srcset: webpSrcset("mobile-khorsandi-hero"),
      alt: "صفحهٔ اصلی فروشگاه آنلاین موبایل خرسندی",
    };
  }

  if (id === "elsa-hamrah") {
    return {
      type: "image",
      src: imageUrl("work/elsa-hamrah-hero.webp"),
      srcset: webpSrcset("elsa-hamrah-hero"),
      alt: "صفحهٔ اصلی فروشگاه آنلاین السا همراه",
    };
  }

  if (id === "php-ielts-house") {
    return {
      type: "image",
      src: imageUrl("work/php-ielts-house-hero.webp"),
      srcset: webpSrcset("php-ielts-house-hero"),
      alt: "صفحهٔ اصلی سایت آموزشی خانهٔ آیلتس PHP",
    };
  }

  if (id === "isbatab") {
    return {
      type: "image",
      src: imageUrl("work/isbatab-hero.webp"),
      srcset: webpSrcset("isbatab-hero"),
      alt: "صفحهٔ اصلی وب‌سایت شرکتی ایمن صنعت باتاب",
    };
  }

  if (id === "danial-rashidi-portfolio") {
    return {
      type: "image",
      src: imageUrl("work/danial-rashidi-portfolio-hero.webp"),
      srcset: webpSrcset("danial-rashidi-portfolio-hero"),
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
