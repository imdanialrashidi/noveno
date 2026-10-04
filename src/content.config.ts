import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Work collection (plan §5.2) — truthful proof semantics (Spec §18–19,
 * DESIGN §4.3). The type union IS the honesty contract:
 *  case-study → real client + verified evidence; metrics require
 *    `verified: true` + `source` (schema-enforced).
 *  project    → real implementation, no outcome claims; outcome is
 *    explicitly «در دست اندازهگیری» or «نامشخص».
 *  concept    → fictional/demo scenario; goals phrased as design goals
 *    and proposed KPIs, never results.
 */

const metric = z.object({
  name: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  period: z.string().optional(),
  baseline: z.string().optional(),
  source: z.string(),
  /** Truthfulness guard: a metric without verified evidence cannot pass. */
  verified: z.literal(true),
  note: z.string().optional(),
});

const work = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/work" }),
  schema: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("case-study"),
      title: z.string(),
      industry: z.string(),
      summary: z.string(),
      published_at: z.coerce.date(),
      client: z.object({ name: z.string(), public: z.literal(true) }),
      timeline: z.string().optional(),
      scope: z.string().optional(),
      problem: z.string().optional(),
      solution: z.string().optional(),
      components: z.array(z.string()).default([]),
      metrics: z.array(metric).default([]),
      limitations: z.array(z.string()).default([]),
      /** Draft gate — drafts never build, never appear on /work, /, or in the sitemap. */
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
    }),
    z.object({
      type: z.literal("project"),
      title: z.string(),
      industry: z.string(),
      summary: z.string(),
      published_at: z.coerce.date(),
      client: z.object({ name: z.string(), public: z.boolean() }).optional(),
      timeline: z.string().optional(),
      scope: z.string().optional(),
      problem: z.string().optional(),
      solution: z.string().optional(),
      components: z.array(z.string()).default([]),
      metrics: z.array(metric).default([]),
      limitations: z.array(z.string()).default([]),
      /** Honest outcome marker: «در دست اندازهگیری» | «نامشخص». */
      outcome: z.enum(["measuring", "unknown"]).default("measuring"),
      /** Draft gate — drafts never build, never appear on /work, /, or in the sitemap. */
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
    }),
    z.object({
      type: z.literal("concept"),
      title: z.string(),
      industry: z.string(),
      summary: z.string(),
      published_at: z.coerce.date(),
      client: z.object({ name: z.string(), public: z.literal(false) }).optional(),
      timeline: z.string().optional(),
      scope: z.string().optional(),
      problem: z.string().optional(),
      solution: z.string().optional(),
      components: z.array(z.string()).default([]),
      /** Design goals — «هدف طراحی», never results. */
      goals: z.array(z.string()).default([]),
      /** Proposed KPIs — «KPI پیشنهادی», never measured results. */
      kpis: z.array(z.string()).default([]),
      limitations: z.array(z.string()).default([]),
      /** Draft gate — drafts never build, never appear on /work, /, or in the sitemap. */
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
    }),
  ]),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z
    .object({
      /** Article title — unique per article, used in <title>/og:title/H1. */
      title: z.string().min(3).max(120),
      /** Meta description — unique per article (SEO surface). */
      description: z.string().min(20).max(180),
      /** Publication date — drives ordering, sitemap lastmod, schema. */
      published_at: z.coerce.date(),
      /** Optional revision date — only when the article was materially updated. */
      updated_at: z.coerce.date().optional(),
      /** Truthful author — default is the publisher «نوونو». */
      author: z.string().min(2).max(60).default("نوونو"),
      /** Draft gate — drafts never build, never appear in index/sitemap. */
      draft: z.boolean().default(false),
      /** Topic/category — the only taxonomy; powers related articles. */
      category: z.string().min(2).max(40),
      /** Optional tags — no tag pages are generated (thin taxonomy rule). */
      tags: z.array(z.string().min(2).max(30)).default([]),
      /** Optional social-card override (path under public/, e.g. /og/blog/x.png). */
      ogImage: z.string().optional(),
      /** Optional canonical override — only when genuinely required. */
      canonical: z.url().optional(),
      /**
       * Optional cover: a REAL product surface (docs/DESIGN.md §3.2/§4 —
       * the only substantial image primitive on a Noveno page). Value is a
       * logical path in `src/generated/image-manifest.ts`, WITH extension
       * (e.g. "work/noveno-website-audit.webp"), never a hand-written
       * `/images/...` path; the build hashes it and pairs it with its 720w
       * partner.
       */
      heroImage: z.string().min(1).optional(),
      /**
       * Descriptive Persian alt text for `heroImage`. Required whenever a
       * cover is set: a cover without alt is a publishing error, not a
       * styling choice.
       */
      heroImageAlt: z.string().min(10).optional(),
      /** Optional caption under the cover — adds context the alt cannot. */
      heroImageCaption: z.string().min(10).optional(),
    })
    .refine((entry) => !entry.heroImage || Boolean(entry.heroImageAlt), {
      message: "heroImage requires heroImageAlt (descriptive Persian alt text)",
      path: ["heroImageAlt"],
    }),
});

export const collections = { work, blog };
