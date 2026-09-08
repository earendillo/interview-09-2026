// Fixture for the dependency-boundary demonstration.
//
// It is intentionally NOT part of any project's source tree: the repository
// must stay green. `tools/boundary-check/verify.mjs` copies this file into
// apps/web temporarily, lints it, and deletes it again.
//
// Applications (tag `type:app`) may only depend on `type:shared-lib`, so this
// import of an internal library must be rejected.
import { formatDebugInfo } from '@interview/internal-tools';

export const demo = formatDebugInfo;
