/**
 * Cookie transport for the session.
 *
 * Both tokens travel as `HttpOnly` cookies, which is the answer to "how does
 * another app recognise the session?" - it does not read the token, because it
 * cannot. It makes a credentialed request and the browser attaches the cookie
 * for it. The cookie's Path/Domain/SameSite attributes below, not any code in
 * the client, are what decides which apps that includes.
 */

export const COOKIE = {
  access: 'access_token',
  refresh: 'refresh_token',
} as const;

/**
 * The refresh cookie is only ever presented to the refresh and logout
 * endpoints, so scoping it here keeps it off every other request.
 */
export const REFRESH_COOKIE_PATH = '/api/auth';

export function parseCookies(
  header: string | undefined,
): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!header) {
    return jar;
  }

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 1) {
      continue;
    }

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    try {
      jar[name] = decodeURIComponent(value);
    } catch {
      jar[name] = value;
    }
  }

  return jar;
}

function serialize(
  name: string,
  value: string,
  { maxAge, path }: { maxAge: number; path: string },
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    // Lax over None because this demo is same-site through the Vite dev proxy.
    // Genuinely cross-site apps need `SameSite=None; Secure` plus CORS with
    // credentials - see docs/authentication.md.
    'SameSite=Lax',
  ].join('; ');
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface CookieLifetimes {
  accessMaxAge: number;
  refreshMaxAge: number;
}

/** `Set-Cookie` values that establish the session. */
export function sessionCookies(
  { accessToken, refreshToken }: SessionTokens,
  { accessMaxAge, refreshMaxAge }: CookieLifetimes,
): [string, string] {
  return [
    serialize(COOKIE.access, accessToken, { maxAge: accessMaxAge, path: '/' }),
    serialize(COOKIE.refresh, refreshToken, {
      maxAge: refreshMaxAge,
      path: REFRESH_COOKIE_PATH,
    }),
  ];
}

/**
 * `Set-Cookie` values that remove it. A cookie is only overwritten when the
 * name AND path match, which is why the refresh cookie is cleared on its own
 * scoped path.
 */
export function clearedSessionCookies(): [string, string] {
  return [
    `${COOKIE.access}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    `${COOKIE.refresh}=; Path=${REFRESH_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax`,
  ];
}
