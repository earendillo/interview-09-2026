import { beforeEach, describe, expect, it } from 'vitest';
import type { Item } from '@interview/shared';
import { COOKIE } from './auth/cookies';
import { createRefreshStore } from './auth/refresh-store';
import { createSession } from './auth/session';
import type { ApiRequest, ApiResponse } from './http';
import { ITEM_COUNT } from './items';
import { createRouter } from './router';

let route: (request: ApiRequest) => ApiResponse;

beforeEach(() => {
  route = createRouter(
    createSession({
      store: createRefreshStore({ ttlSeconds: 900 }),
      secret: 'test-secret',
      now: () => 1_700_000_000,
    }),
  );
});

function get(pathname: string, cookie?: string): ApiResponse {
  return route({ method: 'GET', pathname, cookie });
}

/** Logs in and returns the Cookie header a browser would send back. */
function signIn(username: string): string {
  const response = route({
    method: 'POST',
    pathname: '/api/auth/login',
    body: { username, password: `${username}-password` },
  });

  return (response.cookies ?? [])
    .map((value) => value.split(';')[0])
    .join('; ');
}

describe('items routes', () => {
  it('returns all items', () => {
    const { status, body } = get('/api/items');

    expect(status).toBe(200);
    expect(body).toHaveLength(ITEM_COUNT);
    expect((body as Item[])[0]).toEqual({ id: 1, name: 'Item 1' });
    expect((body as Item[])[ITEM_COUNT - 1]).toEqual({
      id: ITEM_COUNT,
      name: `Item ${ITEM_COUNT}`,
    });
  });

  it('returns a single item by id', () => {
    expect(get('/api/items/1')).toEqual({
      status: 200,
      body: { id: 1, name: 'Item 1' },
    });
  });

  it('returns 404 for an unknown item', () => {
    expect(get('/api/items/999').status).toBe(404);
  });

  it('stays public, so the existing demo needs no session', () => {
    expect(get('/api/items').status).toBe(200);
  });
});

describe('routing', () => {
  it('returns 404 for an unknown path', () => {
    expect(get('/api/unknown').status).toBe(404);
  });

  it('returns 405 for an unsupported method on a known path', () => {
    expect(route({ method: 'DELETE', pathname: '/api/items' }).status).toBe(
      405,
    );
  });

  it('hands /api/auth paths to the session router', () => {
    expect(get('/api/auth/me').status).toBe(401);
  });
});

describe('GET /api/reports/summary', () => {
  it('answers 401 for an anonymous caller', () => {
    const response = get('/api/reports/summary');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'no_session' });
  });

  it('answers 403 for a signed-in user without items:write', () => {
    const response = get('/api/reports/summary', signIn('bob'));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'missing_permission' });
  });

  it('serves the report to a user who holds items:write', () => {
    const response = get('/api/reports/summary', signIn('alice'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      itemCount: ITEM_COUNT,
      requestedBy: 'alice',
    });
  });

  it('rejects a caller presenting only a refresh token', () => {
    // The refresh cookie is scoped to /api/auth, so it must not authenticate
    // an ordinary API call even if a client sends it anyway.
    const cookie = signIn('alice')
      .split('; ')
      .filter((pair) => pair.startsWith(COOKIE.refresh))
      .join('; ');

    expect(get('/api/reports/summary', cookie).status).toBe(401);
  });
});
