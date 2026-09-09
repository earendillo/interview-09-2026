import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-output',
      '**/out-tsc',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:shared-lib'],
            },
            {
              sourceTag: 'type:shared-lib',
              onlyDependOnLibsWithTags: ['type:shared-lib'],
            },
            {
              sourceTag: 'type:internal-lib',
              onlyDependOnLibsWithTags: [
                'type:shared-lib',
                'type:internal-lib',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {},
  },
];

/**
 * Browser applications may not import the server-only entry point.
 *
 * `@interview/auth/server` reaches `node:crypto`. Importing it from an
 * application builds and typechecks cleanly - Vite externalises the builtin
 * with a *warning* and exits 0 - and then renders a blank page in the browser.
 *
 * `@nx/enforce-module-boundaries` cannot express this: it compares project
 * tags, and `apps/web -> libraries/auth` is a legal `type:app ->
 * type:shared-lib` edge whichever subpath it imports. The two guards are
 * complementary - `libraries/auth/src/browser-entry.spec.ts` keeps the
 * library's own public entry clean, and this rule keeps its consumers honest.
 *
 * Spread into the browser applications only: `apps/api` imports the server
 * entry on purpose.
 */
export const browserAppBoundaries = [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@interview/auth/server',
              message:
                'Server-only: it needs node:crypto and will not run in a browser. Applications use @interview/auth.',
            },
          ],
        },
      ],
    },
  },
];
