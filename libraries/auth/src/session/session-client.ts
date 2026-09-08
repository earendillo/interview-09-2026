import { apiFetch } from './api-fetch';

/**
 * The session calls, in one place, shared by every application.
 *
 * This lives in a library rather than in one app because the whole point of an
 * HttpOnly session is that any app can ask about it: `web` signs in, and
 * `dashboard` recognises the result without ever handling a credential.
 *
 * The URLs are relative, so each app's Vite dev proxy forwards them to
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
