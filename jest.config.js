/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",

  // Mock cleanup — automatic between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Test execution settings
  errorOnDeprecated: true,
  testTimeout: 5000,
  maxWorkers: "50%",
  coverageProvider: "v8",

  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/main.ts",
    "!src/container.ts",
    "!src/**/index.ts",
    // TODO: remove once @couimet packages provide tests for these
    // https://github.com/couimet/ts-npm-packages/issues/25
    "!src/errors/**",
    "!src/types/Result.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "html", "lcov"],
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
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
