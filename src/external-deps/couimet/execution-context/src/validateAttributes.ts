import { EXECUTION_CONTEXT_ATTRIBUTE_ERROR_CODES, type ExecutionContextAttribute, type ExecutionContextAttributeValues } from './attributes.js';

import { DetailedError } from '@couimet/detailed-error';
import { type ContextAttributes } from '@couimet/execution-context';

// Incubation for ts-npm-packages: this is meant to be ported as the validating half of
// `ExecutionContext.addAttributes()`, which today writes any record of string keys without looking at
// the values. `withAttributes` layers the bag this returns, so both writers share one gate.

/**
 * Builds the context bag for `entries`, checking every value against its own declaration's rule before
 * any of them is written. A blank value therefore fails in the frame that produced it, and no value
 * from a rejected set reaches the store.
 *
 * The entries are keyed by declaration name, not by context key, so the registry is the only place a
 * context key appears. The mapped type then stops two caller mistakes at compile time: a value of the
 * wrong type, and a name the registry does not declare. Two entries for one attribute cannot exist
 * either, because an object literal cannot repeat a property.
 */
export const validateAttributes = <R extends Record<string, ExecutionContextAttribute<unknown>>>(
  registry: R,
  entries: ExecutionContextAttributeValues<R>,
): ContextAttributes => {
  const attrs: ContextAttributes = {};

  for (const name of Object.keys(entries) as Array<keyof R>) {
    const attribute = registry[name];
    const value = entries[name];

    if (attribute.isValid !== undefined && !attribute.isValid(value)) {
      throw new DetailedError({
        code: EXECUTION_CONTEXT_ATTRIBUTE_ERROR_CODES.INVALID_ATTRIBUTE_VALUE,
        message: 'Attribute value failed its validation rule',
        functionName: 'validateAttributes',
        details: { key: attribute.key, value },
      });
    }

    attrs[attribute.key] = value;
  }

  return attrs;
};
