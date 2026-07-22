import { isCompletedReview, REVIEW_BOT_LOGIN, SubmittedReview } from './index.js';

export const isMatchingCompletedReview = (review: SubmittedReview, since: Date): boolean =>
  review.userLogin === REVIEW_BOT_LOGIN &&
  review.body !== undefined &&
  review.submittedAt !== undefined &&
  isCompletedReview(review.body) &&
  new Date(review.submittedAt) > since;
