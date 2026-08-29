export const sqlDateToDate = (date: Date | null | undefined): Date | undefined => {
  if (!date || isNaN(date.getTime())) return undefined;
  return date;
};
