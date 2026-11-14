import { hasOwnRetriggerMarker } from './hasOwnRetriggerMarker.js';
import { hasRateLimitMarker } from './hasRateLimitMarker.js';

/** True when the body holds a configured rate-limit phrase and it does not come from our own retrigger comment. */
export const isRateLimitComment = (body: string | null | undefined, phrases: readonly string[]): boolean =>
  body ? hasRateLimitMarker(body, phrases) && !hasOwnRetriggerMarker(body) : false;
