/** Converts an optional string to a nullable string, returning `null` for undefined. Use when the API contract requires `string | null` (OpenAPI `nullable: true`). */
export const nullableString = (value: string | undefined): string | null => value ?? null;
