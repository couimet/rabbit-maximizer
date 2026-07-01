export const isValidTimezone = (tz: string): boolean => {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone === tz;
  } catch {
    return false;
  }
};
