import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { AuthDemo } from './auth-demo';

/**
 * INTEGRATION - the whole login panel, from the form to the rendered session.
 *
 * `fetch` is the only mock, and it is a real boundary: it would otherwise hit
 * the API over the network. Everything below it runs unmodified, including
 * `apiFetch` and its refresh-and-retry. The handler map below stands in for
 * the API's own contract, which `apps/api` tests separately against a real
 * socket - so the two suites meet at the same status codes and `code` values.
 */

type Handler = (init: RequestInit) => { status: number; body: unknown };

const ALICE = { username: 'alice', permissions: ['items:read', 'items:write'] };
const BOB = { username: 'bob', permissions: ['items:read'] };

let handlers: Record<string, Handler>;
let signedInAs: typeof ALICE | typeof BOB | null;

function credentialsOf(init: RequestInit) {
  return JSON.parse(String(init.body ?? '{}')) as {
    username?: string;
    password?: string;
  };
}

/** A small stand-in for the API: enough state to log in, read and log out. */
function defaultHandlers(): Record<string, Handler> {
  return {
    'GET /api/auth/me': () =>
      signedInAs
        ? { status: 200, body: { user: signedInAs, expiresAt: 1_700_000_060 } }
        : { status: 401, body: { code: 'no_session' } },

    'POST /api/auth/login': (init) => {
      const { username, password } = credentialsOf(init);
      const user =
        username === 'alice' ? ALICE : username === 'bob' ? BOB : null;
      if (!user || password !== `${username}-password`) {
        return { status: 401, body: { error: 'Invalid credentials' } };
      }
      signedInAs = user;
      return { status: 200, body: { user, expiresIn: 60 } };
    },

    'POST /api/auth/logout': () => {
      signedInAs = null;
      return { status: 200, body: { ok: true } };
    },

    'GET /api/reports/summary': () => {
      if (!signedInAs) {
        return { status: 401, body: { code: 'no_session' } };
      }
      return signedInAs.permissions.includes('items:write')
        ? {
            status: 200,
            body: { itemCount: 500, requestedBy: signedInAs.username },
          }
        : {
            status: 403,
            body: { code: 'missing_permission', required: 'items:write' },
          };
    },
  };
}

beforeEach(() => {
  signedInAs = null;
  handlers = defaultHandlers();

  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    const handler = handlers[`${init.method ?? 'GET'} ${url}`];
    if (!handler) {
      throw new Error(`unexpected request: ${init.method ?? 'GET'} ${url}`);
    }

    const { status, body } = handler(init);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function signIn(username: string, password = `${username}-password`) {
  fireEvent.change(screen.getByLabelText(/username/i), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

/** Waits out the mount-time session probe before asserting. */
async function renderPanel() {
  const result = render(<AuthDemo />);
  await screen.findByTestId('session-state');
  return result;
}

describe('AuthDemo', () => {
  it('shows the sign-in form when there is no session', async () => {
    await renderPanel();

    expect(screen.getByTestId('session-state')).toHaveTextContent('signed out');
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('restores a session that the cookie already carries', async () => {
    signedInAs = ALICE;

    await renderPanel();

    expect(screen.getByTestId('session-state')).toHaveTextContent('alice');
  });

  it('signs in and lists the granted permissions', async () => {
    await renderPanel();

    await signIn('alice');

    await waitFor(() =>
      expect(screen.getByTestId('session-state')).toHaveTextContent('alice'),
    );
    expect(screen.getByTestId('permissions')).toHaveTextContent('items:write');
  });

  it('reports invalid credentials without signing in', async () => {
    await renderPanel();

    await signIn('alice', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid credentials/i,
    );
    expect(screen.getByTestId('session-state')).toHaveTextContent('signed out');
  });

  it('serves the guarded report to a user who holds the permission', async () => {
    signedInAs = ALICE;
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /load report/i }));

    expect(await screen.findByTestId('report')).toHaveTextContent('500');
  });

  it('explains the 403 for a signed-in user who lacks the permission', async () => {
    signedInAs = BOB;
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /load report/i }));

    expect(await screen.findByTestId('report')).toHaveTextContent(
      /items:write/i,
    );
  });

  it('signs out and returns to the form', async () => {
    signedInAs = ALICE;
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() =>
      expect(screen.getByTestId('session-state')).toHaveTextContent(
        'signed out',
      ),
    );
  });

  it('shows that the page cannot read the token, because it is HttpOnly', async () => {
    signedInAs = ALICE;
    await renderPanel();

    // The whole point of the cookie flag: the session works, and the script
    // still has no access to the credential carrying it.
    expect(screen.getByTestId('readable-cookies')).toHaveTextContent(
      /nothing readable/i,
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = await renderPanel();

    expect(await axe(container)).toHaveNoViolations();
  });
});
