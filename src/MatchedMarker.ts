import {
  REVIEW_BOT_ACTIONABLE_SIGNAL,
  REVIEW_BOT_NO_ACTIONABLE_SIGNAL,
  REVIEW_BOT_RATE_LIMIT_MARKER,
  REVIEW_BOT_SKIP_MARKER,
} from './github/coderabbitConstants.js';

/** CodeRabbit marker text that drove a comment classification. */
export const MatchedMarker = {
  rate_limit: REVIEW_BOT_RATE_LIMIT_MARKER,
  skip: REVIEW_BOT_SKIP_MARKER,
  approval: REVIEW_BOT_NO_ACTIONABLE_SIGNAL,
  changes_suggested: REVIEW_BOT_ACTIONABLE_SIGNAL,
} as const;

export type MatchedMarker = (typeof MatchedMarker)[keyof typeof MatchedMarker];
