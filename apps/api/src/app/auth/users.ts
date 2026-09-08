import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PERMISSIONS } from '@interview/auth';

/**
 * The user directory. A real system reads this from a database; the shape is
 * what matters here.
 *
 * Note that `permissions` live with the user, not in the token store. A token
 * is a snapshot of them taken at login, which is why a permission change only
 * takes effect on the next refresh - see docs/authentication.md.
 */

export interface User {
  username: string;
  permissions: string[];
}

interface UserRecord extends User {
  salt: string;
  passwordHash: Buffer;
}

function hash(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 64);
}

function record(
  username: string,
  password: string,
  permissions: string[],
): UserRecord {
  // Seeded at startup so the demo needs no migration step. The point is that
  // the plaintext is never retained - only the salt and the derived hash are.
  const salt = randomBytes(16).toString('hex');
  return { username, permissions, salt, passwordHash: hash(password, salt) };
}

const USERS = new Map<string, UserRecord>(
  [
    record('alice', 'alice-password', [
      PERMISSIONS.itemsRead,
      PERMISSIONS.itemsWrite,
    ]),
    record('bob', 'bob-password', [PERMISSIONS.itemsRead]),
  ].map((user) => [user.username, user]),
);

function publicView({ username, permissions }: UserRecord): User {
  return { username, permissions };
}

/** Looks a user up without checking credentials - used when refreshing. */
export function findUser(username: string): User | undefined {
  const user = USERS.get(username);
  return user && publicView(user);
}

export function authenticate(
  username: string,
  password: string,
): User | undefined {
  const user = USERS.get(username);
  if (!user) {
    return undefined;
  }

  const candidate = hash(password, user.salt);
  if (!timingSafeEqual(candidate, user.passwordHash)) {
    return undefined;
  }

  return publicView(user);
}
