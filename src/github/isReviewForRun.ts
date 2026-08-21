import { extractCoderabbitRunId } from '../utils/index.js';

import type { SubmittedReview } from './SubmittedReview.js';

// Tier order is load-bearing: when a run is expected, only that run's review counts —
// a commit match cannot override a run mismatch, because a review from an earlier run
// was generated against an older push. When no run is expected, the commit tier decides;
// when neither is known (legacy rows), any completed review is accepted.
export const isReviewForRun = (review: SubmittedReview, expectedRunId: string | undefined, expectedHeadSha: string | undefined): boolean => {
  if (expectedRunId !== undefined) {
    return extractCoderabbitRunId(review.body) === expectedRunId;
  }
  if (expectedHeadSha !== undefined) {
    return review.commitId === expectedHeadSha;
  }
  return true;
};
