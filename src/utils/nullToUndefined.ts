/** Converts a nullable value to an optional one, returning `undefined` for `null`. Use when the internal contract requires `T | undefined`. */
export const nullToUndefined = <T>(value: T | null): T | undefined => value ?? undefined;
