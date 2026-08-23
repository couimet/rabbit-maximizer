import { hasRateLimitMarker, REVIEW_BOT_SKIP_MARKER } from './index.js';

export const hasRateLimitOrSkipMarker = (body: string | null | undefined): boolean =>
  body ? hasRateLimitMarker(body) || body.includes(REVIEW_BOT_SKIP_MARKER) : false;
