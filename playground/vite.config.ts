import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/** Dev harness + living docs: plain .html pages against the mock client. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  resolve: {
    dedupe: ['vue', '@vue/reactivity'],
    alias: {
      '@sparq/search-ui/auto': fileURLToPath(new URL('../packages/components/src/auto.ts', import.meta.url)),
      '@sparq/search-ui': fileURLToPath(new URL('../packages/components/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: '/index.html',
  },
});
