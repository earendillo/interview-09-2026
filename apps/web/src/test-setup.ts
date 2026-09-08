import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

/**
 * Global matcher registration for this project's Vitest run.
 *
 * - `@testing-library/jest-dom` gives the accessibility-shaped assertions
 *   (`toHaveFocus`, `toHaveAccessibleName`) that read far better than poking
 *   at `document.activeElement` and `getAttribute('aria-label')`.
 * - `jest-axe` wraps axe-core as `expect(results).toHaveNoViolations()`.
 */
expect.extend(toHaveNoViolations);

// jest-axe ships Jest-namespace types, which Vitest's `expect` does not pick
// up. One declaration is cheaper than a `@ts-expect-error` in every spec.
// `any` mirrors the signature `@testing-library/jest-dom/vitest` declares for
// the same interface - TypeScript requires the type parameters to match.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}
