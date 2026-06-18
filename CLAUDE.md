# CLAUDE.md

Project-specific guidance for Claude Code.

## Testing

- The jest config (`jest.config.js`) sets `clearMocks`, `resetMocks`, and `restoreMocks` globally. Do not duplicate these in individual test files — no manual `jest.clearAllMocks()`, `jest.resetAllMocks()`, `jest.restoreAllMocks()`, or `afterAll` blocks that only call those.
- Import `jest` from `@jest/globals` when using `jest.spyOn`, `jest.fn`, or `jest.mock` in ESM test files.
