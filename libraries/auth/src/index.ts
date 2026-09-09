/**
 * The browser-safe entry point.
 *
 * Everything exported here must run in an application bundle, so this file and
 * everything it reaches may not import a `node:` builtin or touch `Buffer`.
 * Token signing and verification are deliberately absent: they live behind
 * `@interview/auth/server`, and `src/browser-entry.spec.ts` fails the build if
 * they ever leak back in.
 */
export type { AccessTokenClaims, JwtPayload } from './lib/claims';
export { PERMISSIONS, hasPermission, type Permission } from './lib/permissions';
export { apiFetch, REFRESH_URL } from './session/api-fetch';
export {
  loadSession,
  login,
  logout,
  type LoginResult,
  type Session,
  type SessionUser,
} from './session/session-client';
export {
  useSession,
  type SessionState,
  type SessionStatus,
} from './session/use-session';
