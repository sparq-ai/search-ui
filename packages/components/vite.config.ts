import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type PluginOption } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')) as {
  version: string;
};

/**
 * Two builds (ARCHITECTURE §14):
 *   vite build              → dist/sparq.esm.js + dist/sparq.esm.auto.js (ES, side-effect split)
 *   vite build --mode iife  → dist/sparq.js (self-contained IIFE, Vue inlined, auto-registers)
 */
export default defineConfig(({ mode }) => {
  const iife = mode === 'iife';
  return {
    plugins: [
      vue(), // .ce.vue suffix → SFC styles compile into shadow roots, not document.head
      // SPARQ_ANALYZE=1 pnpm build → dist/stats.html + raw JSON for size work
      ...(process.env.SPARQ_ANALYZE === '1'
        ? [
            visualizer({ filename: 'dist/stats.html', gzipSize: true }) as PluginOption,
            visualizer({ filename: 'dist/stats.json', template: 'raw-data' }) as PluginOption,
          ]
        : []),
    ],
    define: {
      __SPARQ_VERSION__: JSON.stringify(pkg.version),
      'process.env.NODE_ENV': JSON.stringify('production'),
      __VUE_OPTIONS_API__: 'false',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
    resolve: {
      // One @vue/reactivity instance or widget reactivity silently dies (§18).
      dedupe: ['vue', '@vue/reactivity'],
    },
    build: {
      target: 'es2019',
      outDir: 'dist',
      emptyOutDir: !iife,
      minify: 'esbuild',
      sourcemap: process.env.SPARQ_SOURCEMAP === '1',
      lib: iife
        ? {
            entry: 'src/cdn.ts',
            name: 'SparqSearchUI',
            formats: ['iife'],
            fileName: () => 'sparq.js',
          }
        : {
            entry: { 'sparq.esm': 'src/index.ts', 'sparq.esm.auto': 'src/auto.ts' },
            formats: ['es'],
          },
      rollupOptions: iife
        ? {
            // Aggressive shake for the self-contained browser bundle; the ESM
            // build keeps default settings + pure annotations so downstream
            // bundlers can shake it themselves.
            treeshake: 'smallest',
          }
        : {
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: 'chunks/[name]-[hash].js',
            },
          },
    },
  };
});
