/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

// Remote locations. Defaults match the remotes' own dev servers; override with
// environment variables when serving them from somewhere else.
const WEB_REMOTE_URL = process.env.WEB_REMOTE_URL ?? 'http://localhost:4200';
const DASHBOARD_REMOTE_URL =
  process.env.DASHBOARD_REMOTE_URL ?? 'http://localhost:4201';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/shell',
  server: {
    port: 4202,
    host: 'localhost',
  },
  plugins: [
    react(),
    federation({
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: {
        web: {
          type: 'module',
          name: 'web',
          entry: `${WEB_REMOTE_URL}/remoteEntry.js`,
          entryGlobalName: 'web',
          shareScope: 'default',
        },
        dashboard: {
          type: 'module',
          name: 'dashboard',
          entry: `${DASHBOARD_REMOTE_URL}/remoteEntry.js`,
          entryGlobalName: 'dashboard',
          shareScope: 'default',
        },
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
    name: '@interview/shell',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
  },
}));
