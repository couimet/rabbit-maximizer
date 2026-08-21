/** Type guard: true when the value is a non-blank string. */
export const isNonBlank = (value: string | undefined): value is string => value !== undefined && value.trim() !== '';
