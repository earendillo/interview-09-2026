import { beforeEach, describe, expect, it } from 'vitest';
import { createRefreshStore, type RefreshStore } from './refresh-store';

const NOW = 1_700_000_000;
const TTL = 900;

describe('createRefreshStore', () => {
  let store: RefreshStore;

  beforeEach(() => {
    store = createRefreshStore({ ttlSeconds: TTL });
  });

  it('issues an opaque token that is not a JWT', () => {
    const token = store.issue('alice', NOW);

    expect(token).not.toContain('.');
    expect(token.length).toBeGreaterThan(20);
  });

  it('issues a distinct token every time', () => {
    expect(store.issue('alice', NOW)).not.toBe(store.issue('alice', NOW));
  });

  it('resolves a valid token to its subject and rotates it', () => {
    const first = store.issue('alice', NOW);

    const result = store.consume(first, NOW + 1);

    expect(result).toEqual({
      ok: true,
      subject: 'alice',
      token: expect.any(String),
    });
    expect(result.ok && result.token).not.toBe(first);
  });

  it('rejects an unknown token', () => {
    expect(store.consume('never-issued', NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('rejects a token past its ttl', () => {
    const token = store.issue('alice', NOW);

    expect(store.consume(token, NOW + TTL)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects a rotated token when it is replayed', () => {
    const first = store.issue('alice', NOW);
    store.consume(first, NOW + 1);

    expect(store.consume(first, NOW + 2)).toEqual({
      ok: false,
      reason: 'reused',
    });
  });

  it('revokes the whole family when a rotated token is replayed', () => {
    const first = store.issue('alice', NOW);
    const second = store.consume(first, NOW + 1);
    if (!second.ok) throw new Error('expected rotation to succeed');

    // The replay means the old token leaked; the live one must die with it.
    store.consume(first, NOW + 2);

    expect(store.consume(second.token, NOW + 3)).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('leaves another user session untouched when one family is revoked', () => {
    const alice = store.issue('alice', NOW);
    const bob = store.issue('bob', NOW);
    store.consume(alice, NOW + 1);
    store.consume(alice, NOW + 2);

    expect(store.consume(bob, NOW + 3)).toMatchObject({
      ok: true,
      subject: 'bob',
    });
  });

  it('revokes a session on logout so its token stops working', () => {
    const token = store.issue('alice', NOW);

    store.revoke(token);

    expect(store.consume(token, NOW + 1)).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('ignores a logout for a token it never issued', () => {
    expect(() => store.revoke('never-issued')).not.toThrow();
  });
});
