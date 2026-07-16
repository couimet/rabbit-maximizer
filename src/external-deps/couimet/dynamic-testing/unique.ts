import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';

const COUNT_NOT_POSITIVE_INTEGER = 'COUNT_NOT_POSITIVE_INTEGER';

/** Returns `count` unique integers, each from a separate call to `getUniqueInt()`. */
export const getUniqueInts = (count: number): number[] => {
  if (count < 1) {
    throw new Error(`${COUNT_NOT_POSITIVE_INTEGER}: count must be a positive integer, received ${count}`);
  }
  return Array.from({ length: count }, () => getUniqueInt());
};

/** Returns an object whose keys are the given names, each value a unique integer. */
export const getUniqueIntsNamed = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, getUniqueInt()])) as Record<K, number>;

/** Returns `count` unique dates, each from a separate call to `getUniqueDate()`. */
export const getUniqueDates = (count: number): Date[] => {
  if (count < 1) {
    throw new Error(`${COUNT_NOT_POSITIVE_INTEGER}: count must be a positive integer, received ${count}`);
  }
  return Array.from({ length: count }, () => getUniqueDate());
};

/** Returns an object whose keys are the given names, each value a unique date. */
export const getUniqueDatesNamed = <K extends string>(keys: readonly K[]): Record<K, Date> =>
  Object.fromEntries(keys.map((k) => [k, getUniqueDate()])) as Record<K, Date>;
