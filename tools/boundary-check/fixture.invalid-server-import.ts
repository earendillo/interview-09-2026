// Fixture for the dependency-boundary demonstration.
//
// Like its sibling `fixture.invalid-import.ts`, it is intentionally NOT part
// of any project's source tree - `tools/boundary-check/verify.mjs` copies it
// into apps/web temporarily, lints it, and deletes it again.
//
// `@interview/auth/server` reaches `node:crypto`. Nx's tag-based boundary rule
// cannot reject this one: `apps/web -> libraries/auth` is a legal
// `type:app -> type:shared-lib` edge whichever subpath it imports. Without the
// `no-restricted-imports` rule in `browserAppBoundaries`, lint, typecheck and
// `vite build` all pass and the application renders a blank page in the
// browser instead.
import { signJwt } from '@interview/auth/server';

export const demo = signJwt;
