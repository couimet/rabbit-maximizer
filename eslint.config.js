import barrelImports from './incubator/eslint-plugin-barrel-imports/index.mjs';

import baseConfig, { reactConfig } from '@couimet/eslint-config';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['prisma/generated/**'] },
  ...baseConfig,
  {
    plugins: { 'barrel-imports': barrelImports },
    rules: {
      'barrel-imports/no-duplicate-barrel-imports': 'error',
    },
  },
  ...reactConfig({
    plugins: { 'react-hooks': reactHooksPlugin, react: reactPlugin },
  }),
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
