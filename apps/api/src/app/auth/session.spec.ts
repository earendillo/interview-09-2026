import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@interview/auth';
import type { ApiRequest, ApiResponse } from '../http';
import { COOKIE } from './cookies';
import { createRefreshStore } from './refresh-store';
import { ACCESS_TTL_SECONDS, createSession, type Session } from './session';

const START = 1_700_000_000;
const ALICE = [PERMISSIONS.itemsRead, PERMISSIONS.itemsWrite];

let clock = START;
let session: Session;

function request(
  method: string,
  pathname: string,
  {
    cookies = {},
    body,
  }: { cookies?: Record<string, string>; body?: unknown } = {},
): ApiRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  return { method, pathname, cookie: cookie || undefined, body };
}

/** Reads a token back out of the Set-Cookie values, the way a browser would. */
function cookieValue(response: ApiResponse, name: string): string {
  const header = (response.cookies ?? []).find((value) =>
    value.startsWith(`${name}=`),
  );
  if (!header) {
    throw new Error(`no ${name} cookie on the response`);
  }
  return decodeURIComponent(header.slice(name.length + 1).split(';')[0]);
}

function handle(input: ApiRequest): ApiResponse {
  const response = session.handle(input);
  if (!response) {
    throw new Error(`no route for ${input.method} ${input.pathname}`);
  }
  return response;
}

function login(username = 'alice', password = `${username}-password`) {
  return handle(
    request('POST', '/api/auth/login', { body: { username, password } }),
  );
}

/** The cookie jar a browser would hold after this response. */
function jar(response: ApiResponse): Record<string, string> {
  return {
    [COOKIE.access]: cookieValue(response, COOKIE.access),
    [COOKIE.refresh]: cookieValue(response, COOKIE.refresh),
  };
}

beforeEach(() => {
  clock = START;
  session = createSession({
    store: createRefreshStore({ ttlSeconds: 900 }),
    secret: 'test-secret',
    now: () => clock,
  });
});

describe('POST /api/auth/login', () => {
  it('returns the user and sets both session cookies', () => {
    const response = login();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { username: 'alice', permissions: ALICE },
      expiresIn: ACCESS_TTL_SECONDS,
    });
    expect(response.cookies).toHaveLength(2);
  });

  it('never puts a token in the response body, only in HttpOnly cookies', () => {
    const response = login();

    expect(JSON.stringify(response.body)).not.toContain(
      cookieValue(response, COOKIE.access),
    );
  });

  it('rejects a wrong password without setting cookies', () => {
    const response = handle(
      request('POST', '/api/auth/login', {
        body: { username: 'alice', password: 'wrong' },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.cookies).toBeUndefined();
  });

  it('rejects a request with no credentials', () => {
    expect(
      handle(request('POST', '/api/auth/login', { body: {} })).status,
    ).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('recognises the session from the cookie alone', () => {
    const cookies = jar(login());

    const response = handle(request('GET', '/api/auth/me', { cookies }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { username: 'alice', permissions: ALICE },
      expiresAt: START + ACCESS_TTL_SECONDS,
    });
  });

  it('reports no session when no cookie is sent', () => {
    const response = handle(request('GET', '/api/auth/me'));

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'no_session' });
  });

  it('reports an expired access token distinctly, so the client can refresh', () => {
    const cookies = jar(login());
    clock = START + ACCESS_TTL_SECONDS;

    const response = handle(request('GET', '/api/auth/me', { cookies }));

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'token_expired' });
  });

  it('rejects a forged token and clears the cookies', () => {
    const response = handle(
      request('GET', '/api/auth/me', {
        cookies: { [COOKIE.access]: 'a.b.c' },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'token_invalid' });
    expect(response.cookies).toHaveLength(2);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a new access token after the old one expired', () => {
    const cookies = jar(login());
    clock = START + ACCESS_TTL_SECONDS + 1;

    const refreshed = handle(request('POST', '/api/auth/refresh', { cookies }));

    expect(refreshed.status).toBe(200);
    expect(
      handle(request('GET', '/api/auth/me', { cookies: jar(refreshed) }))
        .status,
    ).toBe(200);
  });

  it('rotates the refresh token', () => {
    const cookies = jar(login());

    const refreshed = handle(request('POST', '/api/auth/refresh', { cookies }));

    expect(cookieValue(refreshed, COOKIE.refresh)).not.toBe(
      cookies[COOKIE.refresh],
    );
  });

  it('rejects a replayed refresh token and kills the live one with it', () => {
    const first = jar(login());
    const second = jar(
      handle(request('POST', '/api/auth/refresh', { cookies: first })),
    );

    const replay = handle(
      request('POST', '/api/auth/refresh', { cookies: first }),
    );

    expect(replay.status).toBe(401);
    expect(replay.body).toMatchObject({ code: 'refresh_reused' });
    expect(
      handle(request('POST', '/api/auth/refresh', { cookies: second })).status,
    ).toBe(401);
  });

  it('reports no session when the refresh cookie is missing', () => {
    expect(handle(request('POST', '/api/auth/refresh')).body).toMatchObject({
      code: 'no_session',
    });
  });

  it('reads permissions from the directory on refresh, not from the old token', () => {
    const cookies = jar(login('bob'));

    const refreshed = handle(request('POST', '/api/auth/refresh', { cookies }));

    expect(refreshed.body).toMatchObject({
      user: { username: 'bob', permissions: [PERMISSIONS.itemsRead] },
    });
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookies', () => {
    const cookies = jar(login());

    const response = handle(request('POST', '/api/auth/logout', { cookies }));

    expect(response.status).toBe(200);
    expect(
      response.cookies?.every((value) => value.includes('Max-Age=0')),
    ).toBe(true);
  });

  it('revokes the refresh token server-side, so the session cannot be resumed', () => {
    const cookies = jar(login());
    handle(request('POST', '/api/auth/logout', { cookies }));

    expect(
      handle(request('POST', '/api/auth/refresh', { cookies })).status,
    ).toBe(401);
  });

  it('succeeds when there is nothing to log out of', () => {
    expect(handle(request('POST', '/api/auth/logout')).status).toBe(200);
  });
});

describe('authorize', () => {
  it('allows a user who holds the permission', () => {
    const cookies = jar(login('alice'));

    expect(
      session.authorize(
        request('GET', '/api/reports/summary', { cookies }),
        PERMISSIONS.itemsWrite,
      ),
    ).toMatchObject({ ok: true, user: { username: 'alice' } });
  });

  it('answers 403, not 401, for an authenticated user without the permission', () => {
    const cookies = jar(login('bob'));

    const result = session.authorize(
      request('GET', '/api/reports/summary', { cookies }),
      PERMISSIONS.itemsWrite,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.response).toMatchObject({
      status: 403,
      body: { code: 'missing_permission' },
    });
  });

  it('answers 401 when there is no token at all', () => {
    const result = session.authorize(
      request('GET', '/api/reports/summary'),
      PERMISSIONS.itemsRead,
    );

    expect(!result.ok && result.response.status).toBe(401);
  });

  it('enforces expiry on a guarded route, not just on /me', () => {
    const cookies = jar(login('alice'));
    clock = START + ACCESS_TTL_SECONDS;

    const result = session.authorize(
      request('GET', '/api/reports/summary', { cookies }),
      PERMISSIONS.itemsWrite,
    );

    expect(!result.ok && result.response.body).toMatchObject({
      code: 'token_expired',
    });
  });
});

describe('routes it does not own', () => {
  it('declines them, so the main router can handle them', () => {
    expect(session.handle(request('GET', '/api/items'))).toBeUndefined();
  });
});
