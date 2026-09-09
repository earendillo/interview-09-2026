# Dependency boundaries

## Intended dependency model

```
apps                 →  shared libraries
shared libraries     →  shared libraries
internal libraries   →  shared / internal libraries
```

Applications must **not** import internal libraries such as `@interview/internal-tools`.

## How it is enforced

Each project is tagged in its `package.json` under `nx.tags`:

| Tag                 | Projects                                                                              |
| ------------------- | ------------------------------------------------------------------------------------- |
| `type:app`          | `apps/shell`, `apps/web`, `apps/dashboard`, `apps/legacy`, `apps/api`, `apps/web-e2e` |
| `type:shared-lib`   | `libraries/ui`, `libraries/auth`, `libraries/shared`                                  |
| `type:internal-lib` | `libraries/internal-tools`                                                            |

The constraints themselves live in the root `eslint.config.mjs`, in the
`@nx/enforce-module-boundaries` rule:

```js
depConstraints: [
  { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:shared-lib'] },
  { sourceTag: 'type:shared-lib', onlyDependOnLibsWithTags: ['type:shared-lib'] },
  {
    sourceTag: 'type:internal-lib',
    onlyDependOnLibsWithTags: ['type:shared-lib', 'type:internal-lib'],
  },
];
```

## The rule Nx tags cannot express

`@nx/enforce-module-boundaries` decides which **projects** may depend on each
other. It says nothing about which **entry point** of a project you reached
for, and that distinction is load-bearing here.

`@interview/auth` has two entry points. `@interview/auth/server` reaches
`node:crypto`, so it cannot run in a browser — but `apps/web → libraries/auth`
is a perfectly legal `type:app → type:shared-lib` edge whichever subpath the
import names. Lint passed, `tsc` passed, and `vite build` exited 0 with a
_warning_ (`Module "node:crypto" has been externalized for browser
compatibility`) before rendering a blank page. Only the browser failed.

So the second rule is a plain `no-restricted-imports`, exported from the root
`eslint.config.mjs` as `browserAppBoundaries` and spread into the four browser
applications — not into `apps/api`, which imports the server entry on purpose:

```js
'no-restricted-imports': ['error', {
  paths: [{
    name: '@interview/auth/server',
    message: 'Server-only: it needs node:crypto and will not run in a browser. …',
  }],
}],
```

It complements `libraries/auth/src/browser-entry.spec.ts`, which bundles the
library's own public entry for the browser and fails if a Node builtin creeps
back into it. That spec guards the library; this rule guards its consumers.
Neither one catches the other's case.

## Reproducing the invalid dependencies

The repository itself stays green — no invalid import is committed to any
project's source tree. Both violations are kept as fixtures in
`tools/boundary-check/` and demonstrated on demand:

```bash
pnpm verify:boundaries
```

For each case the script copies the fixture into `apps/web/src/app/`, runs
`npx nx lint @interview/web --skip-nx-cache`, removes the fixture again, and
exits non-zero if the lint run did _not_ reject the import with the expected
rule:

| Fixture                            | Invalid import              | Rejected by                     |
| ---------------------------------- | --------------------------- | ------------------------------- |
| `fixture.invalid-import.ts`        | `@interview/internal-tools` | `@nx/enforce-module-boundaries` |
| `fixture.invalid-server-import.ts` | `@interview/auth/server`    | `no-restricted-imports`         |

The lint runs with `NX_DAEMON=false`. The boundary rule resolves a file's source
project through the Nx project graph's file map, and the daemon's cached map
does not always contain a file created moments earlier — the rule then skips the
file and lint passes. Disabling the daemon forces the graph to be recomputed
from disk, which makes the demonstration deterministic. If you run the raw
`nx lint` command by hand, it may occasionally pass for that reason.

Expected output (abridged — the full run prints each lint invocation):

```
=== apps/web -> @interview/internal-tools
    an application may only depend on `type:shared-lib` projects

apps/web/src/app/invalid-import.ts
  9:1  error  A project tagged with "type:app" can only depend on libs tagged
              with "type:shared-lib"  @nx/enforce-module-boundaries

✖ 1 problem (1 error, 0 warnings)

OK: apps/web -> @interview/internal-tools was rejected by `@nx/enforce-module-boundaries`.

=== apps/web -> @interview/auth/server
    the server-only entry point reaches node:crypto and cannot run in a browser

apps/web/src/app/invalid-server-import.ts
  13:1  error  '@interview/auth/server' import is restricted from being used.
               Server-only: it needs node:crypto and will not run in a browser.
               Applications use @interview/auth  no-restricted-imports

✖ 1 problem (1 error, 0 warnings)

OK: apps/web -> @interview/auth/server was rejected by `no-restricted-imports`.
```

## Production experience vs. this playground

This distinction matters when discussing the repository:

**Production experience being represented**

- Nx monorepo usage
- TypeScript path aliases
- ESLint
- shared libraries
- application/library separation
- working in a large existing monorepo

**Specific to this playground**

The explicit `depConstraints` configuration above is a demonstration added for
this repository, to show how architectural boundaries can be enforced
mechanically. It is not a copy of a configuration used in the original
production project.
