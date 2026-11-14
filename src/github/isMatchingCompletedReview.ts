import { isCompletedReview, REVIEW_BOT_LOGIN, SubmittedReview } from './index.js';

/** True when the bot submitted the review after `since` and the body holds a configured verdict phrase. */
export const isMatchingCompletedReview = (review: SubmittedReview, since: Date, phrases: readonly string[]): boolean =>
  review.userLogin === REVIEW_BOT_LOGIN &&
  review.body !== undefined &&
  review.submittedAt !== undefined &&
  isCompletedReview(review.body, phrases) &&
  new Date(review.submittedAt) > since;
