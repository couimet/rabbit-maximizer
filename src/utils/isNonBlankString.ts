/**
 * The rule every execution context attribute in this application shares: a value passes when it is a
 * string that holds more than space.
 *
 * The rule reads the value and leaves it alone. A normalising variant would store `abc` for a caller
 * that passed ` abc `, so the context would hold a value no caller produced and a later reader could
 * not match against its own input.
 */
export const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
