/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?tsx?$': ['ts-jest', { useESM: true, diagnostics: true }],
  },

  // Mock cleanup — automatic between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Test execution settings
  collectCoverage: true,
  errorOnDeprecated: true,
  testTimeout: 5000,
  maxWorkers: '50%',
  coverageProvider: 'v8',

  roots: ['<rootDir>/src', '<rootDir>/tests', '<rootDir>/dashboard'],
  setupFilesAfterEnv: ['jest-extended/all', '<rootDir>/tests/setup/matchers.ts'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'dashboard/src/**/*.ts',
    'dashboard/src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/api-types.ts',
    '!src/external-deps/couimet/dynamic-testing/**/*.ts',
    '!src/main.ts',
    '!src/container.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!dashboard/src/**/index.ts',
    '!src/types/Result.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // Map .js extensions → .ts for ts-jest ESM resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '\\.css$': '<rootDir>/tests/helpers/styleMock.ts',
  },
};
