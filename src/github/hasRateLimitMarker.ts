import { findPhrase } from '../utils/index.js';

/** True when the body holds one of the configured rate-limit phrases. */
export const hasRateLimitMarker = (body: string, phrases: readonly string[]): boolean => findPhrase(body, phrases) !== undefined;
