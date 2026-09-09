# Authentication across applications

The session for this workspace: an HttpOnly cookie pair, enforced in the API,
recognised by two independently served React applications that never handle a
token.

```
libraries/auth/src/
├── index.ts                 BROWSER entry  — permissions, session client, useSession
├── server.ts                SERVER entry   — signJwt / verifyJwt (node:crypto)
├── lib/claims.ts            the token payload shape, shared by both
├── lib/jwt.ts               HS256, server only
├── lib/permissions.ts       hasPermission — authorization, not authentication
├── session/api-fetch.ts     credentialed fetch + single-flight refresh retry
├── session/session-client.ts  login / logout / loadSession
├── session/use-session.ts   the three-state hook every app uses
└── browser-entry.spec.ts    the guard that keeps node:crypto out of a bundle

apps/api/src/app/auth/
├── session.ts               where the session is ENFORCED (login/refresh/logout/me/authorize)
├── cookies.ts               cookie transport: HttpOnly, Path, SameSite
├── refresh-store.ts         revocable server state: rotation + family reuse detection
└── users.ts                 the directory: scrypt hashes, permissions

apps/web/src/features/auth-demo/               signs in      (:4200)
apps/dashboard/src/features/session-consumer/  recognises it (:4201)
```

Run it:

```bash
pnpm nx serve @interview/api        # :3333
pnpm nx dev @interview/web          # :4200 — sign in here
pnpm nx dev @interview/dashboard    # :4201 — then press "Re-check session" here
```

Accounts: `alice` / `alice-password` (`items:read`, `items:write`) and
`bob` / `bob-password` (`items:read` only).

---

## 1. The login flow

```
BROWSER (:4200)                      API (:3333)
     │
     │  POST /api/auth/login  {username, password}
     │  credentials: include
     ├────────────────────────────────────►
     │                                 authenticate()      users.ts
     │                                   scrypt(password, salt) == stored hash?
     │                                   one error for both failure modes,
     │                                   so accounts cannot be enumerated
     │                                 store.issue(user)   refresh-store.ts
     │                                   opaque 32-byte token, new family
     │                                 signJwt({sub, permissions})  jwt.ts
     │                                   HS256, exp = now + 60s
     │
     │  200 {user, expiresIn}
     │  Set-Cookie: access_token=…;  Path=/;         Max-Age=60;  HttpOnly; SameSite=Lax
     │  Set-Cookie: refresh_token=…; Path=/api/auth; Max-Age=900; HttpOnly; SameSite=Lax
     ◄────────────────────────────────────┤
     │
     │  the page stores NOTHING. document.cookie is empty — the demo
     │  renders its value on screen rather than claiming this.
     │
     │  GET /api/auth/me   (browser attaches access_token)
     ├────────────────────────────────────►
     │                                 verifyJwt → {sub, permissions, exp}
     │  200 {user, expiresAt}
     ◄────────────────────────────────────┤
     │
     ▼  useSession(): 'checking' → 'signed-in'
```

Two token types, because they answer different questions:

|           | access token                               | refresh token                         |
| --------- | ------------------------------------------ | ------------------------------------- |
| form      | JWT (HS256), self-describing               | opaque random bytes                   |
| state     | none — verified from its signature         | a server-side record                  |
| lifetime  | 60s (`ACCESS_TTL_SECONDS`)                 | 15 min                                |
| sent to   | every `/api` request (`Path=/`)            | only `/api/auth/*` (`Path=/api/auth`) |
| revocable | **no** — its TTL _is_ the revocation delay | **yes** — deleting the record ends it |

The access token carries `permissions`, so an authorization check needs no
database lookup. The price is that it cannot be withdrawn early, which is the
entire reason the TTL is 60 seconds rather than a day.

## 2. How the second app recognises the session

The question the flow above answers implicitly, asked directly: `dashboard`
runs on `:4201`, was never told a password, and cannot read the cookie —
`HttpOnly` means `document.cookie` does not contain it, for any script, in any
app. So it does the only thing available to it:

```ts
// libraries/auth/src/session/session-client.ts
export async function loadSession(): Promise<Session | null> {
  const response = await apiFetch('/api/auth/me'); // credentials: 'include'
  return response.ok ? ((await response.json()) as Session) : null;
}
```

It asks the server, and **the browser attaches the credential**. The app is not
a participant in that decision — the cookie's own attributes are:

```
Path=/           reaches every /api call the app makes
Domain (unset)   → host-only: localhost
SameSite=Lax     top-level navigations and same-site requests
```

Cookies are scoped by **host and path; the port is not part of the scope**.
`localhost:4200` and `localhost:4201` are different _origins_ — different
bundles, different dev servers, independently deployable — but one cookie jar.
Each app's Vite dev proxy forwards `/api` to `:3333`, so from the browser's
point of view every call is same-origin: no CORS, no
`Access-Control-Allow-Credentials`, no token handoff between the apps.

Production is the same mechanism with different values. For
`app.example.com` + `admin.example.com` behind one API:

```
Set-Cookie: access_token=…; Domain=.example.com; Secure; HttpOnly; SameSite=Lax
```

For genuinely cross-**site** apps (different registrable domains) it becomes
`SameSite=None; Secure` plus CORS with `Access-Control-Allow-Credentials: true`
and an explicit origin allowlist — and, increasingly, third-party cookie
blocking makes that unreliable, which is when the honest answer is a shared
auth origin (BFF / token exchange) rather than a wider cookie.

What is deliberately _not_ the mechanism: `localStorage`, a token in a query
string, `postMessage` between apps, or a shared JS module holding the session.
Each of those puts a credential somewhere a script can read it.

## 3. Where each rule is enforced

Every enforcement point is on the server. The client's copies are hints for the
UI, never decisions.

| Rule                              | Enforced in                                   | Failure                                        |
| --------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| Is the caller signed in?          | `session.ts` `readAccessToken` → `verifyJwt`  | 401 `no_session` / `token_invalid`             |
| Has the token expired?            | `jwt.ts` `verifyJwt`, `now >= exp`            | 401 `token_expired`                            |
| May they do this?                 | `session.ts` `authorize` → `hasPermission`    | **403** `missing_permission`                   |
| Is the refresh token still valid? | `refresh-store.ts` `consume`                  | 401 `refresh_unknown` / `_expired` / `_reused` |
| Has the session been ended?       | `refresh-store.ts` `revoke`, called by logout | the next refresh fails                         |

Three details worth pointing at:

**401 vs 403.** A missing or expired credential is 401 — signing in again fixes
it. A valid credential without the permission is 403 — signing in again changes
nothing. The web demo makes this clickable: anonymous gets 401 from
`/api/reports/summary`, `bob` gets 403, `alice` gets the report.

**The signature is checked before the payload is parsed.** An unverified `exp`
is an attacker-supplied number, so `verifyJwt` compares the HMAC (in constant
time, via `timingSafeEqual`) before it reads a single claim.

**Permissions are re-read on refresh, not copied.** `refresh` looks the user up
again rather than trusting the old token's claims, so a permission change takes
effect one refresh later — 60 seconds at worst, not 15 minutes.

**An unusable access token ends the session, expiry excepted.** Every 401 except
`token_expired` clears _both_ cookies (`session.ts`, `unauthorized`), the
refresh cookie included. That couples the two tokens' lifetimes in one place, on
purpose: a `token_invalid` means the credential is junk — tampered, or signed
with a key this process no longer has — and continuing to hand the browser a
refresh token after that is offering to resume a session whose other half
already failed to verify. `token_expired` is the deliberate exception, because
that cookie is about to be replaced by the refresh.

## 4. Expiry, refresh and the retry

The 60-second access token expires constantly by design. The client handles
exactly one case, and only that one:

```ts
// libraries/auth/src/session/api-fetch.ts
const response = await fetch(url, request);
if (response.status !== 401 || (await codeOf(response)) !== 'token_expired') {
  return response; // every other 401 needs a real sign-in
}
if (!(await refreshSession())) return response;
return fetch(url, request); // one retry, never a loop
```

Which is why every 401 from the API carries a `code`: `token_expired` is
retryable, `no_session` and `token_invalid` are not, and the client cannot tell
them apart from the status alone.

The refresh itself is **single-flight**. Refresh tokens rotate, and the store
treats a second use of a rotated token as theft and drops the whole family — so
two concurrent refreshes would log the user out. `inFlightRefresh` makes every
caller that hits a 401 at the same moment await the same promise.

`token_expired` is also the one 401 that does **not** clear the cookies: that
session is expected to survive, and the cookie is about to be replaced.

## 5. Logout and revocation

```ts
// apps/api/src/app/auth/session.ts
function logout(request) {
  const token = parseCookies(request.cookie)[COOKIE.refresh];
  if (token) store.revoke(token); // the real logout
  return { status: 200, body: { ok: true }, cookies: clearedSessionCookies() };
}
```

Clearing the cookies logs out _one browser_. Dropping the refresh family ends
the _session_ — anyone holding a copy of that token, in any app, gets
`refresh_reused` / `refresh_unknown` on their next attempt. An access token
already issued still verifies for up to 60 more seconds; that window is the
documented cost of a stateless access token, and shortening the TTL is the only
lever that shortens it.

Revocation is also why `clearedSessionCookies()` writes the refresh cookie back
on `Path=/api/auth`: a cookie is only overwritten when **both** the name and the
path match. Clearing it on `/` would leave the original in place.

## 6. Keeping the signing key out of the browser

`@interview/auth` has two entry points, and the split is load-bearing:

```jsonc
// libraries/auth/package.json
"exports": {
  ".":        "./src/index.ts",   // browser-safe: permissions, session client, useSession
  "./server": "./src/server.ts"   // signJwt / verifyJwt — node:crypto
}
```

This is not decoration. When `lib/jwt.ts` was re-exported from `index.ts`, any
`import { … } from '@interview/auth'` in `apps/web` pulled `node:crypto` into
the browser bundle along with it — `useSession`, `hasPermission`, it did not
matter which — and the application rendered a blank page:

```
Module "node:crypto" has been externalized for browser compatibility.
Cannot access "node:crypto.createHmac" in client code.
```

Nothing caught it. Vitest runs in Node; `tsc` does not model bundling;
`vite build` externalised the import and exited 0. Only a real browser failed.

So the regression test bundles the public entry the way a browser would, and
asserts the mirror image too — that the _server_ entry still fails the same
bundle, which keeps the guard from passing vacuously:

```ts
// libraries/auth/src/browser-entry.spec.ts
await build({ entryPoints: [index], bundle: true, platform: 'browser' }); // must succeed
await expect(build({ entryPoints: [server] /* … */ })).rejects.toThrow(/node:crypto/);
```

## 7. What is a demo and what is production shape

Honest boundaries, since this is a playground:

| Production shape                          | This repo                                     |
| ----------------------------------------- | --------------------------------------------- |
| Users in a database                       | `Map` seeded at startup, scrypt-hashed        |
| Refresh store in Redis / a table          | `Map`, lost on restart                        |
| Stable `JWT_SECRET`, rotated with a `kid` | env var, else a per-process random key        |
| `Secure` cookies over HTTPS               | omitted — dev is plain HTTP on localhost      |
| Access TTL of 5–15 minutes                | **60 seconds**, so expiry is watchable        |
| A vetted JOSE library                     | ~110 hand-written lines, so it stays readable |

The parts that are _not_ simplified, because they are the answer to the
question: the access/refresh split, HttpOnly transport, refresh rotation with
family reuse detection, 401 vs 403, server-side revocation, and permissions
re-read on refresh.

## 8. Tests

```bash
pnpm nx test @interview/api         # session, cookies, refresh store, router, server
pnpm nx test @interview/auth        # jwt, permissions, api-fetch, browser-entry guard
pnpm nx test @interview/web         # the sign-in panel
pnpm nx test @interview/dashboard   # the second app recognising the session
pnpm nx e2e @interview/web-e2e      # the journey through a real browser
```

| Level       | File                                           | What only this level catches                          |
| ----------- | ---------------------------------------------- | ----------------------------------------------------- |
| unit        | `libraries/auth/src/lib/jwt.spec.ts`           | tampered signature, `now >= exp`, malformed segments  |
| unit        | `apps/api/src/app/auth/refresh-store.spec.ts`  | rotation, replay killing the family, expiry           |
| unit        | `libraries/auth/src/session/api-fetch.spec.ts` | retry only on `token_expired`, single-flight, no loop |
| unit        | `libraries/auth/src/browser-entry.spec.ts`     | a Node builtin reaching a browser bundle              |
| integration | `apps/api/src/app/auth/session.spec.ts`        | 401 vs 403, cookie clearing, permissions re-read      |
| integration | `apps/api/src/app/server.spec.ts`              | real HTTP: `Set-Cookie` headers, status codes         |
| integration | `apps/dashboard/…/session-consumer.spec.tsx`   | the credentialed `/api/auth/me` call, `fetch` mocked  |
| e2e         | `apps/web-e2e/src/auth.spec.ts`                | the real cookie jar, `Set-Cookie`, surviving a reload |
