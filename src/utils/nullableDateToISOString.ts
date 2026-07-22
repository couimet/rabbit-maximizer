import { dateToISOString } from './dateToISOString.js';

/** Returns `null` for null, undefined, or invalid dates. Use when the API contract requires `string | null` (OpenAPI `nullable: true`). */
export const nullableDateToISOString = (date: Date | null | undefined): string | null => dateToISOString(date) ?? null;
