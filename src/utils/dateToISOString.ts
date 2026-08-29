export const dateToISOString = (date: Date | null | undefined): string | undefined => {
  if (!date || isNaN(date.getTime())) return undefined;
  return date.toISOString();
};
