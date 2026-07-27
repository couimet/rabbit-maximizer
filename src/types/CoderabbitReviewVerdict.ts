import type { CodeRabbitCommentType } from './CodeRabbitCommentType.js';

// `review_limited`, `review_skipped`, and `unknown` are comment-classification outcomes, not review verdicts.
// A `CoderabbitReviewVerdict` represents only a completed review with a verdict (approved or changes suggested).
export type CoderabbitReviewVerdictState = typeof CodeRabbitCommentType.review_approved | typeof CodeRabbitCommentType.review_changes_suggested;

export interface CoderabbitReviewVerdict {
  readonly htmlUrl: string;
  readonly state: CoderabbitReviewVerdictState;
}
