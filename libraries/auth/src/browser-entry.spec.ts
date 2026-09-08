import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

/**
 * The regression test for a bug that every other check missed.
 *
 * `lib/jwt.ts` imports `node:crypto`. It used to be re-exported from
 * `index.ts`, so `import { getAuthStatus } from '@interview/auth'` in a React
 * application dragged a Node builtin into the browser bundle. Vitest runs in
 * Node and did not care; `tsc` does not care; `vite build` externalised it and
 * succeeded. The failure only appeared in a real browser, as
 *
 *   Module "node:crypto" has been externalized for browser compatibility
 *
 * and a blank page.
 *
 * So the assertion is made where the mistake actually lands: bundle the public
 * entry point for the browser, with nothing external, and let the bundler
 * refuse to resolve any Node builtin that has crept back in.
 */
describe('@interview/auth browser entry', () => {
  it('bundles for the browser with no Node builtins', async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL('index.ts', import.meta.url))],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
      logLevel: 'silent',
    });

    expect(result.errors).toEqual([]);
  });

  it('still refuses the server entry, which is the point of the split', async () => {
    // The mirror image: proving the guard above can fail keeps it honest.
    await expect(
      build({
        entryPoints: [fileURLToPath(new URL('server.ts', import.meta.url))],
        bundle: true,
        write: false,
        platform: 'browser',
        format: 'esm',
        logLevel: 'silent',
      }),
    ).rejects.toThrow(/node:crypto/);
  });
});
