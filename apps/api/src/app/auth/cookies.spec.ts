import { describe, expect, it } from 'vitest';
import {
  COOKIE,
  REFRESH_COOKIE_PATH,
  clearedSessionCookies,
  parseCookies,
  sessionCookies,
} from './cookies';

describe('parseCookies', () => {
  it('reads the session cookies out of a Cookie header', () => {
    expect(parseCookies('access_token=abc; refresh_token=def')).toEqual({
      access_token: 'abc',
      refresh_token: 'def',
    });
  });

  it('url-decodes values', () => {
    expect(parseCookies('a=one%20two')).toEqual({ a: 'one two' });
  });

  it('returns nothing when the header is absent', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('ignores malformed pairs rather than throwing', () => {
    expect(parseCookies('broken; a=1')).toEqual({ a: '1' });
  });
});

describe('sessionCookies', () => {
  const [access, refresh] = sessionCookies(
    { accessToken: 'jwt-value', refreshToken: 'opaque-value' },
    { accessMaxAge: 60, refreshMaxAge: 900 },
  );

  it('marks the access cookie HttpOnly so no script can read the token', () => {
    expect(access).toContain(`${COOKIE.access}=jwt-value`);
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=Lax');
    expect(access).toContain('Max-Age=60');
  });

  it('sends the access cookie to the whole API', () => {
    expect(access).toContain('Path=/');
  });

  it('scopes the refresh cookie to the auth endpoints only', () => {
    // A refresh token that is attached to every ordinary API call is exposed
    // far more widely than it needs to be.
    expect(refresh).toContain(`Path=${REFRESH_COOKIE_PATH}`);
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('Max-Age=900');
  });
});

describe('clearedSessionCookies', () => {
  it('expires both cookies on the paths they were set on', () => {
    const [access, refresh] = clearedSessionCookies();

    expect(access).toContain(`${COOKIE.access}=;`);
    expect(access).toContain('Max-Age=0');
    expect(access).toContain('Path=/');
    expect(refresh).toContain(`${COOKIE.refresh}=;`);
    expect(refresh).toContain('Max-Age=0');
    expect(refresh).toContain(`Path=${REFRESH_COOKIE_PATH}`);
  });
});
