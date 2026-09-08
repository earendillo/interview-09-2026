/**
 * The shape of an access token's payload.
 *
 * These live in their own module, apart from the HS256 code in `jwt.ts`, so
 * that the browser entry point can describe a session without importing
 * anything that signs one. Types are erased at build time, but the separation
 * is structural rather than a bet on erasure: nothing here can ever pull
 * `node:crypto` into an application bundle.
 */

/** The claims this system puts in an access token. */
export interface AccessTokenClaims {
  /** The user the token speaks for. */
  sub: string;
  /** Authorization data carried in the token, so `/api` needs no user lookup. */
  permissions: string[];
}

/** Claims plus the timestamps `signJwt` adds. */
export interface JwtPayload extends AccessTokenClaims {
  /** Issued at, epoch seconds. */
  iat: number;
  /** Expires at, epoch seconds. */
  exp: number;
}
