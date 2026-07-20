import { REVIEW_BOT_SKIP_MARKER } from '../types/coderabbit.js';
import { CodeRabbitCommentType } from '../types/CodeRabbitCommentType.js';

import { hasRateLimitMarker } from './hasRateLimitMarker.js';
import { isApprovalReviewSignal } from './isApprovalReviewSignal.js';
import { isCompletedReview } from './isCompletedReview.js';

export const classifyCoderabbitComment = (body: string): CodeRabbitCommentType => {
  if (hasRateLimitMarker(body)) return CodeRabbitCommentType.review_limited;
  if (body.includes(REVIEW_BOT_SKIP_MARKER)) return CodeRabbitCommentType.review_skipped;
  if (isCompletedReview(body)) {
    return isApprovalReviewSignal(body) ? CodeRabbitCommentType.review_approved : CodeRabbitCommentType.review_changes_suggested;
  }
  return CodeRabbitCommentType.unknown;
};
