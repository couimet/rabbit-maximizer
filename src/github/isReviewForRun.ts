import { extractCoderabbitRunId } from '../utils/index.js';

import type { SubmittedReview } from './SubmittedReview.js';

// Tier order is load-bearing: when a head commit is expected, a review matching that commit is
// accepted even from a different run — on <10-star repos a triggered review's run never equals the
// source comment's walkthrough run, so run equality alone would reject every review. Run equality
// still disambiguates when the commit does not match, because a review from an earlier run was
// generated against an older push. When no head is expected, the run tier decides; when neither is
// known (legacy rows), any completed review is accepted.
export const isReviewForRun = (review: SubmittedReview, expectedRunId: string | undefined, expectedHeadSha: string | undefined): boolean => {
  if (expectedHeadSha !== undefined) {
    if (review.commitId === expectedHeadSha) {
      return true;
    }
    if (expectedRunId !== undefined) {
      return extractCoderabbitRunId(review.body) === expectedRunId;
    }
    return false;
  }
  if (expectedRunId !== undefined) {
    return extractCoderabbitRunId(review.body) === expectedRunId;
  }
  return true;
};
