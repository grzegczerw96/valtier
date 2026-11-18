import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://grzegczerw96.github.io',
  base: '/valtier',
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  build: { format: 'file', inlineStylesheets: 'always' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  vite: {
    build: { assetsInlineLimit: 4096 },
  },
});
