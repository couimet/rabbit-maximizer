import { REVIEW_BOT_LOGIN } from '../types/coderabbit.js';

import { hasKnownReviewState } from './toReviewState.js';

export interface CoderabbitReviewCandidate {
  readonly user?: { readonly login?: string } | null;
  readonly submitted_at?: string | null;
  readonly state?: string;
}

export const isMatchingCoderabbitReview = (review: CoderabbitReviewCandidate, since: Date): boolean =>
  review.user?.login === REVIEW_BOT_LOGIN && review.submitted_at != null && new Date(review.submitted_at) > since && hasKnownReviewState(review.state ?? '');
