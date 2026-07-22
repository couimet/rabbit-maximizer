import { CodeRabbitCommentType, hasRateLimitMarker, isApprovalReviewSignal, isCompletedReview, REVIEW_BOT_SKIP_MARKER } from './index.js';

export const classifyCoderabbitComment = (body: string): CodeRabbitCommentType => {
  if (hasRateLimitMarker(body)) return CodeRabbitCommentType.review_limited;
  if (body.includes(REVIEW_BOT_SKIP_MARKER)) return CodeRabbitCommentType.review_skipped;
  if (isCompletedReview(body)) {
    return isApprovalReviewSignal(body) ? CodeRabbitCommentType.review_approved : CodeRabbitCommentType.review_changes_suggested;
  }
  return CodeRabbitCommentType.unknown;
};
