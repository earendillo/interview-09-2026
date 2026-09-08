import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AccessTokenClaims, JwtPayload } from './claims';

/**
 * A deliberately small HS256 implementation. The interview question is about
 * where a session is enforced, so the signing is kept visible and dependency
 * free rather than delegated to a library.
 *
 * SERVER ONLY. This module uses `node:crypto` and `Buffer`, so it is reachable
 * through `@interview/auth/server` and never through `@interview/auth`. The
 * signing key lives on the server; a browser has no business holding one.
 */

export interface SignOptions {
  secret: string;
  expiresInSeconds: number;
  /** Epoch seconds. Injected so tests never depend on the wall clock. */
  now: number;
}

export interface VerifyOptions {
  secret: string;
  /** Epoch seconds. */
  now: number;
}

/**
 * Why `expired` is its own reason: a client that gets `expired` should try the
 * refresh endpoint, while `signature`/`malformed` mean the credential is junk
 * and refreshing it would be pointless. The router turns this distinction into
 * different responses.
 */
export type VerifyResult =
  | { valid: true; payload: JwtPayload }
  | { valid: false; reason: 'malformed' | 'signature' | 'expired' };

const HEADER = encode({ alg: 'HS256', typ: 'JWT' });

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

export function signJwt(
  claims: AccessTokenClaims,
  { secret, expiresInSeconds, now }: SignOptions,
): string {
  const payload: JwtPayload = {
    ...claims,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const signingInput = `${HEADER}.${encode(payload)}`;

  return `${signingInput}.${sign(signingInput, secret)}`;
}

/** Constant-time comparison, so a wrong signature leaks no timing information. */
function signatureMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);

  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyJwt(
  token: string,
  { secret, now }: VerifyOptions,
): VerifyResult {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return { valid: false, reason: 'malformed' };
  }

  const [header, payload, signature] = segments;

  // The signature is checked before the payload is parsed or trusted - an
  // unverified `exp` is just an attacker-supplied number.
  if (!signatureMatches(sign(`${header}.${payload}`, secret), signature)) {
    return { valid: false, reason: 'signature' };
  }

  let parsed: JwtPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (typeof parsed?.exp !== 'number') {
    return { valid: false, reason: 'malformed' };
  }

  // `exp` is the moment the token stops being valid, so `now === exp` is dead.
  if (now >= parsed.exp) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, payload: parsed };
}
