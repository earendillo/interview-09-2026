# interview-09-2026

A minimal Nx monorepo used as a domain-neutral technical playground: several
React applications, a trivial HTTP API, shared libraries, and mechanically
enforced dependency boundaries.

The workspace foundation plus a minimal Module Federation setup. Authentication,
CI/CD, and other topics are intentionally not implemented yet.

## Repository structure

```
apps/
  shell/            React application, Module Federation host (port 4202)
  web/              React application, Module Federation remote (port 4200)
  dashboard/        React application, Module Federation remote (port 4201)
  api/              Minimal HTTP service, in-memory data (port 3333)
  web-e2e/          Playwright end-to-end tests for `web`

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

## Module Federation

`shell` is the host; `web` and `dashboard` are remotes. The host loads the two
components at runtime over HTTP — there is no build-time dependency between the
three applications, and no `@interview/*` import between them.

```
shell (:4202, host)
  ├── web/WebWidget                 ← http://localhost:4200/remoteEntry.js
  └── dashboard/DashboardWidget     ← http://localhost:4201/remoteEntry.js
```

| Application | Role   | Exposes                                                    |
| ----------- | ------ | ---------------------------------------------------------- |
| `shell`     | host   | —                                                          |
| `web`       | remote | `./WebWidget` from `src/remote/web-widget.tsx`             |
| `dashboard` | remote | `./DashboardWidget` from `src/remote/dashboard-widget.tsx` |

Implemented with [`@module-federation/vite`](https://module-federation.io/integrations/build-tool/vite),
configured in each application's `vite.config.mts`. `react` and `react-dom` are
declared as shared singletons, and all three applications use the same React
version.

### How the shell consumes the remotes

`apps/shell/src/app/app.tsx` loads each remote through a dynamic import that the
federation runtime resolves:

```tsx
<RemoteSlot label="Web remote" loader={() => import('web/WebWidget')} />
```

Because these specifiers only exist at runtime, their types are declared by hand
in `apps/shell/src/remotes.d.ts` (the plugin's type generation is disabled).

### When a remote is unavailable

Each remote is wrapped in `RemoteSlot` (`apps/shell/src/app/remote-slot.tsx`),
which pairs `React.lazy`/`Suspense` with a small error boundary. While a remote
loads it shows `Loading <name>...`; if the import fails it shows
`Unable to load <name>` and the rest of the shell — including the other remote —
keeps working. There is no retry logic and no shared state between remotes.

To see it, start all three, then stop one remote and reload the shell.

### Remote URLs

Defaults point at the remotes' dev servers. Override them when building or
serving the shell from elsewhere:

```bash
WEB_REMOTE_URL=http://localhost:4200 \
DASHBOARD_REMOTE_URL=http://localhost:4201 \
pnpm nx build @interview/shell
```

The URLs are read in `apps/shell/vite.config.mts` and baked in at build time.

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

## Styling

SCSS (dart-sass, compiled by Vite - no CSS framework). The layering is:

```
libraries/ui/src/styles/
  _tokens.scss    design tokens as CSS custom properties (+ dark theme)
  _reset.scss     small reset
  _mixins.scss    card / focus-ring / mono, used inside the library
  base.scss       the one global stylesheet: tokens + reset + `ui-*` primitives

<project>/**/*.module.scss   everything component-specific, scoped by CSS Modules
```

Each application imports the global sheet once, in its `main.tsx`:

```ts
import '@interview/ui/styles/base.scss';
```

Two deliberate choices worth knowing:

- **Tokens cross the package boundary as CSS custom properties, not SCSS
  variables.** They survive compilation, need no `@use` plumbing through pnpm
  symlinks, and can be re-pointed at runtime - which is all the dark theme is.
- **Component styles are CSS Modules.** A federated remote's styles are injected
  into the _host's_ document, so scoped class names are what keeps `web` and
  `dashboard` from colliding inside `shell`.

## React rendering demonstration

`apps/web` contains a small feature (`src/features/react-rendering-demo/`) that
demonstrates initial render vs. rerender, an unnecessary rerender of a
`React.memo` child, its fix with `useMemo`/`useCallback`, and `useEffect`
dependency-array behaviour. React version in use: **19.0.0**.

See [docs/react-rendering-demo.md](docs/react-rendering-demo.md) for the
explanation and the live walkthrough.

## Filtering and derived-data performance

`apps/web` contains a second feature (`src/features/item-filter-demo/`) built on
the existing `GET /api/items`: the result is fetched once into local state, and
a text filter derives `visibleItems` from it without ever touching the fetched
array or the network. Two panels run the same UI side by side - one deriving
everything on every render, one using `useMemo`/`useCallback` - with render,
filter, calculation and HTTP-request counters plus a `performance.now()` timing.

The API fixture serves 500 items so the difference is observable, and the web
dev server proxies `/api` to the API on port 3333. Start both:

```bash
pnpm nx serve @interview/api
pnpm nx dev @interview/web
```

See [docs/item-filter-demo.md](docs/item-filter-demo.md) for the measurements,
the local state vs. Context vs. React Query reasoning, and the walkthrough.

## Testing and accessibility

The item-filtering feature above doubles as the testing example: unit tests
for the pure filter and for the filter control in isolation, an integration
test over the whole feature with only `fetch` mocked, one Playwright journey
in `apps/web-e2e`, and an axe (`jest-axe`) accessibility check - together with
a documented accessibility bug (an icon button with no accessible name, whose
activation also dropped keyboard focus) and its fix.

```bash
pnpm nx test @interview/web        # unit + integration + axe
pnpm nx e2e @interview/web-e2e     # starts the API and web dev server itself
```

See [docs/testing-and-accessibility.md](docs/testing-and-accessibility.md) for
the pyramid, what is mocked at each level, the accessibility
problem/cause/fix/verification, and the walkthrough.

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

Each application runs on its own. For the shell to render both federated
components, start `web` and `dashboard` first (or alongside it) — the shell
still loads without them, showing a fallback per missing remote.

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
pnpm nx e2e @interview/web-e2e
pnpm verify:boundaries   # expects the invalid app -> internal-lib import to fail
```

## Tech stack

- [Nx](https://nx.dev) — monorepo build system
- [React](https://react.dev) — UI framework
- [TypeScript](https://typescriptlang.org) — type safety
- [pnpm](https://pnpm.io) — package manager (workspaces)
- [ESLint](https://eslint.org) — linting and dependency enforcement
- [Vite](https://vite.dev) / [Vitest](https://vitest.dev) — dev server, bundler, tests
- [Module Federation](https://module-federation.io) — runtime composition of the three React apps
- [Playwright](https://playwright.dev) — end-to-end tests
- [Testing Library](https://testing-library.com) / [jest-axe](https://github.com/nickcolley/jest-axe) — component and accessibility tests
- [esbuild](https://esbuild.github.io) — API bundling
