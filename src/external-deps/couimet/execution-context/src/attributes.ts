// Incubation for ts-npm-packages: these declarations are meant to be ported into the published
// `@couimet/execution-context`, beside `ExecutionContextErrorCodes`. The codes are local constants
// only because TypeScript cannot add a member to an enum a dependency declares. Each constant holds
// the string it will hold upstream, so adoption changes the import and leaves every assertion alone.

/**
 * One attribute an application puts in the execution context: the key it writes under, and an
 * optional rule that decides which values may enter.
 *
 * `isValid` is a type predicate, so a declaration that carries a rule also carries the type of its
 * value and the readers need no annotation. A declaration that omits the rule accepts every value,
 * which is what an attribute holding a count or a flag needs.
 */
export interface ExecutionContextAttribute<T> {
  readonly key: string;
  readonly isValid?: (value: unknown) => value is T;
}

/**
 * The values for one registry, each typed by its own declaration's rule. A declaration without a
 * rule takes `unknown`, and a key the registry does not declare is a compile error at the call site.
 */
export type ExecutionContextAttributeValues<R> = {
  readonly [K in keyof R]?: R[K] extends { isValid: (value: unknown) => value is infer T } ? T : unknown;
};

export const EXECUTION_CONTEXT_ATTRIBUTE_ERROR_CODES = {
  INVALID_ATTRIBUTE_VALUE: 'INVALID_ATTRIBUTE_VALUE',
  MISSING_CONTEXT_ATTRIBUTE: 'MISSING_CONTEXT_ATTRIBUTE',
} as const;
