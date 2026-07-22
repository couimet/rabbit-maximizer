import { dateToISOString } from './dateToISOString.js';

/** Converts a nullable Date to an ISO string, returning `null` for null, undefined, or invalid dates. Use when the API contract requires `string | null` (OpenAPI `nullable: true`). */
export const nullableDateToISOString = (date: Date | null | undefined): string | null => dateToISOString(date) ?? null;
