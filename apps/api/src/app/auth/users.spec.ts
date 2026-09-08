import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@interview/auth';
import { authenticate, findUser } from './users';

describe('authenticate', () => {
  it('returns the user for correct credentials', () => {
    expect(authenticate('alice', 'alice-password')).toEqual({
      username: 'alice',
      permissions: [PERMISSIONS.itemsRead, PERMISSIONS.itemsWrite],
    });
  });

  it('gives a reader account only the read permission', () => {
    expect(authenticate('bob', 'bob-password')).toEqual({
      username: 'bob',
      permissions: [PERMISSIONS.itemsRead],
    });
  });

  it('rejects a wrong password', () => {
    expect(authenticate('alice', 'wrong')).toBeUndefined();
  });

  it('rejects an unknown user', () => {
    expect(authenticate('mallory', 'alice-password')).toBeUndefined();
  });

  it('stores no password in recoverable form', () => {
    // Credentials are compared against a scrypt hash, never a stored plaintext.
    expect(JSON.stringify(findUser('alice'))).not.toContain('alice-password');
  });
});

describe('findUser', () => {
  it('resolves the subject of a refreshed session to current permissions', () => {
    expect(findUser('bob')?.permissions).toEqual([PERMISSIONS.itemsRead]);
  });

  it('returns nothing for a user that no longer exists', () => {
    expect(findUser('deleted')).toBeUndefined();
  });
});
