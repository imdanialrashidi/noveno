// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static-first: no adapter, no SSR. Output is plain HTML + assets for
// Cloudflare Pages. See docs/ARCHITECTURE.md invariants.
export default defineConfig({
  site: "https://noveno.ir",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
