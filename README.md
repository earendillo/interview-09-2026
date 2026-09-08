# interview-09-2026

A minimal Nx monorepo used as a domain-neutral technical playground: several
React applications, a trivial HTTP API, shared libraries, and mechanically
enforced dependency boundaries.

The workspace foundation, a Module Federation setup, and a cookie-based session
shared across two of the applications. CI/CD is intentionally not implemented.

## Repository structure

```
apps/
  shell/            React application, Module Federation host (port 4202)
  web/              React application, Module Federation remote (port 4200)
  dashboard/        React application, Module Federation remote (port 4201)
  legacy/           React 17 application, Module Federation remote (port 4203)
  api/              Minimal HTTP service, in-memory data, session (port 3333)
  web-e2e/          Playwright end-to-end tests for `web`

libraries/
  ui/               Shared UI components          (type:shared-lib)
  auth/             Session client + permissions  (type:shared-lib)
                    (`@interview/auth/server` holds the server-only signing)
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
import { useSession } from '@interview/auth';
```

`@interview/auth` also has a second entry point, `@interview/auth/server`, for
the parts that need `node:crypto`. See
[docs/authentication.md § 6](docs/authentication.md) for why that split exists
and the test that keeps it honest.

Deep relative imports across project boundaries (`../../../libraries/ui/src`)
are not allowed; within a project, relative imports are fine.

## Module Federation

`shell` is the host; `web`, `dashboard` and `legacy` are remotes. The host loads
each component at runtime over HTTP — there is no build-time dependency between
the applications, and no `@interview/*` import between them.

```
shell (:4202, host, React 19)
  ├── web/WebWidget              ← :4200  React 19, shared singleton
  ├── dashboard/DashboardWidget  ← :4201  React 19, shared singleton
  └── legacy/LegacyWidget        ← :4203  React 17, its own copy
```

| Application | Role   | React  | Share scope | Exposes                                   |
| ----------- | ------ | ------ | ----------- | ----------------------------------------- |
| `shell`     | host   | 19.0.0 | `default`   | —                                         |
| `web`       | remote | 19.0.0 | `default`   | `./WebWidget` (a React component)         |
| `dashboard` | remote | 19.0.0 | `default`   | `./DashboardWidget` (a React component)   |
| `legacy`    | remote | 17.0.2 | `legacy`    | `./LegacyWidget` (a `mount` function)     |

Implemented with [`@module-federation/vite`](https://module-federation.io/integrations/build-tool/vite),
configured in each application's `vite.config.mts`, plus
[`@module-federation/runtime`](https://module-federation.io/guide/basic/runtime.html)
in the host for runtime remote registration.

### The remote manifest

The host does **not** compile remote URLs into its bundle. It fetches
`/remotes.json` at boot (`cache: 'no-store'`) and registers whatever that names:

```jsonc
{
  "web": {
    "url": "https://cdn/web/v2.0.0/remoteEntry.js",
    "fallbackUrl": "https://cdn/web/v1.9.3/remoteEntry.js",
    "shareScope": "default",
    "contract": 1
  }
}
```

That is what makes the applications independently deployable: rolling a remote
back is a pointer change in the manifest, with no host rebuild and no host
redeploy. `contract` is the host/remote interface version — a remote declaring a
number the host does not implement is refused at load rather than mounted.

Code: `apps/shell/src/federation/`, dev manifest: `apps/shell/public/remotes.json`.

### Two React majors on one page

`web` and `dashboard` join the host's `default` share scope and use the host's
single React 19 instance. `legacy` cannot: React's hook dispatcher is
module-level state inside one copy of React, and React 19 tags elements
`Symbol.for("react.transitional.element")` where React 17 uses
`Symbol.for("react.element")` — so a React 17 element rendered by React 19
is not recognised as an element at all.

So `legacy` shares nothing and joins its own `legacy` scope, and the contract
changes with it. Instead of exposing a component, it exposes a mount function
that takes a DOM node:

```tsx
export const contract = 1;

export function mount(container: Element, props?: LegacyWidgetProps) {
  ReactDOM.render(<LegacyWidget {...props} />, container);
  return () => ReactDOM.unmountComponentAtNode(container);
}
```

The host renders an empty `<div>` and hands over the node
(`apps/shell/src/app/foreign-remote.tsx`). Two React trees then run side by
side, each with its own reconciler and its own state.

### Failure handling and rollback

| Failure                       | What happens                                                     |
| ----------------------------- | ---------------------------------------------------------------- |
| Remote entry 404 / unreachable | Rolls back to `fallbackUrl` and retries once; the UI marks it     |
| No `fallbackUrl` to roll back to | That one slot shows a fallback, the other remotes keep working  |
| Contract version mismatch      | Refused before `mount` is called                                  |
| Manifest unreachable/malformed | Host boots on built-in defaults and shows a degraded banner       |
| Error inside the legacy tree   | Contained by the host — React 17 has no error boundaries of its own |

Rollbacks are reported through a small external store, read in the UI with
`useSyncExternalStore`, so the card shows the build actually in use rather than
the one the manifest asked for.

To see it: start all four applications, then edit `apps/shell/public/remotes.json`
so one `url` points at a path that does not exist, give it a `fallbackUrl` that
does, and reload the shell.

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

## Authentication across applications

A session carried by two HttpOnly cookies — a 60-second HS256 access token and
a longer-lived, revocable, rotating refresh token — enforced entirely in the
API. `web` (:4200) has the sign-in panel; `dashboard` (:4201) has no login form
at all and recognises the same session by calling `/api/auth/me` with
`credentials: 'include'`, because an HttpOnly cookie is not something an
application can read or pass along.

```bash
pnpm nx serve @interview/api        # :3333
pnpm nx dev @interview/web          # :4200 — sign in (alice/alice-password)
pnpm nx dev @interview/dashboard    # :4201 — then press "Re-check session"
```

Demonstrated end to end: sign-in, the session surviving a reload with zero
client-side storage, silent refresh after the access token expires, 401 vs 403
for permissions, and logout revoking the token server-side rather than only
clearing a cookie.

See [docs/authentication.md](docs/authentication.md) for the browser–server
flow, the enforcement table, and the boundary between what is demo shape and
what is production shape.

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

The session gets the same treatment — see
[docs/authentication.md § 8](docs/authentication.md) for its own pyramid,
including a bundler-level regression test for a bug that only a real browser
could catch.

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
pnpm nx dev @interview/legacy      # http://localhost:4203
pnpm nx dev @interview/shell       # http://localhost:4202
pnpm nx serve @interview/api       # http://localhost:3333
```

Each application runs on its own. For the shell to render all three federated
components, start `web`, `dashboard` and `legacy` first (or alongside it) — the shell
still loads without them, showing a fallback per missing remote.

### API

The API keeps an in-memory dataset and an in-memory session store — no
database. `/api/items` is public on purpose; `/api/reports/summary` requires
the `items:write` permission.

```bash
curl http://localhost:3333/api/items
# [{"id":1,"name":"Item 1"},{"id":2,"name":"Item 2"},{"id":3,"name":"Item 3"}]

curl http://localhost:3333/api/items/1
# {"id":1,"name":"Item 1"}

curl -i http://localhost:3333/api/items/999
# HTTP/1.1 404 Not Found

curl -i -X POST http://localhost:3333/api/auth/login   -H 'Content-Type: application/json'   -d '{"username":"alice","password":"alice-password"}'
# HTTP/1.1 200 OK
# Set-Cookie: access_token=…;  Path=/;         Max-Age=60;  HttpOnly; SameSite=Lax
# Set-Cookie: refresh_token=…; Path=/api/auth; Max-Age=900; HttpOnly; SameSite=Lax

curl -i http://localhost:3333/api/reports/summary
# HTTP/1.1 401 Unauthorized   {"error":"Not signed in","code":"no_session"}
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
- HS256 JWT + rotating refresh tokens — hand-written, ~110 lines, no auth library
- [Playwright](https://playwright.dev) — end-to-end tests
- [Testing Library](https://testing-library.com) / [jest-axe](https://github.com/nickcolley/jest-axe) — component and accessibility tests
- [esbuild](https://esbuild.github.io) — API bundling
