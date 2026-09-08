import { apiFetch } from './api-fetch';

/**
 * The API calls this feature makes, in one place.
 *
 * All of them are relative, so the Vite dev proxy forwards them to
 * http://localhost:3333 and the cookies stay same-origin - no CORS, no
 * `credentials` special-casing beyond what `apiFetch` already does.
 */

export interface SessionUser {
  username: string;
  permissions: string[];
}

export interface Session {
  user: SessionUser;
  /** Epoch seconds at which the current access token stops working. */
  expiresAt: number;
}

export type LoginResult =
  { ok: true; user: SessionUser } | { ok: false; error: string };

export type ReportResult =
  | { ok: true; itemCount: number; requestedBy: string }
  | { ok: false; error: string };

async function json<T>(response: Response): Promise<Partial<T>> {
  try {
    return (await response.json()) as Partial<T>;
  } catch {
    return {};
  }
}

/**
 * Asks the server who the caller is. This is the answer to "how does another
 * app recognise the session?" - it makes this call, and the browser attaches
 * the cookie. The app itself never inspects a token.
 */
export async function loadSession(): Promise<Session | null> {
  const response = await apiFetch('/api/auth/me');
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as Session;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const body = await json<{ user: SessionUser; error: string }>(response);
  return response.ok && body.user
    ? { ok: true, user: body.user }
    : { ok: false, error: body.error ?? 'Sign in failed' };
}

export async function logout(): Promise<void> {
  // Not `apiFetch`: logging out must not try to refresh a session it is in the
  // middle of ending.
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

/** A call that needs `items:write`, so a 403 is reachable from the UI. */
export async function loadReport(): Promise<ReportResult> {
  const response = await apiFetch('/api/reports/summary');
  const body = await json<{
    itemCount: number;
    requestedBy: string;
    required: string;
    code: string;
  }>(response);

  if (response.status === 403) {
    return {
      ok: false,
      error: `403 Forbidden - this account is missing ${body.required ?? 'a permission'}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `${response.status} - ${body.code ?? 'failed'}`,
    };
  }

  return {
    ok: true,
    itemCount: body.itemCount ?? 0,
    requestedBy: body.requestedBy ?? '',
  };
}
