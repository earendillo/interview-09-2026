import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from './server';

/**
 * The one test that goes over a real socket. Everything else works on plain
 * objects; this proves the node:http adapter actually reads a JSON body, reads
 * the Cookie header and writes Set-Cookie, which object-level tests cannot.
 */

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

/** Turns the response's Set-Cookie headers into a Cookie header. */
function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}

function login(username: string): Promise<Response> {
  return fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: `${username}-password` }),
  });
}

describe('createServer', () => {
  it('serves the public items route', async () => {
    const response = await fetch(`${origin}/api/items`);

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(500);
  });

  it('sets two HttpOnly cookies on login', async () => {
    const cookies = (await login('alice')).headers.getSetCookie();

    expect(cookies).toHaveLength(2);
    expect(cookies.every((value) => value.includes('HttpOnly'))).toBe(true);
  });

  it('recognises the session on a later request from the cookie alone', async () => {
    const cookie = cookieHeader(await login('alice'));

    const me = await fetch(`${origin}/api/auth/me`, { headers: { cookie } });

    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ user: { username: 'alice' } });
  });

  it('enforces permissions on a guarded route', async () => {
    const cookie = cookieHeader(await login('bob'));

    const report = await fetch(`${origin}/api/reports/summary`, {
      headers: { cookie },
    });

    expect(report.status).toBe(403);
  });

  it('refreshes a session end to end', async () => {
    const cookie = cookieHeader(await login('alice'));

    const refreshed = await fetch(`${origin}/api/auth/refresh`, {
      method: 'POST',
      headers: { cookie },
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.headers.getSetCookie()).toHaveLength(2);
  });

  it('answers 400 for a malformed JSON body instead of crashing', async () => {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });

    expect(response.status).toBe(400);
  });
});
