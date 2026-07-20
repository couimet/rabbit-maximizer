import { getUniqueString } from '@couimet/dynamic-testing';

const COUNT_NOT_POSITIVE_INTEGER = 'COUNT_NOT_POSITIVE_INTEGER';

/** Returns `count` unique strings, each from a separate call to `getUniqueString()`. */
export const getUniqueStrings = (count: number): string[] => {
  if (count < 1) {
    throw new Error(`${COUNT_NOT_POSITIVE_INTEGER}: count must be a positive integer, received ${count}`);
  }
  return Array.from({ length: count }, () => getUniqueString());
};

/** Returns an object whose keys are the given names, each value a unique string. */
export const getUniqueStringsNamed = <K extends string>(keys: readonly K[]): Record<K, string> =>
  Object.fromEntries(keys.map((k) => [k, getUniqueString()])) as Record<K, string>;
