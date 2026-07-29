export enum Resolution {
  ReviewCompleted = 'review_completed',
  ManualReview = 'manual_review',
  PrMerged = 'pr_merged',
  PrClosedWithoutMerge = 'pr_closed_without_merge',
  Failed = 'failed',
  Skipped = 'skipped',
  StaleComment = 'stale_comment',
}
