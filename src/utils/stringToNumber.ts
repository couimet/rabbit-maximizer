/** Parses a numeric string, returning `undefined` when the value is absent, empty, or not a number. */
export const stringToNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};
