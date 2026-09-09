/**
 * Reproducible demonstration of the workspace's dependency-boundary rules.
 *
 * For each case below: copy an intentionally invalid import into apps/web,
 * lint the project, and assert that the lint run fails with the expected rule.
 * The fixture is always removed again, so the repository itself never contains
 * an invalid import.
 *
 * Two rules, because they catch different classes of mistake and only one of
 * them is expressible with Nx tags:
 *
 *   @nx/enforce-module-boundaries   which PROJECTS may depend on each other
 *   no-restricted-imports           which ENTRY POINT of a project is allowed
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, '..', '..');

const CASES = [
  {
    what: 'apps/web -> @interview/internal-tools',
    why: 'an application may only depend on `type:shared-lib` projects',
    fixture: 'fixture.invalid-import.ts',
    target: 'invalid-import.ts',
    rule: '@nx/enforce-module-boundaries',
  },
  {
    what: 'apps/web -> @interview/auth/server',
    why: 'the server-only entry point reaches node:crypto and cannot run in a browser',
    fixture: 'fixture.invalid-server-import.ts',
    target: 'invalid-server-import.ts',
    rule: 'no-restricted-imports',
  },
];

function lintWithFixture({ fixture, target }) {
  const targetPath = join(workspaceRoot, 'apps', 'web', 'src', 'app', target);
  copyFileSync(join(here, fixture), targetPath);

  // NX_DAEMON=false forces the project graph (including the file map the
  // boundary rule uses to resolve a file's source project) to be recomputed
  // from disk. With the daemon running, the fixture we just wrote is
  // occasionally not in its cached file map yet, the rule then skips the file,
  // and lint passes.
  const result = spawnSync('npx nx lint @interview/web --skip-nx-cache', {
    cwd: workspaceRoot,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, NX_DAEMON: 'false' },
  });

  rmSync(targetPath, { force: true });

  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

let failed = false;

for (const testCase of CASES) {
  console.log(`\n=== ${testCase.what}\n    ${testCase.why}\n`);

  const { status, output } = lintWithFixture(testCase);
  console.log(output);

  if (status === 0 || !output.includes(testCase.rule)) {
    console.error(
      `FAILED: ${testCase.what} was NOT rejected by \`${testCase.rule}\`.`,
    );
    failed = true;
    continue;
  }

  console.log(`OK: ${testCase.what} was rejected by \`${testCase.rule}\`.`);
}

process.exit(failed ? 1 : 0);
