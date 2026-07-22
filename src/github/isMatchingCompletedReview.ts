import { REVIEW_BOT_LOGIN } from '../types/coderabbit.js';

import { isCompletedReview, SubmittedReview } from './index.js';

export const isMatchingCompletedReview = (review: SubmittedReview, since: Date): boolean =>
  review.userLogin === REVIEW_BOT_LOGIN &&
  review.body !== undefined &&
  review.submittedAt !== undefined &&
  isCompletedReview(review.body) &&
  new Date(review.submittedAt) > since;
