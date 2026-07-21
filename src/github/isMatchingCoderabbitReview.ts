import { REVIEW_BOT_LOGIN } from '../types/coderabbit.js';

import { SubmittedReview } from './types/index.js';
import { hasKnownReviewState } from './toReviewState.js';

export const isMatchingCoderabbitReview = (review: SubmittedReview, since: Date): boolean =>
  review.userLogin === REVIEW_BOT_LOGIN && review.submittedAt !== undefined && new Date(review.submittedAt) > since && hasKnownReviewState(review.state ?? '');
