import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from './jwt';

const SECRET = 'test-secret';
const NOW = 1_700_000_000;

function sign(overrides: Partial<Parameters<typeof signJwt>[0]> = {}): string {
  return signJwt(
    { sub: 'alice', permissions: ['items:read'], ...overrides },
    { secret: SECRET, expiresInSeconds: 60, now: NOW },
  );
}

describe('signJwt / verifyJwt', () => {
  it('round-trips the payload', () => {
    const result = verifyJwt(sign(), { secret: SECRET, now: NOW });

    expect(result).toEqual({
      valid: true,
      payload: {
        sub: 'alice',
        permissions: ['items:read'],
        iat: NOW,
        exp: NOW + 60,
      },
    });
  });

  it('produces a three-segment HS256 token', () => {
    const segments = sign().split('.');

    expect(segments).toHaveLength(3);
    expect(
      JSON.parse(Buffer.from(segments[0], 'base64url').toString()),
    ).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('rejects a token whose payload was tampered with', () => {
    const [header, , signature] = sign().split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'alice', permissions: ['items:write'] }),
    ).toString('base64url');

    expect(
      verifyJwt(`${header}.${forged}.${signature}`, {
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ valid: false, reason: 'signature' });
  });

  it('rejects a token signed with a different secret', () => {
    expect(verifyJwt(sign(), { secret: 'other-secret', now: NOW })).toEqual({
      valid: false,
      reason: 'signature',
    });
  });

  it('rejects an expired token, distinguishing it from an invalid one', () => {
    expect(verifyJwt(sign(), { secret: SECRET, now: NOW + 61 })).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  it('accepts a token in its final second of life', () => {
    const result = verifyJwt(sign(), { secret: SECRET, now: NOW + 59 });

    expect(result.valid).toBe(true);
  });

  it('rejects a malformed token', () => {
    expect(verifyJwt('not-a-jwt', { secret: SECRET, now: NOW })).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });
});
