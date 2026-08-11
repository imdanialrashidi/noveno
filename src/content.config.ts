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
      featured: z.boolean().default(false),
    }),
  ]),
});

export const collections = { work };
