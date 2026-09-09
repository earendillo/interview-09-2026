# Module Federation

Three React applications composed at runtime by a fourth, with no build-time
dependency between any of them — including one on a different React major.

`shell` is the host; `web`, `dashboard` and `legacy` are remotes. The host loads
each component over HTTP at runtime, so there is no `@interview/*` import
between the applications and no shared build step.

```
shell (:4202, host, React 19)
  ├── web/WebWidget              ← :4200  React 19, shared singleton
  ├── dashboard/DashboardWidget  ← :4201  React 19, shared singleton
  └── legacy/LegacyWidget        ← :4203  React 17, its own copy
```

| Application | Role   | React  | Share scope | Exposes                                 |
| ----------- | ------ | ------ | ----------- | --------------------------------------- |
| `shell`     | host   | 19.0.0 | `default`   | —                                       |
| `web`       | remote | 19.0.0 | `default`   | `./WebWidget` (a React component)       |
| `dashboard` | remote | 19.0.0 | `default`   | `./DashboardWidget` (a React component) |
| `legacy`    | remote | 17.0.2 | `legacy`    | `./LegacyWidget` (a `mount` function)   |

Implemented with [`@module-federation/vite`](https://module-federation.io/integrations/build-tool/vite),
configured in each application's `vite.config.mts`, plus
[`@module-federation/runtime`](https://module-federation.io/guide/basic/runtime.html)
in the host for runtime remote registration.

```bash
pnpm nx dev @interview/web         # :4200
pnpm nx dev @interview/dashboard   # :4201
pnpm nx dev @interview/legacy      # :4203
pnpm nx dev @interview/shell       # :4202 — start this one last
```

Each application also runs on its own. The shell loads without any of them,
showing a fallback per missing remote.

---

## 1. The remote manifest

The host does **not** compile remote URLs into its bundle. It fetches
`/remotes.json` at boot (`cache: 'no-store'`) and registers whatever that names:

```jsonc
{
  "web": {
    "url": "https://cdn/web/v2.0.0/remoteEntry.js",
    "fallbackUrl": "https://cdn/web/v1.9.3/remoteEntry.js",
    "shareScope": "default",
    "contract": 1,
  },
}
```

That is what makes the applications independently deployable: rolling a remote
back is a pointer change in the manifest, with no host rebuild and no host
redeploy. `contract` is the host/remote interface version — a remote declaring a
number the host does not implement is refused at load rather than mounted.

Code: `apps/shell/src/federation/`, dev manifest: `apps/shell/public/remotes.json`.

## 2. Two React majors on one page

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

One consequence worth naming: `legacy` imports only the _stylesheet_ from
`@interview/ui`, never the `Button`. The shared component declares
`ref?: Ref<HTMLButtonElement>` as an ordinary prop, which is React 19 behaviour
— under React 17 it would silently not be a ref at all. A shared UI library
crossing a React major is a boundary, not a convenience.

## 3. Failure handling and rollback

| Failure                          | What happens                                                        |
| -------------------------------- | ------------------------------------------------------------------- |
| Remote entry 404 / unreachable   | Rolls back to `fallbackUrl` and retries once; the UI marks it       |
| No `fallbackUrl` to roll back to | That one slot shows a fallback, the other remotes keep working      |
| Contract version mismatch        | Refused before `mount` is called                                    |
| Manifest unreachable/malformed   | Host boots on built-in defaults and shows a degraded banner         |
| Error inside the legacy tree     | Contained by the host — React 17 has no error boundaries of its own |

Rollbacks are reported through a small external store, read in the UI with
`useSyncExternalStore`, so the card shows the build actually in use rather than
the one the manifest asked for.

To see it: start all four applications, then edit `apps/shell/public/remotes.json`
so one `url` points at a path that does not exist, give it a `fallbackUrl` that
does, and reload the shell.

## 4. Specific to this playground

Everything in §§ 1–3 was built for this repository, not carried over from a
production system. The equivalent split for the workspace rules is in
[dependency-boundaries.md § Production experience](dependency-boundaries.md).

In particular:

- The **remote manifest** (`/remotes.json`, `parseManifest`, `contract`
  versioning) is a design written here, not a copy of a production system. A
  real deployment would serve it from the CDN or config service that the
  deployment pipeline already writes to, with cache headers and a schema, rather
  than from the host's `public/` directory.
- The **rollback mechanism** — `fallbackUrl`, one retry, the
  `useSyncExternalStore` rollback store — is a demonstration of the shape. In
  production the fallback pointer is normally maintained by the deploy tooling,
  and a rollback is observable in monitoring rather than in a badge on a card.
- The **React 17 remote** exists to make the version-boundary problem concrete.
  It is a deliberately constructed scenario, not a migration that was actually
  carried out here.
- The three remotes are served by `vite dev` on localhost ports. There is no
  CDN, no versioned artefact storage, and no deployment pipeline — CI/CD is
  intentionally not implemented in this workspace.

What is _not_ simplified, because it is the answer to the question: the absence
of any build-time coupling between host and remotes, the runtime manifest as the
only place a remote URL appears, the contract check before mount, per-remote
error isolation, and the separate share scope for the foreign React version.

## 5. Tests

```bash
pnpm nx test @interview/shell     # manifest, registry, rollback store, slots
pnpm nx test @interview/legacy    # the mount/unmount contract
```

| File                                  | What it covers                                       |
| ------------------------------------- | ---------------------------------------------------- |
| `federation/manifest.spec.ts`         | parsing, validation, contract mismatch, `fallbackOf` |
| `federation/manifest-source.spec.ts`  | network failure and malformed JSON → defaults        |
| `federation/remote-registry.spec.ts`  | registration, rollback to fallback, retry once       |
| `federation/rollback-store.spec.ts`   | subscribe/snapshot semantics, deduplication          |
| `app/remote-slot.spec.tsx`            | Suspense fallback, error boundary isolation          |
| `app/foreign-remote.spec.tsx`         | mount, unmount on cleanup, contract refusal          |
| `remote/legacy-widget-mount.spec.tsx` | the React 17 mount function's own contract           |
