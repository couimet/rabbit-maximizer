/**
 * Represents a parsed repository filter entry.
 *
 * The user-facing config (env var) uses raw strings. `parseRepoFilter` infers
 * the scope from the pattern syntax and produces this discriminated union.
 *
 * Adding org support later means adding `'org'` to the `scope` union — a
 * non-breaking change that the compiler then enforces exhaustively.
 */
export type RepoFilter =
  | { readonly pattern: string; readonly scope: "user" }
  | { readonly pattern: string; readonly scope: "repo" };
