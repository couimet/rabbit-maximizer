/** Converts a Date to ISO string, returning `undefined` for null, undefined, or invalid dates. */
export const dateToISOString = (date: Date | null | undefined): string | undefined => {
  if (!date || isNaN(date.getTime())) return undefined;
  return date.toISOString();
};
