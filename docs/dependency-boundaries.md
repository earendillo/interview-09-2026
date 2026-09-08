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

| Tag                 | Projects                                               |
| ------------------- | ------------------------------------------------------ |
| `type:app`          | `apps/shell`, `apps/web`, `apps/dashboard`, `apps/api` |
| `type:shared-lib`   | `libraries/ui`, `libraries/auth`, `libraries/shared`   |
| `type:internal-lib` | `libraries/internal-tools`                             |

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

## Reproducing the invalid dependency

The repository itself stays green — no invalid import is committed to any
project's source tree. The violation is kept as a fixture in
`tools/boundary-check/fixture.invalid-import.ts` and demonstrated on demand:

```bash
pnpm verify:boundaries
```

The script copies the fixture into `apps/web/src/app/invalid-import.ts`, runs
`npx nx lint @interview/web --skip-nx-cache`, removes the fixture again, and
exits non-zero if the lint run did _not_ reject the import.

The lint runs with `NX_DAEMON=false`. The boundary rule resolves a file's source
project through the Nx project graph's file map, and the daemon's cached map
does not always contain a file created moments earlier — the rule then skips the
file and lint passes. Disabling the daemon forces the graph to be recomputed
from disk, which makes the demonstration deterministic. If you run the raw
`nx lint` command by hand, it may occasionally pass for that reason.

Expected output:

```
apps/web/src/app/invalid-import.ts
  9:1  error  A project tagged with "type:app" can only depend on libs tagged
              with "type:shared-lib"  @nx/enforce-module-boundaries

✖ 1 problem (1 error, 0 warnings)

OK: apps/web -> @interview/internal-tools was rejected by @nx/enforce-module-boundaries.
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
