import { useSession } from '@interview/auth';
import styles from './session-consumer.module.scss';

/**
 * The second app recognising a session it never created.
 *
 * This is the answer to "how does another app recognise the session when the
 * cookie is HttpOnly?", written as code rather than prose. Note what is NOT
 * here: no login form, no token, no `document.cookie`, no handoff from `web`,
 * no shared client storage. This app cannot read the credential - nobody can -
 * so it does the only thing available to it: it calls `/api/auth/me` with
 * `credentials: 'include'` and lets the browser attach whatever it holds.
 *
 * The cookie reaches this app because cookies are scoped by host and path, and
 * the port is not part of that scope: `localhost:4200` and `localhost:4201`
 * are different origins but share one cookie jar. In production the equivalent
 * is `Domain=.example.com` across `app.example.com` and `admin.example.com`.
 * See docs/authentication.md.
 */
export function SessionConsumer() {
  const { status, session, reload } = useSession();

  return (
    <section className="ui-card">
      <h2 className="ui-card__title">Session, as seen from a second app</h2>

      <p data-testid="session-state" className={styles.state}>
        {status === 'checking' && 'asking the server…'}
        {status === 'signed-out' && 'no session'}
        {status === 'signed-in' && session && (
          <>
            signed in as <strong>{session.user.username}</strong>
          </>
        )}
      </p>

      {status === 'signed-in' && session && (
        <p>
          Permissions:{' '}
          <code data-testid="permissions">
            {session.user.permissions.join(', ')}
          </code>
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" onClick={() => void reload()}>
          Re-check session
        </button>
      </div>

      <p className={styles.hint}>
        {status === 'signed-in'
          ? 'This app has no login form and never saw a password. It asked ' +
            '/api/auth/me and the browser attached the cookie.'
          : 'Sign in at http://localhost:4200, then re-check here — no reload ' +
            'of this app required.'}
      </p>

      <p className={styles.hint}>
        Readable from JavaScript:{' '}
        <code data-testid="readable-cookies">
          {document.cookie || 'nothing readable — both cookies are HttpOnly'}
        </code>
      </p>
    </section>
  );
}
