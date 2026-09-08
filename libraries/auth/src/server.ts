/**
 * The server-only entry point.
 *
 * Imported as `@interview/auth/server`. Anything that needs the signing key -
 * minting an access token, verifying one - is here, so that reaching for it
 * from a React application is an import error rather than a blank page.
 */
export {
  signJwt,
  verifyJwt,
  type SignOptions,
  type VerifyOptions,
  type VerifyResult,
} from './lib/jwt';
