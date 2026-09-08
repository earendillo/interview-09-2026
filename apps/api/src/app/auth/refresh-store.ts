import { randomBytes } from 'node:crypto';

/**
 * Server-side state for refresh tokens.
 *
 * The access token is stateless by design - it is verified from its signature
 * alone, which is what makes it cheap, and also what makes it impossible to
 * revoke before it expires. Everything revocable therefore lives here: logout
 * and reuse-detection delete records from this store, and the short access
 * token TTL bounds how long a revoked session can still be used.
 *
 * In-memory on purpose. A real deployment puts this in Redis or a table; the
 * interface below is the part that matters.
 */

interface RefreshRecord {
  subject: string;
  /** All tokens rotated from one login share a family, so reuse kills the lot. */
  familyId: string;
  expiresAt: number;
  /** Rotated tokens are kept, not deleted, so a replay is detectable. */
  used: boolean;
}

export type ConsumeResult =
  | { ok: true; subject: string; token: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' };

export interface RefreshStore {
  /** Starts a new session family. Returns the opaque token. */
  issue(subject: string, now: number): string;
  /** Validates and rotates a token in one step. */
  consume(token: string, now: number): ConsumeResult;
  /** Logout: drops the token's whole family. */
  revoke(token: string): void;
}

export interface RefreshStoreOptions {
  ttlSeconds: number;
}

function opaqueToken(): string {
  // Opaque, not a JWT: it carries no claims, so it can only be checked against
  // this store - which is exactly the property that makes revocation possible.
  return randomBytes(32).toString('base64url');
}

export function createRefreshStore({
  ttlSeconds,
}: RefreshStoreOptions): RefreshStore {
  const records = new Map<string, RefreshRecord>();

  function dropFamily(familyId: string): void {
    for (const [token, record] of records) {
      if (record.familyId === familyId) {
        records.delete(token);
      }
    }
  }

  function add(subject: string, familyId: string, now: number): string {
    const token = opaqueToken();
    records.set(token, {
      subject,
      familyId,
      expiresAt: now + ttlSeconds,
      used: false,
    });
    return token;
  }

  return {
    issue(subject, now) {
      return add(subject, opaqueToken(), now);
    },

    consume(token, now) {
      const record = records.get(token);
      if (!record) {
        return { ok: false, reason: 'unknown' };
      }

      if (record.used) {
        // Someone is replaying a token that was already rotated, so the token
        // leaked. The current holder cannot be told apart from the thief, so
        // the safe move is to end the session for both.
        dropFamily(record.familyId);
        return { ok: false, reason: 'reused' };
      }

      if (now >= record.expiresAt) {
        records.delete(token);
        return { ok: false, reason: 'expired' };
      }

      record.used = true;
      return {
        ok: true,
        subject: record.subject,
        token: add(record.subject, record.familyId, now),
      };
    },

    revoke(token) {
      const record = records.get(token);
      if (record) {
        dropFamily(record.familyId);
      }
    },
  };
}
