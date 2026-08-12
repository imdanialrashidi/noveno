// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static-first: no adapter, no SSR. Output is plain HTML + assets for
// Cloudflare Pages. See docs/ARCHITECTURE.md invariants.
// PUBLIC_APP_URL (documented in .env.example) overrides the canonical
// origin; Pages injects build-time env vars into the build process.
export default defineConfig({
  site: process.env.PUBLIC_APP_URL ?? "https://noveno.ir",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
