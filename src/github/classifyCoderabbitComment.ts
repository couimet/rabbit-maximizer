import { CodeRabbitCommentType, MatchedMarker } from '../domain.js';
import type { CommentClassification } from '../types/index.js';

import { hasRateLimitMarker, isApprovalReviewSignal, isCompletedReview, REVIEW_BOT_SKIP_MARKER } from './index.js';

export const classifyCoderabbitComment = (body: string): CommentClassification => {
  if (body.includes(REVIEW_BOT_SKIP_MARKER)) {
    return { classification: CodeRabbitCommentType.review_skipped, matchedMarker: MatchedMarker.skip };
  }
  if (isCompletedReview(body)) {
    return isApprovalReviewSignal(body)
      ? { classification: CodeRabbitCommentType.review_approved, matchedMarker: MatchedMarker.approval }
      : { classification: CodeRabbitCommentType.review_changes_suggested, matchedMarker: MatchedMarker.changes_suggested };
  }
  if (hasRateLimitMarker(body)) {
    return { classification: CodeRabbitCommentType.review_limited, matchedMarker: MatchedMarker.rate_limit };
  }
  return { classification: CodeRabbitCommentType.unknown, matchedMarker: undefined };
};
