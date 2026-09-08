import { useState, type FormEvent } from 'react';
import { useSession } from '@interview/auth';
import { loadReport, type ReportResult } from './report-client';
import styles from './auth-demo.module.scss';

/**
 * The JWT session, end to end and clickable.
 *
 * What it demonstrates:
 *  - sign in, and the session surviving a page reload with no client storage
 *  - the access token expiring, and being replaced silently on the next call
 *  - a permission check answering 403 rather than 401
 *  - sign out revoking the refresh token server-side
 *  - `document.cookie` staying empty throughout, because both cookies are
 *    HttpOnly - the page proves it below rather than claiming it
 */

function SignInForm({
  onSubmit,
  error,
}: {
  onSubmit(username: string, password: string): void;
  error: string | null;
}) {
  const [username, setUsername] = useState('alice');
  const [password, setPassword] = useState('alice-password');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(username, password);
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span>Username</span>
        <input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>

      <button type="submit">Sign in</button>

      {/* `role="alert"` so a screen reader announces the failure, which a
          silently swapped-in paragraph would not. */}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <p className={styles.hint}>
        Try <code>alice</code> / <code>alice-password</code> (read + write) or{' '}
        <code>bob</code> / <code>bob-password</code> (read only).
      </p>
    </form>
  );
}

export function AuthDemo() {
  const { status, session, error, signIn, signOut, reload } = useSession();
  const [report, setReport] = useState<ReportResult | null>(null);

  async function onLoadReport() {
    setReport(await loadReport());
  }

  async function onSignOut() {
    setReport(null);
    await signOut();
  }

  return (
    <section className="ui-card">
      <h2 className="ui-card__title">Session (JWT + refresh token)</h2>

      <p data-testid="session-state" className={styles.state}>
        {status === 'checking' && 'checking session…'}
        {status === 'signed-out' && 'signed out'}
        {status === 'signed-in' && session && (
          <>
            signed in as <strong>{session.user.username}</strong>
          </>
        )}
      </p>

      {status === 'signed-out' && (
        <SignInForm onSubmit={signIn} error={error} />
      )}

      {status === 'signed-in' && session && (
        <div className={styles.session}>
          <p>
            Permissions:{' '}
            <code data-testid="permissions">
              {session.user.permissions.join(', ')}
            </code>
          </p>
          <p className={styles.hint}>
            The access token expires 60s after it was issued. Loading the report
            after that still works: the first call comes back 401
            <code>token_expired</code>, the client refreshes once and retries.
          </p>

          <div className={styles.actions}>
            <button type="button" onClick={onLoadReport}>
              Load report (needs items:write)
            </button>
            <button type="button" onClick={() => void reload()}>
              Re-check session
            </button>
            <button type="button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>

          {report && (
            <p
              data-testid="report"
              className={report.ok ? undefined : styles.error}
            >
              {report.ok
                ? `${report.itemCount} items, reported for ${report.requestedBy}`
                : report.error}
            </p>
          )}
        </div>
      )}

      <p className={styles.hint}>
        Readable from JavaScript:{' '}
        <code data-testid="readable-cookies">
          {document.cookie || 'nothing readable — both cookies are HttpOnly'}
        </code>
      </p>
    </section>
  );
}
