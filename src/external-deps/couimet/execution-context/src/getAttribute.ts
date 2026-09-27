import { EXECUTION_CONTEXT_ATTRIBUTE_ERROR_CODES, type ExecutionContextAttribute } from './attributes.js';

import { DetailedError } from '@couimet/detailed-error';
import { ExecutionContext } from '@couimet/execution-context';

// Incubation for ts-npm-packages: this is meant to be ported beside `ExecutionContext.getAttribute`,
// which returns `unknown` and yields `undefined` for an absent or inactive context. The two differ in
// failure behavior, so the day this ships the call sites move their import and keep their call.

/**
 * Reads an attribute from the active execution context, and throws instead of returning `undefined`
 * when no writer set it, so a mistyped or unscoped read fails at the first call.
 *
 * A declaration that carries a rule verifies the value before returning it. A declaration that omits
 * the rule returns the type the caller writes, and the value is trusted. A raw key runs no rule at
 * all, so its result stays `unknown`: no type parameter appears in that signature, so an expected
 * type cannot flow back into the call and narrow it silently.
 */
export function getAttribute<T>(attribute: ExecutionContextAttribute<T>): T;
export function getAttribute(key: string): unknown;
export function getAttribute(attribute: ExecutionContextAttribute<unknown> | string): unknown {
  const key = typeof attribute === 'string' ? attribute : attribute.key;
  const isValid = typeof attribute === 'string' ? undefined : attribute.isValid;
  const value = ExecutionContext.getAttribute(key);

  if (value === undefined) {
    throw new DetailedError({
      code: EXECUTION_CONTEXT_ATTRIBUTE_ERROR_CODES.MISSING_CONTEXT_ATTRIBUTE,
      message: 'Active execution context is missing the attribute',
      functionName: 'getAttribute',
      details: { key },
    });
  }

  if (isValid !== undefined && !isValid(value)) {
    throw new DetailedError({
      code: EXECUTION_CONTEXT_ATTRIBUTE_ERROR_CODES.INVALID_ATTRIBUTE_VALUE,
      message: 'Attribute value failed its validation rule',
      functionName: 'getAttribute',
      details: { key, value },
    });
  }

  return value;
}
