/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  server: {
    port: 4200,
    host: 'localhost',
    // Absolute URLs for assets referenced from the remote entry, so the shell
    // resolves them against this dev server rather than its own origin.
    origin: 'http://localhost:4200',
  },
  plugins: [
    react(),
    federation({
      name: 'web',
      filename: 'remoteEntry.js',
      exposes: {
        './WebWidget': './src/remote/web-widget.tsx',
      },
      shared: ['react', 'react-dom'],
      // Remote types are hand-declared in the shell (src/remotes.d.ts), so the
      // plugin's type generation/consumption is not needed and its tsc pass
      // would otherwise fail against this workspace's composite tsconfigs.
      dts: false,
    }),
  ],
  build: {
    // The federation runtime relies on top-level await.
    target: 'esnext',
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@interview/web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
  },
}));
