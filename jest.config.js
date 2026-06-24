/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',

  // Mock cleanup — automatic between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Test execution settings
  errorOnDeprecated: true,
  testTimeout: 5000,
  maxWorkers: '50%',
  coverageProvider: 'v8',

  roots: ['<rootDir>/src', '<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/node_modules/@couimet/detailed-error-testing/dist/setup.mjs'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/main.ts', '!src/container.ts', '!src/**/index.ts', '!src/types/Result.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Map .js extensions → .ts for ts-jest ESM resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
