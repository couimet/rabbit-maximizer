/** Classifies the type of review outcome a CodeRabbit comment represents. Sorted by lifecycle: not-reviewed outcomes first, then review outcomes. */
export enum CodeRabbitCommentType {
  /** CodeRabbit refused due to rate limiting. */
  review_limited = 'review_limited',
  /** CodeRabbit explicitly skipped the review (permanent refusal). */
  review_skipped = 'review_skipped',
  /** CodeRabbit reviewed and approved the PR. */
  review_approved = 'review_approved',
  /** CodeRabbit reviewed and suggested changes (advisory, not blocking). */
  review_changes_suggested = 'review_changes_suggested',
  /** Comment body did not match any known marker. */
  unknown = 'unknown',
}
