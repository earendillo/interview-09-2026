import nx from '@nx/eslint-plugin';
import baseConfig, { browserAppBoundaries } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  ...browserAppBoundaries,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
];
