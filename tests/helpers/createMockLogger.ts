import type { Logger } from '@couimet/logger-contract';
import { jest } from '@jest/globals';

// Local stand-in for @couimet/logger-contract-testing's createMockLogger, which
// can't run under our ESM Jest until
// https://github.com/couimet/ts-npm-packages/issues/29 lands (its build
// references a global `jest`). Swap to the package import once that ships.
export const createMockLogger = (overrides: Partial<Logger> = {}): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  ...overrides,
});
