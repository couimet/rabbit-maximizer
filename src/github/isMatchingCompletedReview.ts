import { REVIEW_BOT_LOGIN } from '../types/coderabbit.js';

import type { ReviewCandidate } from './types/index.js';
import { isCompletedReview } from './isCompletedReview.js';

export const isMatchingCompletedReview = (review: ReviewCandidate, since: Date): boolean =>
  review.user?.login === REVIEW_BOT_LOGIN && !!review.body && !!review.submitted_at && isCompletedReview(review.body) && new Date(review.submitted_at) > since;
