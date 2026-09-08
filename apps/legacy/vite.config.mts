/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/legacy',
  server: {
    port: 4203,
    host: 'localhost',
    origin: 'http://localhost:4203',
  },
  resolve: {
    dedupe: [],
  },
  plugins: [
    react(),
    federation({
      name: 'legacy',
      filename: 'remoteEntry.js',
      exposes: {
        './LegacyWidget': './src/remote/legacy-widget-mount.tsx',
      },
      shared: {},
      shareScope: 'legacy',
      dts: false,
    }),
  ],
  build: {
    target: 'esnext',
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@interview/legacy',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
  },
}));
