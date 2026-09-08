import { useCallback, useEffect, useState } from 'react';
import {
  loadSession,
  login as postLogin,
  logout as postLogout,
  type Session,
} from './session-client';

/**
 * Session state for the panel.
 *
 * The interesting part is `status`: on first paint the app does not yet know
 * whether it has a session, because the only way to find out is to ask the
 * server - the cookie is HttpOnly, so there is nothing local to read. Every
 * app that shares this session has the same three states.
 */
export type SessionStatus = 'checking' | 'signed-in' | 'signed-out';

export interface SessionState {
  status: SessionStatus;
  session: Session | null;
  error: string | null;
  signIn(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Re-reads `/api/auth/me`, e.g. after a refresh. */
  reload(): Promise<void>;
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const current = await loadSession();
    setSession(current);
    setStatus(current ? 'signed-in' : 'signed-out');
  }, []);

  useEffect(() => {
    // The mount-time probe. Without it a reload would show the login form to
    // someone who is still signed in.
    void reload();
  }, [reload]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      setError(null);
      const result = await postLogin(username, password);

      if (!result.ok) {
        setError(result.error);
        setStatus('signed-out');
        return;
      }

      // Read the session back from the server rather than trusting the login
      // response, so `expiresAt` comes from the token that was actually issued.
      await reload();
    },
    [reload],
  );

  const signOut = useCallback(async () => {
    await postLogout();
    setSession(null);
    setStatus('signed-out');
    setError(null);
  }, []);

  return { status, session, error, signIn, signOut, reload };
}
