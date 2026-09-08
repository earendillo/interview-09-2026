/**
 * Reproducible demonstration of the Nx/ESLint dependency-boundary rules.
 *
 * Copies an intentionally invalid import (apps -> internal library) into
 * apps/web, lints the project, and asserts that the lint run fails with
 * `@nx/enforce-module-boundaries`. The fixture is always removed again, so the
 * repository itself never contains an invalid import.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, '..', '..');
const fixture = join(here, 'fixture.invalid-import.ts');
const target = join(
  workspaceRoot,
  'apps',
  'web',
  'src',
  'app',
  'invalid-import.ts',
);

copyFileSync(fixture, target);

// NX_DAEMON=false forces the project graph (including the file map the
// boundary rule uses to resolve a file's source project) to be recomputed from
// disk. With the daemon running, the fixture we just wrote is occasionally not
// in its cached file map yet, the rule then skips the file, and lint passes.
const result = spawnSync('npx nx lint @interview/web --skip-nx-cache', {
  cwd: workspaceRoot,
  encoding: 'utf8',
  shell: true,
  env: { ...process.env, NX_DAEMON: 'false' },
});

rmSync(target, { force: true });

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
console.log(output);

if (result.status === 0 || !output.includes('@nx/enforce-module-boundaries')) {
  console.error(
    'FAILED: the invalid apps/web -> @interview/internal-tools import was NOT rejected.',
  );
  process.exit(1);
}

console.log(
  'OK: apps/web -> @interview/internal-tools was rejected by @nx/enforce-module-boundaries.',
);
