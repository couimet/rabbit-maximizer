/** True when the string compiles as a JavaScript regular expression. */
export const isCompilableRegex = (pattern: string): boolean => {
  try {
    RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};
