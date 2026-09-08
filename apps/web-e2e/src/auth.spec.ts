import { expect, test } from '@playwright/test';

/**
 * E2E — the session, against the real API, in a real browser.
 *
 * What only this level can prove: that the cookies the API sets are actually
 * accepted and re-sent by a browser's cookie jar. `HttpOnly`, `Path` and
 * `SameSite` are enforced by the browser, not by the application, so jsdom with
 * a mocked `fetch` cannot fail on a wrong attribute — it never parses one.
 *
 * What is deliberately *not* here: token expiry, refresh rotation, replay
 * detection, 401-vs-403 wiring. Those are faster and more precise in
 * `apps/api/src/app/auth/*.spec.ts` (with an injected clock) and in
 * `libraries/auth/src/session/api-fetch.spec.ts`.
 */

test('signs in, survives a reload, and signs out', async ({ page }) => {
  await page.goto('/');

  const state = page.getByTestId('session-state');
  await expect(state).toHaveText('signed out', { timeout: 30_000 });

  // 1. Sign in through the form, as a user would.
  await page.getByLabel('Username').fill('bob');
  await page.getByLabel('Password').fill('bob-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(state).toHaveText('signed in as bob');
  await expect(page.getByTestId('permissions')).toHaveText('items:read');

  // 2. The credential is in the jar, and out of reach of the page. Both halves
  //    matter: the first says the session exists, the second that no script
  //    can read it.
  const cookies = await page.context().cookies();
  const access = cookies.find((cookie) => cookie.name === 'access_token');
  expect(access?.httpOnly).toBe(true);
  expect(access?.path).toBe('/');

  const refresh = cookies.find((cookie) => cookie.name === 'refresh_token');
  expect(refresh?.httpOnly).toBe(true);
  // Scoped, so it is not attached to ordinary API calls.
  expect(refresh?.path).toBe('/api/auth');

  await expect(page.getByTestId('readable-cookies')).toHaveText(
    'nothing readable — both cookies are HttpOnly',
  );

  // 3. The session survives a reload with no client-side storage: the app
  //    re-asks `/api/auth/me` and the browser re-attaches the cookie.
  await page.reload();
  await expect(state).toHaveText('signed in as bob');

  // 4. Authorization is a separate decision from authentication: `bob` is
  //    signed in and still cannot have this.
  await page.getByRole('button', { name: /Load report/ }).click();
  await expect(page.getByTestId('report')).toHaveText(
    '403 Forbidden - this account is missing items:write',
  );

  // 5. Sign out clears the jar, and the state survives a reload the other way.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(state).toHaveText('signed out');

  const afterLogout = await page.context().cookies();
  expect(
    afterLogout.filter((cookie) => cookie.name.endsWith('_token')),
  ).toEqual([]);

  await page.reload();
  await expect(state).toHaveText('signed out');
});
