# interview-09-2026

A minimal Nx monorepo used as a domain-neutral technical playground: several
React applications, a trivial HTTP API, shared libraries, and mechanically
enforced dependency boundaries.

This is the monorepo foundation only. Module Federation, authentication,
CI/CD, and other topics are intentionally not implemented yet.

## Repository structure

```
apps/
  shell/            React application, future Module Federation host (port 4202)
  web/              React application (port 4200)
  dashboard/        React application (port 4201)
  api/              Minimal HTTP service, in-memory data (port 3333)

libraries/
  ui/               Shared UI components          (type:shared-lib)
  auth/             Shared auth utilities         (type:shared-lib)
  shared/           Shared types/utilities        (type:shared-lib)
  internal-tools/   Internal-only utilities       (type:internal-lib)

docs/               Additional documentation
tools/              Workspace scripts and fixtures
```

## Import conventions

Cross-project imports use the `@interview/*` workspace aliases:

```ts
import { Button } from '@interview/ui';
import type { Item } from '@interview/shared';
import { getAuthStatus } from '@interview/auth';
```

Deep relative imports across project boundaries (`../../../libraries/ui/src`)
are not allowed; within a project, relative imports are fine.

## Dependency boundaries

```
apps                 →  shared libraries
shared libraries     →  shared libraries
internal libraries   →  shared / internal libraries

apps                 →  internal libraries        NOT ALLOWED
libraries            →  apps                      NOT ALLOWED
```

Enforced by `@nx/enforce-module-boundaries` in the root `eslint.config.mjs`,
using the `nx.tags` declared in each project's `package.json`.

See [docs/dependency-boundaries.md](docs/dependency-boundaries.md) for details,
for how to reproduce the intentionally invalid dependency, and for the
distinction between production experience and this playground.

## Getting started

```bash
pnpm install
```

### Running the applications

```bash
pnpm nx dev @interview/web         # http://localhost:4200
pnpm nx dev @interview/dashboard   # http://localhost:4201
pnpm nx dev @interview/shell       # http://localhost:4202
pnpm nx serve @interview/api       # http://localhost:3333
```

### API

The API keeps an in-memory dataset — no database, no authentication. It exists
so later examples have a real HTTP boundary.

```bash
curl http://localhost:3333/api/items
# [{"id":1,"name":"Item 1"},{"id":2,"name":"Item 2"},{"id":3,"name":"Item 3"}]

curl http://localhost:3333/api/items/1
# {"id":1,"name":"Item 1"}

curl -i http://localhost:3333/api/items/999
# HTTP/1.1 404 Not Found
```

The `Item` type is defined once in `@interview/shared` and used by both the API
and the web application.

### Lint, typecheck, test, build

```bash
pnpm nx run-many -t lint
pnpm nx run-many -t typecheck
pnpm nx run-many -t test
pnpm nx run-many -t build
pnpm verify:boundaries   # expects the invalid app -> internal-lib import to fail
```

## Tech stack

- [Nx](https://nx.dev) — monorepo build system
- [React](https://react.dev) — UI framework
- [TypeScript](https://typescriptlang.org) — type safety
- [pnpm](https://pnpm.io) — package manager (workspaces)
- [ESLint](https://eslint.org) — linting and dependency enforcement
- [Vite](https://vite.dev) / [Vitest](https://vitest.dev) — dev server, bundler, tests
- [esbuild](https://esbuild.github.io) — API bundling
