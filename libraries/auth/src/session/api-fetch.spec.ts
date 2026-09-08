import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api-fetch';

/**
 * `fetch` is stubbed here because it is the browser boundary this module
 * exists to wrap. The assertions are about what the wrapper does - which
 * requests it makes, in which order, and what it hands back - not about the
 * stub itself.
 */

type Reply = { status: number; body?: unknown };

let calls: string[];
let fetchMock: ReturnType<typeof vi.fn>;

function reply({ status, body = {} }: Reply): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Queues one reply per call, in order. */
function respondWith(...replies: Reply[]) {
  for (const value of replies) {
    fetchMock.mockImplementationOnce((url: string) => {
      calls.push(String(url));
      return Promise.resolve(reply(value));
    });
  }
}

const EXPIRED: Reply = { status: 401, body: { code: 'token_expired' } };
const OK: Reply = { status: 200, body: { ok: true } };

beforeEach(() => {
  calls = [];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('sends credentials, so the browser attaches the HttpOnly cookie', async () => {
    respondWith(OK);

    await apiFetch('/api/items');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/items',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('returns a successful response without refreshing', async () => {
    respondWith(OK);

    const response = await apiFetch('/api/items');

    expect(response.status).toBe(200);
    expect(calls).toEqual(['/api/items']);
  });

  it('refreshes and retries once when the access token expired', async () => {
    respondWith(EXPIRED, OK, OK);

    const response = await apiFetch('/api/reports/summary');

    expect(calls).toEqual([
      '/api/reports/summary',
      '/api/auth/refresh',
      '/api/reports/summary',
    ]);
    expect(response.status).toBe(200);
  });

  it('gives up after one retry instead of looping', async () => {
    respondWith(EXPIRED, OK, EXPIRED);

    const response = await apiFetch('/api/reports/summary');

    expect(response.status).toBe(401);
    expect(calls).toHaveLength(3);
  });

  it('does not refresh a 401 that refreshing cannot fix', async () => {
    respondWith({ status: 401, body: { code: 'no_session' } });

    const response = await apiFetch('/api/reports/summary');

    expect(response.status).toBe(401);
    expect(calls).toEqual(['/api/reports/summary']);
  });

  it('does not refresh a 403, because the permission is missing, not the token', async () => {
    respondWith({ status: 403, body: { code: 'missing_permission' } });

    await apiFetch('/api/reports/summary');

    expect(calls).toEqual(['/api/reports/summary']);
  });

  it('returns the original 401 when the refresh itself fails', async () => {
    respondWith(EXPIRED, { status: 401, body: { code: 'refresh_reused' } });

    const response = await apiFetch('/api/reports/summary');

    expect(response.status).toBe(401);
    expect(calls).toEqual(['/api/reports/summary', '/api/auth/refresh']);
  });

  it('shares one refresh between concurrent requests', async () => {
    // Refresh tokens rotate and a replay revokes the session, so two parallel
    // refreshes would log the user out. The in-flight refresh must be shared.
    respondWith(EXPIRED, EXPIRED, OK, OK, OK);

    await Promise.all([
      apiFetch('/api/items'),
      apiFetch('/api/reports/summary'),
    ]);

    expect(calls.filter((url) => url === '/api/auth/refresh')).toHaveLength(1);
  });
});
