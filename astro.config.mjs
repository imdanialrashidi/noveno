// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { FALLBACK_SITE_ORIGIN } from "./scripts/lib/site-origin.mjs";

// Static-first: no adapter, no SSR. Output is plain HTML + assets for
// Cloudflare Pages. See docs/ARCHITECTURE.md invariants.
// PUBLIC_APP_URL (documented in .env.example) overrides the canonical
// origin; Pages injects build-time env vars into the build process.
export default defineConfig({
  site: process.env.PUBLIC_APP_URL ?? FALLBACK_SITE_ORIGIN,
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
