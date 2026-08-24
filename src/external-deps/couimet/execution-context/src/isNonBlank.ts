export const isNonBlank = (value: string | undefined): value is string => value !== undefined && value.trim() !== '';
