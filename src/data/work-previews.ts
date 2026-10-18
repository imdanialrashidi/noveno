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
  if (id === "mobile-khorsandi") {
    return {
      type: "image",
      src: imageUrl("work/mobile-khorsandi-hero.webp"),
      srcset: webpSrcset("mobile-khorsandi-hero"),
      alt: "اسکرین‌شات صفحه‌ی اصلی فروشگاه موبایل خورسندی — هدر آبی، بنر فروشگاه و دسته‌بندی لوازم جانبی",
    };
  }

  if (id === "elsa-hamrah") {
    return {
      type: "image",
      src: imageUrl("work/elsa-hamrah-hero.webp"),
      srcset: webpSrcset("elsa-hamrah-hero"),
      alt: "اسکرین‌شات صفحه‌ی اصلی فروشگاه السا همراه — بنر ساعت هوشمند و پیشنهاد لحظه‌ای",
    };
  }

  if (id === "php-ielts-house") {
    return {
      type: "image",
      src: imageUrl("work/php-ielts-house-hero.webp"),
      srcset: webpSrcset("php-ielts-house-hero"),
      alt: "اسکرین‌شات صفحه‌ی اصلی خانه‌ی آیلتس PHP — معرفی دوره‌ها",
    };
  }

  if (id === "isbatab") {
    return {
      type: "image",
      src: imageUrl("work/isbatab-hero.webp"),
      srcset: webpSrcset("isbatab-hero"),
      alt: "اسکرین‌شات صفحه‌ی اصلی ایمن صنعت باتاب — معرفی خدمات HSE",
    };
  }

  if (id === "study") {
    return {
      type: "image",
      src: imageUrl("work/study-hero.webp"),
      srcset: webpSrcset("study-hero"),
      alt: "اسکرین‌شات صفحه‌ی اصلی مرکز مطالعه‌ی دانیال رشیدی — وب‌سایت‌هایی که درس‌های سخت را ساده می‌کنند",
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
