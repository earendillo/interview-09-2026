/**
 * The client half of the session.
 *
 * The app never sees a token: both cookies are HttpOnly, so `document.cookie`
 * shows nothing and there is no `Authorization` header to set. All this
 * wrapper does is ask the browser to attach whatever it holds
 * (`credentials: 'include'`) and handle the one case the server cannot: an
 * access token that expired mid-session.
 */

export const REFRESH_URL = '/api/auth/refresh';

/** The only 401 worth retrying: everything else needs a real sign-in. */
const RETRYABLE = 'token_expired';

/**
 * Shared between callers. Refresh tokens rotate and the server treats a replay
 * as a stolen token, so two concurrent refreshes would end the session - every
 * request that hits a 401 at the same time must await the same one.
 */
let inFlightRefresh: Promise<boolean> | null = null;

async function codeOf(response: Response): Promise<string | undefined> {
  try {
    // The body is read from a clone, so the caller still gets an unread one.
    const body = (await response.clone().json()) as { code?: string };
    return body.code;
  } catch {
    return undefined;
  }
}

function refreshSession(): Promise<boolean> {
  inFlightRefresh ??= fetch(REFRESH_URL, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}

/**
 * `fetch` for API calls that need the session. Retries at most once, after a
 * successful refresh; never loops.
 */
export async function apiFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const request = { ...init, credentials: 'include' as const };

  const response = await fetch(url, request);
  if (response.status !== 401 || (await codeOf(response)) !== RETRYABLE) {
    return response;
  }

  if (!(await refreshSession())) {
    // The session is genuinely over - hand back the original 401 so the caller
    // can send the user to the login form.
    return response;
  }

  return fetch(url, request);
}
