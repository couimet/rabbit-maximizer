/**
 * Bridges jest-extended matchers onto the `expect` package's Matchers
 * interface — the one {@link @jest/globals} re-exports through
 * {@link @jest/expect}. jest-extended's own types target the global
 * `jest.Matchers` namespace from `@types/jest`, which is a different
 * interface chain and does not reach `@jest/globals`'s `expect`.
 *
 * Extending `jest.Matchers` merges the full jest-extended matcher set
 * (toEqualIgnoringWhitespace, toBeArray, etc.) without listing each one.
 */
declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void>, _T = unknown> extends jest.Matchers<R> {}
}
