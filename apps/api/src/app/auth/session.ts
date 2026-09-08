import { hasPermission, type JwtPayload } from '@interview/auth';
// Signing lives behind the server entry point: it needs `node:crypto`, and
// keeping it out of `@interview/auth` is what stops it reaching a browser bundle.
import { signJwt, verifyJwt } from '@interview/auth/server';
import type { ApiRequest, ApiResponse } from '../http';
import {
  COOKIE,
  clearedSessionCookies,
  parseCookies,
  sessionCookies,
} from './cookies';
import type { RefreshStore } from './refresh-store';
import { authenticate, findUser, type User } from './users';

/**
 * Where the session is actually enforced.
 *
 * The split that the whole design rests on:
 *
 *   access token   JWT, stateless, SHORT-lived. Verified from its signature on
 *                  every request. Carries permissions, so no lookup is needed.
 *                  Cannot be revoked - its TTL is the revocation delay.
 *   refresh token  opaque, stateful, longer-lived. Only ever presented to
 *                  /api/auth/*. Revocable, because it means nothing without
 *                  the server-side record.
 */

/**
 * Short on purpose. Sixty seconds is the window in which a logged-out or
 * downgraded user still passes `authorize`, and it is short enough to watch
 * the refresh happen while clicking through the demo.
 */
export const ACCESS_TTL_SECONDS = 60;
export const REFRESH_TTL_SECONDS = 15 * 60;

export interface SessionDeps {
  store: RefreshStore;
  /** HMAC key for the access token. Injected so tests are deterministic. */
  secret: string;
  /** Epoch seconds. Injected so expiry can be tested without waiting. */
  now: () => number;
}

export type AuthorizeResult =
  | { ok: true; user: User; payload: JwtPayload }
  | { ok: false; response: ApiResponse };

export interface Session {
  /** Handles `/api/auth/*`; returns undefined for anything else. */
  handle(request: ApiRequest): ApiResponse | undefined;
  /** Guards a route: authenticates the caller, then checks one permission. */
  authorize(request: ApiRequest, permission: string): AuthorizeResult;
}

/** Every 401 carries a `code`, because the client reacts differently to each. */
type AuthFailure = 'no_session' | 'token_expired' | 'token_invalid';

function unauthorized(code: AuthFailure, error: string): ApiResponse {
  return {
    status: 401,
    body: { error, code },
    // An unusable credential is cleared, so the browser stops resending it.
    // `token_expired` is the exception: that cookie is expected to be replaced
    // by a refresh, so the session survives.
    cookies: code === 'token_expired' ? undefined : clearedSessionCookies(),
  };
}

export function createSession({ store, secret, now }: SessionDeps): Session {
  function readAccessToken(
    request: ApiRequest,
  ): { ok: true; payload: JwtPayload } | { ok: false; response: ApiResponse } {
    const token = parseCookies(request.cookie)[COOKIE.access];
    if (!token) {
      return {
        ok: false,
        response: unauthorized('no_session', 'Not signed in'),
      };
    }

    const result = verifyJwt(token, { secret, now: now() });
    if (!result.valid) {
      return result.reason === 'expired'
        ? {
            ok: false,
            response: unauthorized('token_expired', 'Access token expired'),
          }
        : {
            ok: false,
            response: unauthorized('token_invalid', 'Invalid access token'),
          };
    }

    return { ok: true, payload: result.payload };
  }

  /**
   * Mints an access token and the cookies that carry the session.
   *
   * The refresh token is passed in rather than issued here: on login it starts
   * a new family, but on refresh it MUST be the token `store.consume` rotated
   * to, otherwise the new token joins a family the old one cannot revoke.
   */
  function establish(user: User, refreshToken: string): ApiResponse['cookies'] {
    const accessToken = signJwt(
      { sub: user.username, permissions: user.permissions },
      { secret, expiresInSeconds: ACCESS_TTL_SECONDS, now: now() },
    );

    return sessionCookies(
      { accessToken, refreshToken },
      {
        accessMaxAge: ACCESS_TTL_SECONDS,
        refreshMaxAge: REFRESH_TTL_SECONDS,
      },
    );
  }

  function login(request: ApiRequest): ApiResponse {
    const { username, password } = (request.body ?? {}) as Record<
      string,
      unknown
    >;

    if (typeof username !== 'string' || typeof password !== 'string') {
      return { status: 400, body: { error: 'username and password required' } };
    }

    const user = authenticate(username, password);
    if (!user) {
      // One message for both "no such user" and "wrong password", so the
      // response cannot be used to enumerate accounts.
      return { status: 401, body: { error: 'Invalid credentials' } };
    }

    return {
      status: 200,
      body: { user, expiresIn: ACCESS_TTL_SECONDS },
      cookies: establish(user, store.issue(user.username, now())),
    };
  }

  function refresh(request: ApiRequest): ApiResponse {
    const token = parseCookies(request.cookie)[COOKIE.refresh];
    if (!token) {
      return unauthorized('no_session', 'No refresh token');
    }

    const result = store.consume(token, now());
    if (!result.ok) {
      return {
        status: 401,
        body: {
          error: 'Session ended, please sign in again',
          code: `refresh_${result.reason}`,
        },
        cookies: clearedSessionCookies(),
      };
    }

    // Permissions are re-read here rather than copied from the old token, so
    // a change in the directory takes effect one refresh later at worst.
    const user = findUser(result.subject);
    if (!user) {
      return {
        status: 401,
        body: { error: 'User no longer exists', code: 'refresh_unknown_user' },
        cookies: clearedSessionCookies(),
      };
    }

    return {
      status: 200,
      body: { user, expiresIn: ACCESS_TTL_SECONDS },
      cookies: establish(user, result.token),
    };
  }

  function logout(request: ApiRequest): ApiResponse {
    const token = parseCookies(request.cookie)[COOKIE.refresh];
    if (token) {
      // The real logout: without this the cookies are gone from one browser
      // but the session could still be resumed by anyone holding the token.
      store.revoke(token);
    }

    return {
      status: 200,
      body: { ok: true },
      cookies: clearedSessionCookies(),
    };
  }

  function me(request: ApiRequest): ApiResponse {
    const access = readAccessToken(request);
    if (!access.ok) {
      return access.response;
    }

    const { sub, permissions, exp } = access.payload;
    return {
      status: 200,
      body: { user: { username: sub, permissions }, expiresAt: exp },
    };
  }

  const ROUTES: Record<string, (request: ApiRequest) => ApiResponse> = {
    'POST /api/auth/login': login,
    'POST /api/auth/refresh': refresh,
    'POST /api/auth/logout': logout,
    'GET /api/auth/me': me,
  };

  return {
    handle(request) {
      return ROUTES[`${request.method} ${request.pathname}`]?.(request);
    },

    authorize(request, permission) {
      const access = readAccessToken(request);
      if (!access.ok) {
        return { ok: false, response: access.response };
      }

      // Authentication succeeded and authorization is what failed, so this is
      // 403: signing in again would not help.
      if (!hasPermission(access.payload, permission)) {
        return {
          ok: false,
          response: {
            status: 403,
            body: {
              error: 'Forbidden',
              code: 'missing_permission',
              required: permission,
            },
          },
        };
      }

      return {
        ok: true,
        user: {
          username: access.payload.sub,
          permissions: access.payload.permissions,
        },
        payload: access.payload,
      };
    },
  };
}
