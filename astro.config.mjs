import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://noveno.ir',
  integrations: [tailwind()],
  output: 'static',
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
