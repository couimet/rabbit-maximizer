/** Converts a nullable SQL date column value to a Date, returning `undefined` for null, undefined, or invalid dates. */
export const sqlDateToDate = (date: Date | null | undefined): Date | undefined => {
  if (!date || isNaN(date.getTime())) return undefined;
  return date;
};
