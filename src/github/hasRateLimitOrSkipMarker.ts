import { findPhrase } from '../utils/index.js';

/** True when the body holds a configured rate-limit phrase or a configured skip phrase. */
export const hasRateLimitOrSkipMarker = (body: string | null | undefined, phrases: readonly string[]): boolean =>
  body ? findPhrase(body, phrases) !== undefined : false;
