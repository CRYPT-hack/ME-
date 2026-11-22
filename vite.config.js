import { defineConfig } from 'vite';

// `base: './'` keeps every asset path relative, so the built site works from
// any folder (GitHub Pages, Netlify, `npx serve dist`).
export default defineConfig({
  base: './',
  server: { port: 5180, open: false },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
