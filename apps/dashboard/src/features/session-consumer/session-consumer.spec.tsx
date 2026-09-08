import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionConsumer } from './session-consumer';

/**
 * The claim under test is the one the interview question asks about: a second
 * application, with no login form and no access to the cookie, recognises the
 * session purely by asking the server.
 *
 * So `fetch` is the only mock, and the assertions are about the request this
 * app makes - the credentialed GET - and what it renders from the answer.
 */
const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    clone() {
      return this;
    },
  } as unknown as Response);
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionConsumer', () => {
  it('recognises a session established by another app', async () => {
    fetchMock.mockImplementation(() =>
      respond(200, {
        user: { username: 'alice', permissions: ['items:read', 'items:write'] },
        expiresAt: 1_700_000_060,
      }),
    );

    render(<SessionConsumer />);

    await waitFor(() =>
      expect(screen.getByTestId('session-state').textContent).toContain(
        'signed in as alice',
      ),
    );
    expect(screen.getByTestId('permissions').textContent).toBe(
      'items:read, items:write',
    );

    // The request carries no credential of its own - it asks the browser to
    // attach one. Without `credentials: 'include'` the cookie is not sent and
    // this app would show "no session" for a user who is signed in.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(init).toMatchObject({ credentials: 'include' });
  });

  it('reports no session when the server does not recognise the caller', async () => {
    fetchMock.mockImplementation(() =>
      respond(401, { error: 'Not signed in', code: 'no_session' }),
    );

    render(<SessionConsumer />);

    await waitFor(() =>
      expect(screen.getByTestId('session-state').textContent).toBe(
        'no session',
      ),
    );
    expect(screen.queryByTestId('permissions')).toBeNull();
  });

  it('never renders a readable cookie, because both are HttpOnly', async () => {
    fetchMock.mockImplementation(() => respond(401, { code: 'no_session' }));

    render(<SessionConsumer />);

    await waitFor(() =>
      expect(screen.getByTestId('session-state').textContent).toBe(
        'no session',
      ),
    );
    // jsdom's cookie jar is empty here for the same reason the browser's is:
    // nothing in this app ever writes one.
    expect(screen.getByTestId('readable-cookies').textContent).toBe(
      'nothing readable — both cookies are HttpOnly',
    );
  });
});
