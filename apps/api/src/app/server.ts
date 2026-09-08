import { randomBytes } from 'node:crypto';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
} from 'node:http';
import { createRefreshStore } from './auth/refresh-store';
import {
  REFRESH_TTL_SECONDS,
  createSession,
  type Session,
} from './auth/session';
import type { ApiRequest } from './http';
import { createRouter } from './router';

/**
 * The node:http adapter. It does three things the pure routers cannot: read
 * the request body, read the Cookie header, and write Set-Cookie.
 */

const BODY_LIMIT_BYTES = 16 * 1024;

async function readJsonBody(
  request: IncomingMessage,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return { ok: true, body: undefined };
  }

  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > BODY_LIMIT_BYTES) {
      return { ok: false };
    }
  }

  if (!raw) {
    return { ok: true, body: undefined };
  }

  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function sessionSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured) {
    return configured;
  }

  // A per-process random key: fine for a demo, and it makes the consequence
  // visible - restarting the API invalidates every access token, because the
  // signature can no longer be verified. Real deployments load a stable secret
  // (and rotate it with a key id in the JWT header).
  console.warn('JWT_SECRET not set - using a random key for this process only');
  return randomBytes(32).toString('hex');
}

export function createServer(session: Session = defaultSession()): Server {
  const route = createRouter(session);

  return createHttpServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const parsed = await readJsonBody(req);

    if (!parsed.ok) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const request: ApiRequest = {
      method: req.method ?? 'GET',
      pathname,
      cookie: req.headers.cookie,
      body: parsed.body,
    };

    const { status, body, cookies } = route(request);

    res.writeHead(status, {
      'Content-Type': 'application/json',
      // Responses that depend on the session must not be cached as if they
      // were the same for everyone.
      'Cache-Control': 'no-store',
      ...(cookies ? { 'Set-Cookie': cookies } : {}),
    });
    res.end(JSON.stringify(body));
  });
}

function defaultSession(): Session {
  return createSession({
    store: createRefreshStore({ ttlSeconds: REFRESH_TTL_SECONDS }),
    secret: sessionSecret(),
    now: () => Math.floor(Date.now() / 1000),
  });
}
