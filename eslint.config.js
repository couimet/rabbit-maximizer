import baseConfig from '@couimet/eslint-config';

export default [
  ...baseConfig,
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
