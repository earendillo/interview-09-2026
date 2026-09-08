import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:4200';

/**
 * One browser, one journey. E2E is the slowest and most brittle level, so it
 * is deliberately the thinnest: everything that can be asserted in jsdom is
 * asserted there (see docs/testing-and-accessibility.md).
 *
 * Both servers are started by Playwright rather than by Nx, and
 * `reuseExistingServer` attaches to an already-running `nx dev` / `nx serve`
 * instead of failing on the busy port - which is the normal state of a
 * developer's machine. That is also why this project keeps the explicit
 * `@nx/playwright:playwright` executor rather than the inferred plugin: the
 * plugin promotes both servers to Nx continuous tasks that it starts itself,
 * and those collide with dev servers that are already up.
 */
export default defineConfig({
  testDir: './src',
  outputDir: './test-output/results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: './test-output/report', open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm nx run @interview/api:serve',
      url: 'http://localhost:3333/api/items',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm nx run @interview/web:dev',
      url: WEB_URL,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
