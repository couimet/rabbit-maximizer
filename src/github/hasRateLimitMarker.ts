import { REVIEW_BOT_RATE_LIMIT_MARKER } from "../types/coderabbit.js";

export const hasRateLimitMarker = (body: string): boolean =>
  body.includes(REVIEW_BOT_RATE_LIMIT_MARKER);
