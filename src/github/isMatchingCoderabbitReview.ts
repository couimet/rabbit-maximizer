import { hasKnownReviewState, REVIEW_BOT_LOGIN, SubmittedReview } from './index.js';

export const isMatchingCoderabbitReview = (review: SubmittedReview, since: Date): boolean =>
  review.userLogin === REVIEW_BOT_LOGIN && review.submittedAt !== undefined && new Date(review.submittedAt) > since && hasKnownReviewState(review.state ?? '');
