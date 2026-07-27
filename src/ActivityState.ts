export enum ActivityState {
  reviewCompleted = 'review_completed',
  failed = 'failed',
  prMerged = 'pr_merged',
  prClosed = 'pr_closed',
  skipped = 'skipped',
  unknownResolution = 'unknown_resolution',
  reviewInProgress = 'review_in_progress',
  reviewLimited = 'review_limited',
  awaitingReview = 'awaiting_review',
  pending = 'pending',
}
